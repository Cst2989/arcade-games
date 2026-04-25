# Curated repos homepage — design

**Date:** 2026-04-25
**Project:** `games/invaders`
**Status:** Approved (pending implementation plan)

## Goal

Replace the current free-text repo input + 4-chip title screen with a homepage that lists 100 curated GitHub repos, each row showing the language, the total last-year contributions of its top 5 contributors, and the 5 contributor avatars (boss visibly larger). A search field at the top filters the list as the user types. All contribution data is baked into static JSON at build time by a fetch script — the running game never calls the GitHub API.

## Non-goals

- Live GitHub fallback for repos outside the curated list. Strictly out of scope.
- Re-ranking on the client. The fetch script writes the list pre-sorted.
- Auto-refresh of stale data. Re-running the fetch script is a manual dev step.
- Mock-data fallback. Removed entirely.

## Architecture & file changes

### New

| Path | Purpose |
|---|---|
| `scripts/repos.txt` | Input list, one `owner/name` per line. Blank lines and `#` comments allowed. User-curated. |
| `scripts/fetch-repos.sh` | Bash + curl + jq script that reads `repos.txt` and writes the JSON + avatar files. |
| `public/data/repos.json` | Homepage index. ~50–100 KB. Pre-sorted desc by total contributions. |
| `public/data/repos/<owner>__<name>.json` | Per-repo full level data (~80–150 KB each). Lazy-loaded on click. |
| `public/avatars/<login>.png` | 200×200 contributor avatar. One file per unique contributor. |
| `src/scenes/homepage.ts` | New scene. Replaces `title.ts`. Filter input + scrollable list + keybind hint. |
| `src/data/repos-loader.ts` | Loads `repos.json` at boot, lazy-loads per-repo JSON on click. |

### Deleted

- `src/data/github-client.ts` — all live API calls + `GitHubRateLimitError`.
- `src/data/mock-data.ts` — deterministic fallback no longer needed.
- `src/ui/token-prompt.ts` — no token used at runtime.
- `src/scenes/title.ts` — replaced by `homepage.ts`.

### Touched (minimal changes)

- `src/main.ts` — boot mounts `HomepageScene`. For `?repo=owner/name`: if the repo is in `repos.json` mount `DeepLinkIntroScene`, otherwise mount `HomepageScene` with a one-time toast. `loadRealRepo` and `startGameFromMock` are deleted.
- `src/data/mapping.ts` — `contributorToLevel` already accepts `ContributorStats`, no shape change. The new path feeds it from JSON instead of the API.
- `src/scenes/loading.ts` — kept and reused for the per-repo JSON fetch (small file, but the brief progress UI smooths the click → game transition).

## Data shapes

### `public/data/repos.json` (the index)

```jsonc
{
  "generatedAt": "2026-04-25T10:30:00Z",
  "repos": [
    {
      "owner": "facebook",
      "name": "react",
      "language": "JavaScript",
      "description": "The library for web and native user interfaces.",
      "totalContributions": 12847,
      "top5": [
        { "login": "gaearon",     "avatarPath": "avatars/gaearon.png",     "contributions": 4231, "isBoss": true  },
        { "login": "acdlite",     "avatarPath": "avatars/acdlite.png",     "contributions": 2104, "isBoss": false },
        { "login": "sebmarkbage", "avatarPath": "avatars/sebmarkbage.png", "contributions": 1899, "isBoss": false },
        { "login": "rickhanlonii","avatarPath": "avatars/rickhanlonii.png","contributions": 1503, "isBoss": false },
        { "login": "kassens",     "avatarPath": "avatars/kassens.png",     "contributions": 998,  "isBoss": false }
      ]
    }
    // ...99 more entries, sorted desc by totalContributions
  ]
}
```

`top5` order in the index: descending by contributions (boss first), used for the homepage avatar row layout.

### `public/data/repos/<owner>__<name>.json` (per-repo)

```jsonc
{
  "owner": "facebook",
  "name": "react",
  "language": "JavaScript",
  "contributors": [
    {
      "login": "kassens",
      "avatarPath": "avatars/kassens.png",
      "totalCommits": 998,
      "daily": [{ "date": "2025-04-25", "count": 0 } /* ...365 entries, oldest first */],
      "biggestCommit": {
        "sha": "...",
        "date": "2025-09-12",
        "message": "Refactor reconciler scheduling",
        "commitsThatDay": 8
      },
      "profile": {
        "location": "Berlin, Germany",
        "followers": 1234,
        "publicRepos": 47,
        "joinedYear": 2014,
        "bio": "..."
      }
    }
    // ...4 more, ending with rank #1 (boss)
  ]
}
```

`contributors` order in the per-repo file: **rank #5 → rank #1 (boss last)**, matching the existing `levels[0]=weakest, levels[N-1]=boss` convention. `repos-loader` maps each entry directly to `ContributorStats` (the existing internal type) and feeds `contributorToLevel`.

## Fetch script behaviour (`scripts/fetch-repos.sh`)

1. Asserts `$GITHUB_TOKEN` is set; aborts with a friendly hint otherwise.
2. Reads `scripts/repos.txt`, strips `#` comments and blank lines.
3. For each `owner/name`:
   1. `GET /repos/:owner/:name` → `language`, `description`.
   2. `GET /repos/:owner/:name/contributors?per_page=30` → top contributors.
   3. For the top 10 candidates (by all-time count), fetch `GET /repos/.../commits?author=<login>&since=<1y ago>` paged up to 3×100. Aggregate to `daily[365]` in jq.
   4. Pick the 5 with highest last-year totals (>0). If fewer than 5 qualify, the repo is logged and skipped.
   5. For each of the 5: `GET /users/:login` (location, followers, joinedYear, bio) and download the avatar from `<avatar_url>?s=200` (GitHub serves a resized 200×200 image when given the `s` query param) to `public/avatars/<login>.png`. Skip the curl if the file already exists.
   6. Write `public/data/repos/<owner>__<name>.json`.
4. After processing all repos: assemble `public/data/repos.json`, sorted desc by `totalContributions` (sum of the 5 contributors' last-year commits).
5. Sleeps 1 s between repos as a secondary rate-limit cushion.
6. **Resumable:** skips repos whose per-repo JSON exists and is <7 days old. `--force` flag overrides.

The script is the single source of truth for ordering, top-5 selection, and JSON shape.

## Homepage scene (`src/scenes/homepage.ts`)

### Layout (960×600 canvas)

- **0–80 px** — header: title `// pick your battle` + filter input (`>_ filter…`).
- **80–560 px** — scrollable list viewport: 480 px tall, 6 visible rows of 80 px.
- **560–600 px** — keybind hint card: `← → scroll · ENTER launch · ESC clear`.

### Row layout (80 px tall)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   facebook/react   ● JavaScript                                     │
│   12,847 commits last year         😀 😀 😀 😀   ⬤ BOSS ⬤          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

- Repo name + coloured language dot (GitHub palette, static map in scene).
- "{N} commits last year" stat.
- Avatars right-aligned. The 5th (boss) renders at ~1.6× the size of the other four (40 px regulars + 64 px boss).
- Hover or keyboard focus: green border `#39d353` + tinted background.

### Behaviour

- **Filter input:** substring match against `<owner>/<name>`, case-insensitive. Typing appends characters; Backspace removes one; Esc clears the field. Empty filter = full 100.
- **Scroll:** mouse wheel, ↑/↓, PgUp/PgDn move in 80-px increments. Touch: vertical swipe.
- **Selection:** hover with mouse, or keyboard cursor follows ↑/↓. Click or ENTER on the focused row launches that repo.
- **Avatar preload:** when `repos.json` resolves, the scene preloads all referenced `<img>` PNGs in parallel via `Promise.all`. A subtle loading state shows until ready (typically <100 ms locally).

## Click → game launch flow

1. User clicks `facebook/react` on the homepage.
2. `repos-loader.loadRepo('facebook', 'react')` fetches `public/data/repos/facebook__react.json`.
3. `LoadingScene` displays briefly with progress.
4. The 5 contributors in the JSON map directly to `ContributorStats` (existing internal type) — `contributorToLevel` consumes them unchanged.
5. `launchLevel(0, levels, ranks, repoFullName, stats)` — same as today.

## Error / edge cases

| Case | Behaviour |
|---|---|
| `repos.json` missing (script never run) | Homepage renders a centred message: "No repos yet. Run `scripts/fetch-repos.sh`." |
| Per-repo JSON missing (index out of sync) | Toast: "Repo data missing — re-run fetch script." Bounce back to homepage. |
| Avatar PNG missing | Render initial-letter placeholder (same fallback `contributor-card.ts` already has). |
| Deep link `?repo=foo/bar` to non-listed repo | Homepage renders normally + one-time toast: "That repo isn't in the curated list." |
| Empty `scripts/repos.txt` | Script exits cleanly with a warning. Resulting `repos.json` has empty array — homepage shows the "No repos yet" message. |

## Testing

- **Unit:** `src/tests/repos-loader.test.ts` — happy path, missing index, missing per-repo JSON, malformed JSON.
- **Unit:** `src/tests/homepage-filter.test.ts` — substring filter, case-insensitivity, empty input, no matches.
- **Smoke (vitest + happy-dom):** fixture `repos.json` with 3 entries renders 3 rows; click launches the correct repo path.
- **Manual:** run `scripts/fetch-repos.sh` against a 3-repo `repos.txt`, verify `public/avatars/` and `public/data/` populated, `pnpm dev`, click through end-to-end.
- **No tests for the bash script itself** beyond a manual smoke run — it is a dev-time tool.

## Open assumptions (locked unless user objects)

- `GITHUB_TOKEN` env var is the auth mechanism for the script.
- Avatars stored at 200×200 px (single size used for both homepage thumbnails and in-game intros).
- Language palette is a static map in the homepage scene, not data-driven.
- The `?repo=` deep link path is preserved for repos in the curated list.

## Out of scope (explicit)

- Pagination, infinite scroll, or virtualisation. The list is 100 rows; rendering 6 visible at a time on canvas is trivial.
- Search ranking heuristics. Plain substring filter only.
- Multi-language UI. English only, matching today.
- Re-running the fetch script from a UI button. CLI only.
