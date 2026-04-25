# Curated Repos Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text title screen with a scrollable list of 100 curated GitHub repos, fed entirely by static JSON pre-baked by a bash fetch script. The running game makes zero GitHub API calls.

**Architecture:** New `src/scenes/homepage.ts` renders a 100-row scrollable list with a substring filter input. Two-tier JSON in `public/data/`: a small index (`repos.json`) for the homepage, plus per-repo full level data (`repos/<owner>__<name>.json`) loaded lazily on click. A new bash script `scripts/fetch-repos.sh` reads `scripts/repos.txt`, fetches everything from the GitHub REST API, downloads avatars to `public/avatars/`, and writes both JSON tiers. All live-fetch code (`github-client.ts`, `mock-data.ts`, `token-prompt.ts`, `title.ts`) is deleted.

**Tech Stack:** TypeScript, Vite, Vitest, plain Canvas 2D (no game framework), bash + curl + jq for the fetch script.

**Spec:** `docs/superpowers/specs/2026-04-25-curated-repos-homepage-design.md`

---

## File Structure

### New files
- `games/invaders/scripts/repos.txt` — input list (one `owner/name` per line, `#` comments)
- `games/invaders/scripts/fetch-repos.sh` — bash fetch script
- `games/invaders/src/data/repos-loader.ts` — JSON types + loaders + ContributorStats mapper
- `games/invaders/src/scenes/homepage.ts` — homepage scene
- `games/invaders/src/ui/homepage-filter.ts` — pure filter helpers (testable in isolation)
- `games/invaders/src/tests/repos-loader.test.ts`
- `games/invaders/src/tests/homepage-filter.test.ts`
- `games/invaders/public/data/.gitkeep` — keep dir even when empty
- `games/invaders/public/avatars/.gitkeep` — keep dir even when empty

### Modified files
- `games/invaders/src/data/contributor-profile.ts` — drop `GitHubUser` import; define local `ContributorUserOverride`
- `games/invaders/src/main.ts` — boot mounts `HomepageScene`; remove `loadRealRepo`/`startGameFromMock`
- `games/invaders/src/scenes/deep-link-intro.ts` — only used for repos in the JSON index

### Deleted files
- `games/invaders/src/data/github-client.ts`
- `games/invaders/src/data/mock-data.ts`
- `games/invaders/src/ui/token-prompt.ts`
- `games/invaders/src/scenes/title.ts`
- `games/invaders/src/tests/token-prompt.test.ts`

### Touched in deletion sweep (cleanup of dead deps inside surviving files)
- `games/invaders/src/data/contributor-stats.ts` — remove `aggregateDaily` and `pickBiggestCommit` (they import `GitHubCommit` and have no callers after main.ts is rewired)

---

## Conventions

- All commands run from `games/invaders/` unless noted otherwise.
- Tests run with `pnpm test` (vitest).
- Typecheck with `pnpm typecheck`.
- Build with `pnpm build`.
- Each task ends with a commit. Commit messages use the existing repo style: terse lowercase subject (see `git log --format=%s -10` — single-word commits like "files", "analytics" are common; we'll write slightly more descriptive subjects).

---

## Task 1: Decouple `contributor-profile.ts` from `github-client.ts`

**Why:** `github-client.ts` is being deleted in Task 11. `contributor-profile.ts` currently imports `GitHubUser` from it. Move the minimal field set into a local interface so `contributor-profile.ts` is self-sufficient.

**Files:**
- Modify: `games/invaders/src/data/contributor-profile.ts`

- [ ] **Step 1: Read the current file**

```bash
cat src/data/contributor-profile.ts | head -45
```

- [ ] **Step 2: Replace the `GitHubUser` import with a local interface**

In `src/data/contributor-profile.ts`, replace lines 1–37 with:

```ts
import type { ContributorStats } from './contributor-stats.js';

export interface BiggestContribution {
  date: string;
  message: string;
  sha: string;
  additions: number;
  deletions: number;
  commits: number;
}

export interface ContributorProfile {
  login: string;
  avatarUrl: string;
  avatarImage?: HTMLImageElement;
  totalCommits: number;
  longestStreak: number;
  currentStreak: number;
  bestDay: { date: string; count: number };
  mostActiveWeekday: string;
  activeDays: number;
  weekdayCounts: number[];
  location: string;
  followers: number;
  publicRepos: number;
  topLanguage: string;
  joinedYear: number;
  bio: string;
  biggestContribution: BiggestContribution;
}

// Minimal subset of fields used to override profile defaults. Field names
// match the GitHub REST `/users/:login` response so existing callers and
// the bash fetch script can pass values through without remapping.
export interface ContributorUserOverride {
  avatar_url?: string;
  location?: string;
  followers?: number;
  public_repos?: number;
  created_at?: string; // ISO 8601
  bio?: string;
}

export interface ProfileOverrides {
  user?: ContributorUserOverride;
  language?: string | null;
  avatarImage?: HTMLImageElement;
}
```

(Leave the rest of the file — the constants, `hashString`, and `computeContributorProfile` body — unchanged.)

- [ ] **Step 3: Verify typecheck still passes**

Run: `pnpm typecheck`
Expected: clean exit.

- [ ] **Step 4: Verify tests still pass**

Run: `pnpm test`
Expected: same 20 tests pass as before.

- [ ] **Step 5: Commit**

```bash
git add src/data/contributor-profile.ts
git commit -m "decouple contributor-profile from github-client types"
```

---

## Task 2: Define `repos-loader.ts` types and `loadIndex` (TDD)

**Why:** Foundation of the new data layer. The homepage needs `RepoIndex` to render rows; everything else builds on this.

**Files:**
- Create: `games/invaders/src/data/repos-loader.ts`
- Create: `games/invaders/src/tests/repos-loader.test.ts`

- [ ] **Step 1: Write failing tests for `loadIndex`**

Create `src/tests/repos-loader.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadIndex, type RepoIndex } from '../data/repos-loader.js';

const FIXTURE: RepoIndex = {
  generatedAt: '2026-04-25T10:30:00Z',
  repos: [
    {
      owner: 'facebook',
      name: 'react',
      language: 'JavaScript',
      description: 'A library.',
      totalContributions: 12345,
      top5: [
        { login: 'gaearon', avatarPath: 'avatars/gaearon.png', contributions: 4000, isBoss: true },
      ],
    },
  ],
};

describe('loadIndex', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns the index JSON on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => FIXTURE,
    } as Response);
    const result = await loadIndex();
    expect(result.repos[0]?.owner).toBe('facebook');
    expect(result.repos[0]?.top5[0]?.isBoss).toBe(true);
  });

  it('throws a descriptive error when fetch returns non-OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    await expect(loadIndex()).rejects.toThrow(/404/);
  });

  it('throws when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(loadIndex()).rejects.toThrow(/network down/);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm test src/tests/repos-loader.test.ts`
Expected: FAIL — module not found at `../data/repos-loader.js`.

- [ ] **Step 3: Create `src/data/repos-loader.ts`**

```ts
const BASE = import.meta.env.BASE_URL;
const dataUrl = (p: string): string => `${BASE}data/${p.replace(/^\/+/, '')}`;

export interface RepoIndexTop5Entry {
  login: string;
  avatarPath: string;
  contributions: number;
  isBoss: boolean;
}

export interface RepoIndexEntry {
  owner: string;
  name: string;
  language: string;
  description: string;
  totalContributions: number;
  top5: RepoIndexTop5Entry[];
}

export interface RepoIndex {
  generatedAt: string;
  repos: RepoIndexEntry[];
}

export async function loadIndex(): Promise<RepoIndex> {
  const res = await fetch(dataUrl('repos.json'));
  if (!res.ok) {
    throw new Error(`failed to load repos.json: HTTP ${res.status}`);
  }
  return (await res.json()) as RepoIndex;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test src/tests/repos-loader.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/data/repos-loader.ts src/tests/repos-loader.test.ts
git commit -m "add repos-loader.loadIndex with tests"
```

---

## Task 3: Add `loadRepo` + `repoFileToContribStats` mapping (TDD)

**Why:** The click → game flow needs to load a per-repo JSON and map it to the existing `ContributorStats` and `ProfileOverrides` shapes that `contributorToLevel` already expects.

**Files:**
- Modify: `games/invaders/src/data/repos-loader.ts`
- Modify: `games/invaders/src/tests/repos-loader.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/tests/repos-loader.test.ts`:

```ts
import { loadRepo, repoFileToLevels, type RepoFile } from '../data/repos-loader.js';

const REPO_FIXTURE: RepoFile = {
  owner: 'facebook',
  name: 'react',
  language: 'JavaScript',
  contributors: [
    {
      login: 'kassens',
      avatarPath: 'avatars/kassens.png',
      totalCommits: 100,
      daily: Array.from({ length: 365 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        count: i % 5,
      })),
      biggestCommit: { sha: 'abc1234', date: '2025-04-01', message: 'big change', commitsThatDay: 4 },
      profile: { location: 'Berlin', followers: 100, publicRepos: 20, joinedYear: 2014, bio: 'hi' },
    },
    {
      login: 'gaearon',
      avatarPath: 'avatars/gaearon.png',
      totalCommits: 500,
      daily: Array.from({ length: 365 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        count: (i % 4) + 1,
      })),
      biggestCommit: { sha: 'def5678', date: '2025-05-15', message: 'huge refactor', commitsThatDay: 12 },
      profile: { location: 'SF', followers: 9000, publicRepos: 50, joinedYear: 2010, bio: 'react' },
    },
  ],
};

describe('loadRepo', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('fetches the per-repo JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => REPO_FIXTURE,
    } as Response);
    const result = await loadRepo('facebook', 'react');
    expect(result.contributors).toHaveLength(2);
    expect(result.contributors[1]?.login).toBe('gaearon');
  });

  it('builds the URL with owner__name format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPO_FIXTURE } as Response);
    globalThis.fetch = fetchMock;
    await loadRepo('facebook', 'react');
    const url = fetchMock.mock.calls[0]?.[0];
    expect(String(url)).toMatch(/data\/repos\/facebook__react\.json$/);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadRepo('foo', 'bar')).rejects.toThrow(/404/);
  });
});

describe('repoFileToLevels', () => {
  it('returns 5 levels worst-first when given a repo with multiple contributors', () => {
    // The fixture only has 2 contributors; build a 5-contributor variant.
    const big: RepoFile = {
      ...REPO_FIXTURE,
      contributors: Array.from({ length: 5 }, (_, i) => ({
        ...REPO_FIXTURE.contributors[0]!,
        login: `user${i + 1}`,
      })),
    };
    const { levels, ranks } = repoFileToLevels(big);
    expect(levels).toHaveLength(5);
    expect(ranks).toEqual([5, 4, 3, 2, 1]);
    expect(levels[0]?.contributor.login).toBe('user1');
    expect(levels[4]?.contributor.login).toBe('user5');
  });

  it('preserves daily commit data on the level profile', () => {
    const big: RepoFile = {
      ...REPO_FIXTURE,
      contributors: Array.from({ length: 5 }, (_, i) => ({
        ...REPO_FIXTURE.contributors[0]!,
        login: `user${i + 1}`,
      })),
    };
    const { levels } = repoFileToLevels(big);
    expect(levels[0]?.profile.totalCommits).toBe(100);
    expect(levels[0]?.profile.location).toBe('Berlin');
  });

  it('throws if the repo has fewer than 5 contributors', () => {
    expect(() => repoFileToLevels(REPO_FIXTURE)).toThrow(/at least 5/);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm test src/tests/repos-loader.test.ts`
Expected: FAIL — `loadRepo` and `repoFileToLevels` don't exist.

- [ ] **Step 3: Append the implementation**

Append to `src/data/repos-loader.ts`:

```ts
import type { ContributorStats, DailyCommitCount, RealCommit } from './contributor-stats.js';
import type { ContributorUserOverride } from './contributor-profile.js';
import { contributorToLevel, type Level } from './mapping.js';

export interface RepoFileContributor {
  login: string;
  avatarPath: string;
  totalCommits: number;
  daily: DailyCommitCount[];
  biggestCommit: RealCommit;
  profile: {
    location: string;
    followers: number;
    publicRepos: number;
    joinedYear: number;
    bio: string;
  };
}

export interface RepoFile {
  owner: string;
  name: string;
  language: string;
  contributors: RepoFileContributor[];
}

export async function loadRepo(owner: string, name: string): Promise<RepoFile> {
  const res = await fetch(dataUrl(`repos/${owner}__${name}.json`));
  if (!res.ok) {
    throw new Error(`failed to load repo data ${owner}/${name}: HTTP ${res.status}`);
  }
  return (await res.json()) as RepoFile;
}

const BASE_URL_PREFIX = (() => {
  // Mirrors how main.ts builds asset URLs so avatar paths resolve under the
  // same Vite base URL as everything else served from public/.
  return import.meta.env.BASE_URL;
})();

function avatarUrl(avatarPath: string): string {
  return `${BASE_URL_PREFIX}${avatarPath.replace(/^\/+/, '')}`;
}

export function repoFileToLevels(repo: RepoFile): { levels: Level[]; ranks: number[] } {
  if (repo.contributors.length < 5) {
    throw new Error(`repo ${repo.owner}/${repo.name} has fewer than 5 contributors in JSON`);
  }
  // The per-repo JSON stores contributors weakest-first (rank #5 → rank #1).
  // Levels[0] = weakest, levels[N-1] = boss; this matches what main.ts expected
  // from the old loadRealRepo path.
  const five = repo.contributors.slice(0, 5);
  const levels: Level[] = five.map((c, idx) => {
    const stats: ContributorStats = {
      login: c.login,
      avatarUrl: avatarUrl(c.avatarPath),
      totalCommits: c.totalCommits,
      daily: c.daily,
      biggestCommit: c.biggestCommit,
    };
    const user: ContributorUserOverride = {
      avatar_url: avatarUrl(c.avatarPath),
      location: c.profile.location,
      followers: c.profile.followers,
      public_repos: c.profile.publicRepos,
      created_at: `${c.profile.joinedYear}-01-01T00:00:00Z`,
      bio: c.profile.bio,
    };
    return contributorToLevel(
      stats,
      { id: c.login, login: c.login, name: c.login },
      idx,
      { user, language: repo.language },
    );
  });
  const ranks = five.map((_, idx) => five.length - idx); // [5, 4, 3, 2, 1]
  return { levels, ranks };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test src/tests/repos-loader.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/data/repos-loader.ts src/tests/repos-loader.test.ts
git commit -m "add repos-loader.loadRepo and repoFileToLevels mapper"
```

---

## Task 4: Pure filter helpers in `homepage-filter.ts` (TDD)

**Why:** The homepage scene's filter and scroll logic is easier to test as pure functions. Keep the scene file focused on rendering.

**Files:**
- Create: `games/invaders/src/ui/homepage-filter.ts`
- Create: `games/invaders/src/tests/homepage-filter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/homepage-filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterRepos, clampScroll, type FilterableRepo } from '../ui/homepage-filter.js';

const REPOS: FilterableRepo[] = [
  { owner: 'facebook', name: 'react' },
  { owner: 'vitejs', name: 'vite' },
  { owner: 'microsoft', name: 'TypeScript' },
  { owner: 'nodejs', name: 'node' },
  { owner: 'tanstack', name: 'query' },
];

describe('filterRepos', () => {
  it('returns all repos when query is empty', () => {
    expect(filterRepos(REPOS, '')).toEqual(REPOS);
  });

  it('returns all repos when query is whitespace only', () => {
    expect(filterRepos(REPOS, '   ')).toEqual(REPOS);
  });

  it('matches substring on owner', () => {
    const result = filterRepos(REPOS, 'face');
    expect(result.map((r) => r.name)).toEqual(['react']);
  });

  it('matches substring on name', () => {
    const result = filterRepos(REPOS, 'vit');
    expect(result.map((r) => r.owner)).toEqual(['vitejs']);
  });

  it('matches across the slash (owner/name)', () => {
    const result = filterRepos(REPOS, 'js/v');
    expect(result.map((r) => r.name)).toEqual(['vite']);
  });

  it('is case insensitive', () => {
    const result = filterRepos(REPOS, 'TYPESCRIPT');
    expect(result.map((r) => r.name)).toEqual(['TypeScript']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterRepos(REPOS, 'zzz')).toEqual([]);
  });
});

describe('clampScroll', () => {
  it('returns 0 when scroll is negative', () => {
    expect(clampScroll(-50, 1000, 600)).toBe(0);
  });

  it('returns the requested value when within bounds', () => {
    expect(clampScroll(120, 1000, 600)).toBe(120);
  });

  it('clamps to the maximum scroll position', () => {
    // contentHeight=1000, viewportHeight=600 → max scroll = 400.
    expect(clampScroll(900, 1000, 600)).toBe(400);
  });

  it('returns 0 when content fits in viewport', () => {
    expect(clampScroll(50, 400, 600)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm test src/tests/homepage-filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helpers**

Create `src/ui/homepage-filter.ts`:

```ts
export interface FilterableRepo {
  owner: string;
  name: string;
}

export function filterRepos<T extends FilterableRepo>(repos: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return repos;
  return repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(q));
}

export function clampScroll(scroll: number, contentHeight: number, viewportHeight: number): number {
  const max = Math.max(0, contentHeight - viewportHeight);
  if (scroll < 0) return 0;
  if (scroll > max) return max;
  return scroll;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm test src/tests/homepage-filter.test.ts`
Expected: 11 tests pass.

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/homepage-filter.ts src/tests/homepage-filter.test.ts
git commit -m "add homepage-filter pure helpers with tests"
```

---

## Task 5: `HomepageScene` skeleton (renders index, no input yet)

**Why:** Get the visual scaffold rendering before adding interactivity. This lets us eyeball the layout in a browser before wiring up scroll/click.

**Files:**
- Create: `games/invaders/src/scenes/homepage.ts`

This task does not have a unit test — the scene is a thin renderer over `Renderer` + DOM that we'll smoke-test manually in the browser. Behaviour-bearing logic (filter, scroll math) is already covered in Task 4.

- [ ] **Step 1: Read the existing `title.ts` for layout patterns**

```bash
cat src/scenes/title.ts | head -40
cat src/scenes/title.ts | sed -n '180,260p'
```

This gives you: how the existing title scene wires `renderer.beginFrame()`, draws stars, draws text with `ctx.font`/`ctx.fillText`, and exposes `.update(dt)` / `.render()` / `dispose()` lifecycle.

- [ ] **Step 2: Create the skeleton scene**

Create `src/scenes/homepage.ts`:

```ts
import type { Renderer, ParticleEmitter, AudioBus } from '@osi/engine';
import type { Scene } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { loadIndex, type RepoIndex, type RepoIndexEntry } from '../data/repos-loader.js';
import { filterRepos, clampScroll } from '../ui/homepage-filter.js';

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 40;
const VIEWPORT_TOP = HEADER_HEIGHT;
const VIEWPORT_HEIGHT = BALANCE.viewportHeight - HEADER_HEIGHT - FOOTER_HEIGHT;

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  'C++': '#f34b7d',
  Java: '#b07219',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
};

export class HomepageScene implements Scene {
  private index: RepoIndex | null = null;
  private filter = '';
  private scroll = 0;
  private avatars = new Map<string, HTMLImageElement>();
  private loadError: string | null = null;

  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onSelect: (repoFullName: string) => void,
    private audio: AudioBus,
    private touch: boolean,
  ) {
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      this.index = await loadIndex();
      // Preload avatars in parallel; failures are non-fatal (placeholder renders).
      const uniquePaths = new Set<string>();
      for (const repo of this.index.repos) {
        for (const entry of repo.top5) uniquePaths.add(entry.avatarPath);
      }
      const base = (path: string): string =>
        `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
      await Promise.all(
        Array.from(uniquePaths).map(
          (path) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                this.avatars.set(path, img);
                resolve();
              };
              img.onerror = () => resolve(); // placeholder will render
              img.src = base(path);
            }),
        ),
      );
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'unknown error';
    }
  }

  update(dt: number): void {
    this.stars.update(dt);
  }

  render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();
    // Background stars
    this.stars.render(ctx);
    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('// pick your battle', 24, 24);
    // Filter input pill (skeleton — non-interactive)
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 50, W - 48, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    const filterText = this.filter.length > 0 ? this.filter : 'filter…';
    ctx.fillText(`>_ ${filterText}`, 32, 54);

    // Loading / error states
    if (this.loadError) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No repos yet. Run scripts/fetch-repos.sh.', W / 2, H / 2 - 8);
      ctx.textAlign = 'left';
      this.renderer.endFrame();
      return;
    }
    if (!this.index) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('loading…', W / 2, H / 2);
      ctx.textAlign = 'left';
      this.renderer.endFrame();
      return;
    }

    // List viewport (clipped scroll region)
    const visibleRepos = filterRepos(this.index.repos, this.filter);
    const contentHeight = visibleRepos.length * ROW_HEIGHT;
    this.scroll = clampScroll(this.scroll, contentHeight, VIEWPORT_HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, VIEWPORT_TOP, W, VIEWPORT_HEIGHT);
    ctx.clip();
    for (let i = 0; i < visibleRepos.length; i++) {
      const repo = visibleRepos[i]!;
      const y = VIEWPORT_TOP + i * ROW_HEIGHT - this.scroll;
      if (y + ROW_HEIGHT < VIEWPORT_TOP) continue;
      if (y > VIEWPORT_TOP + VIEWPORT_HEIGHT) break;
      this.drawRow(repo, y);
    }
    ctx.restore();

    // Footer hint
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↑ ↓ scroll · ENTER launch · ESC clear filter', W / 2, H - 24);
    ctx.textAlign = 'left';

    this.renderer.endFrame();
  }

  private drawRow(repo: RepoIndexEntry, y: number): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    // Repo name + language tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    ctx.fillText(`${repo.owner}/${repo.name}`, 24, y + 16);
    const langColor = LANGUAGE_COLORS[repo.language] ?? '#aaaaaa';
    const nameWidth = ctx.measureText(`${repo.owner}/${repo.name}`).width;
    ctx.fillStyle = langColor;
    ctx.beginPath();
    ctx.arc(24 + nameWidth + 16, y + 22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillText(repo.language, 24 + nameWidth + 28, y + 16);
    // Stat
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillText(`${repo.totalContributions.toLocaleString()} commits last year`, 24, y + 44);
    // Avatars (right-aligned). Boss is 1.6× the size of regulars.
    const REGULAR = 32;
    const BOSS = 52;
    const GAP = 8;
    const totalWidth = REGULAR * 4 + BOSS + GAP * 4;
    const startX = W - 24 - totalWidth;
    const sortedTop5 = [...repo.top5].sort((a, b) => Number(a.isBoss) - Number(b.isBoss));
    let x = startX;
    for (const entry of sortedTop5) {
      const size = entry.isBoss ? BOSS : REGULAR;
      const cy = y + ROW_HEIGHT / 2;
      const img = this.avatars.get(entry.avatarPath);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, x, cy - size / 2, size, size);
        ctx.restore();
      } else {
        // Initial-letter placeholder
        ctx.fillStyle = '#21262d';
        ctx.beginPath();
        ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(size * 0.5)}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((entry.login[0] ?? '?').toUpperCase(), x + size / 2, cy + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
      x += size + GAP;
    }
  }

  dispose(): void {
    // No DOM to clean up yet (added in Task 6 when input handling lands).
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean exit. (The scene is created but not yet wired into `main.ts`. That happens in Task 9.)

- [ ] **Step 4: Verify all tests still pass**

Run: `pnpm test`
Expected: all tests pass (no tests changed; this is just a typecheck-clean addition).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homepage.ts
git commit -m "add HomepageScene skeleton (render-only, no input yet)"
```

---

## Task 6: `HomepageScene` keyboard + scroll input

**Why:** Wire keyboard navigation and mouse-wheel scrolling. Click handling lands in Task 7 once we have a clear focused row.

**Files:**
- Modify: `games/invaders/src/scenes/homepage.ts`

- [ ] **Step 1: Add focus state and keyboard listeners**

In `src/scenes/homepage.ts`, add a `focusIndex` field (the index into the *filtered* list) and bind keyboard handlers in the constructor.

Add to the class body, just below the `loadError` field:

```ts
  private focusIndex = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
```

Inside the constructor (after `void this.boot();`), append:

```ts
    this.keydownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    this.wheelHandler = (e: WheelEvent) => this.onWheel(e);
    window.addEventListener('keydown', this.keydownHandler);
    this.renderer.main.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
```

Add new methods to the class:

```ts
  private onKeyDown(e: KeyboardEvent): void {
    if (!this.index) return;
    const visible = filterRepos(this.index.repos, this.filter);
    if (visible.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      const step = e.key === 'PageDown' ? Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT) : 1;
      this.focusIndex = Math.min(visible.length - 1, this.focusIndex + step);
      this.ensureFocusVisible(visible.length);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      const step = e.key === 'PageUp' ? Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT) : 1;
      this.focusIndex = Math.max(0, this.focusIndex - step);
      this.ensureFocusVisible(visible.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.focusIndex = 0;
      this.scroll = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      this.focusIndex = visible.length - 1;
      this.scroll = clampScroll(visible.length * ROW_HEIGHT, visible.length * ROW_HEIGHT, VIEWPORT_HEIGHT);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.index) return;
    const visible = filterRepos(this.index.repos, this.filter);
    this.scroll = clampScroll(this.scroll + e.deltaY, visible.length * ROW_HEIGHT, VIEWPORT_HEIGHT);
  }

  private ensureFocusVisible(visibleCount: number): void {
    const focusY = this.focusIndex * ROW_HEIGHT;
    if (focusY < this.scroll) {
      this.scroll = focusY;
    } else if (focusY + ROW_HEIGHT > this.scroll + VIEWPORT_HEIGHT) {
      this.scroll = focusY + ROW_HEIGHT - VIEWPORT_HEIGHT;
    }
    this.scroll = clampScroll(this.scroll, visibleCount * ROW_HEIGHT, VIEWPORT_HEIGHT);
  }
```

Update `dispose()`:

```ts
  dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler) {
      this.renderer.main.canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
  }
```

- [ ] **Step 2: Highlight the focused row in `drawRow`**

Find `drawRow` and update its signature to accept the focused state:

```ts
  private drawRow(repo: RepoIndexEntry, y: number, focused: boolean): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    if (focused) {
      ctx.fillStyle = 'rgba(57, 211, 83, 0.10)';
      ctx.fillRect(8, y + 4, W - 16, ROW_HEIGHT - 8);
      ctx.strokeStyle = '#39d353';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, y + 4, W - 16, ROW_HEIGHT - 8);
    }
    // ...rest of drawRow body unchanged below this line
```

Update the call site in `render()` (the loop body) to pass the focused flag:

```ts
    for (let i = 0; i < visibleRepos.length; i++) {
      const repo = visibleRepos[i]!;
      const y = VIEWPORT_TOP + i * ROW_HEIGHT - this.scroll;
      if (y + ROW_HEIGHT < VIEWPORT_TOP) continue;
      if (y > VIEWPORT_TOP + VIEWPORT_HEIGHT) break;
      this.drawRow(repo, y, i === this.focusIndex);
    }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean exit.

- [ ] **Step 4: Verify all tests still pass**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homepage.ts
git commit -m "add keyboard nav and wheel scrolling to HomepageScene"
```

---

## Task 7: `HomepageScene` filter input + click-to-launch

**Why:** Final layer of interactivity. The scene now lets the user filter, focus, and launch.

**Files:**
- Modify: `games/invaders/src/scenes/homepage.ts`

- [ ] **Step 1: Extend `onKeyDown` to capture filter input + Enter**

In the existing `onKeyDown` body, **add** these branches near the top (before the ArrowDown check):

```ts
    if (e.key === 'Enter') {
      e.preventDefault();
      const visible = filterRepos(this.index!.repos, this.filter);
      const target = visible[this.focusIndex];
      if (target) this.onSelect(`${target.owner}/${target.name}`);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.filter = '';
      this.focusIndex = 0;
      this.scroll = 0;
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (this.filter.length > 0) {
        this.filter = this.filter.slice(0, -1);
        this.focusIndex = 0;
        this.scroll = 0;
      }
      return;
    }
    // Printable characters: append to filter (length-limited)
    if (e.key.length === 1 && /[\w./-]/.test(e.key) && this.filter.length < 40) {
      e.preventDefault();
      this.filter += e.key.toLowerCase();
      this.focusIndex = 0;
      this.scroll = 0;
      return;
    }
```

(The ArrowDown/ArrowUp/PageUp/PageDown/Home/End branches stay below, unchanged.)

- [ ] **Step 2: Add a click handler on the canvas**

In the constructor (next to the wheel listener), add:

```ts
    this.clickHandler = (e: MouseEvent) => this.onClick(e);
    this.renderer.main.canvas.addEventListener('click', this.clickHandler);
```

Add the field at the top of the class (next to `wheelHandler`):

```ts
  private clickHandler: ((e: MouseEvent) => void) | null = null;
```

Add the method:

```ts
  private onClick(e: MouseEvent): void {
    if (!this.index) return;
    const canvas = this.renderer.main.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = parseFloat(canvas.dataset.osiDpr ?? '') || (window.devicePixelRatio || 1);
    const scaleX = canvas.width / dpr / rect.width;
    const scaleY = canvas.height / dpr / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    if (cy < VIEWPORT_TOP || cy > VIEWPORT_TOP + VIEWPORT_HEIGHT) return;
    if (cx < 0 || cx > BALANCE.viewportWidth) return;
    const visible = filterRepos(this.index.repos, this.filter);
    const i = Math.floor((cy - VIEWPORT_TOP + this.scroll) / ROW_HEIGHT);
    const target = visible[i];
    if (target) this.onSelect(`${target.owner}/${target.name}`);
  }
```

Update `dispose()` to remove the click handler too:

```ts
  dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler) {
      this.renderer.main.canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.clickHandler) {
      this.renderer.main.canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean exit.

- [ ] **Step 4: Verify all tests still pass**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homepage.ts
git commit -m "wire filter input and click-to-launch in HomepageScene"
```

---

## Task 8: Wire `HomepageScene` into `main.ts` and rewrite the deep-link path

**Why:** Replace `TitleScene` at boot. Strip out `loadRealRepo`, `startGameFromMock`, and all related token/rate-limit handling. Deep-link `?repo=` only succeeds for repos in the index.

**Files:**
- Modify: `games/invaders/src/main.ts`

- [ ] **Step 1: Replace the imports block**

Replace lines 1–17 of `src/main.ts` with:

```ts
import {
  Renderer, GameLoop, Keyboard, InputMap, SceneManager,
  SpriteAtlas, ParticleEmitter, ScreenShake, AudioBus, Sfx,
} from '@osi/engine';

import { BALANCE } from './config/balance.js';
import { loadIndex, loadRepo, repoFileToLevels, type RepoIndex } from './data/repos-loader.js';
import type { Level } from './data/mapping.js';
import { createGameStats, type GameStats } from './scenes/gameplay-context.js';

import { HomepageScene } from './scenes/homepage.js';
import { DeepLinkIntroScene } from './scenes/deep-link-intro.js';
import { LoadingScene } from './scenes/loading.js';
import { LevelIntroScene } from './scenes/level-intro.js';
import { GameplayScene, type GameplayDeps } from './scenes/gameplay.js';
import { BossIntroScene } from './scenes/boss-intro.js';
import { BossScene } from './scenes/boss.js';
import { VictoryScene } from './scenes/victory.js';
import { PauseScene } from './scenes/pause.js';
import { GameOverScene } from './scenes/game-over.js';
import { LevelCompleteScene } from './scenes/level-complete.js';
import { CanvasScaler } from './ui/canvas-scaler.js';
import { TouchControls } from './ui/touch-controls.js';
import { isTouchDevice } from './ui/touch-detect.js';
import { trackGameStart, trackLevelComplete, trackBossDefeated, trackGameOver, trackVictory } from './ui/analytics.js';
```

(Removed: `getMockRepoData`, the `contributorToLevel` re-export, the github-client imports, `promptForToken`. Added: `repos-loader` imports, `HomepageScene`.)

- [ ] **Step 2: Replace the `boot()` function**

Find the `boot()` function (currently lines ~94–177) and replace its entire body with:

```ts
async function boot(): Promise<void> {
  try {
    await atlas.load(
      assetUrl('assets/kenney-space-shooter/sheet.png'),
      assetUrl('assets/kenney-space-shooter/sheet.xml'),
    );
    console.log('[invaders] atlas loaded');
  } catch (err) {
    console.warn('[invaders] sprite atlas missing — falling back to colored rects', err);
  }

  await audio.init();
  try {
    await sfx.load({
      shoot: assetUrl('assets/sfx/shoot.wav'),
      enemy_shoot: assetUrl('assets/sfx/enemy_shoot.wav'),
      hit_soft: assetUrl('assets/sfx/hit_soft.wav'),
      hit_hard: assetUrl('assets/sfx/hit_hard.wav'),
      explode_small: assetUrl('assets/sfx/explode_small.wav'),
      explode_big: assetUrl('assets/sfx/explode_big.wav'),
      powerup_drop: assetUrl('assets/sfx/powerup_drop.wav'),
      powerup_get: assetUrl('assets/sfx/powerup_get.wav'),
      level_up: assetUrl('assets/sfx/level_up.wav'),
      boss_phase: assetUrl('assets/sfx/boss_phase.wav'),
      boss_roar: assetUrl('assets/sfx/boss_roar.wav'),
      boss_die: assetUrl('assets/sfx/boss_die.wav'),
      ui_hover: assetUrl('assets/sfx/ui_hover.wav'),
      ui_click: assetUrl('assets/sfx/ui_click.wav'),
      level_complete: assetUrl('assets/sfx/level_complete.wav'),
      game_over: assetUrl('assets/sfx/game_over.wav'),
    });
    console.log('[invaders] sfx loaded');
  } catch (err) {
    console.warn('[invaders] sfx load failed', err);
  }

  const unlockAudio = () => {
    audio.unlock();
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
  };
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
  window.addEventListener('click', unlockAudio);

  // Pre-load the repo index once at boot. Deep-link path needs it; homepage
  // also reloads it but a cached fetch is fine.
  let cachedIndex: RepoIndex | null = null;
  try {
    cachedIndex = await loadIndex();
  } catch (err) {
    console.warn('[invaders] failed to load repos.json', err);
  }

  const params = new URLSearchParams(window.location.search);
  const deepLink = params.get('repo') ?? params.get('load');
  const isInIndex = (full: string): boolean => {
    if (!cachedIndex) return false;
    const [o, n] = full.split('/');
    return cachedIndex.repos.some((r) => r.owner === o && r.name === n);
  };

  if (deepLink && /^[\w.-]+\/[\w.-]+$/.test(deepLink) && isInIndex(deepLink)) {
    const intro = new DeepLinkIntroScene(
      renderer,
      deepLink,
      particles.stars,
      sfx,
      audio,
      () => startGame(deepLink),
      touch,
    );
    sceneManager.push(intro);
  } else {
    sceneManager.push(new HomepageScene(renderer, particles.stars, (repo) => startGame(repo), audio, touch));
  }

  gameLoop.start();
}
```

- [ ] **Step 3: Replace `startGame`, delete `loadRealRepo`, `startGameFromMock`**

Find `startGame()` (currently around line 179) and replace it through the end of `startGameFromMock()` with:

```ts
function startGame(repoFullName: string): void {
  trackGameStart(repoFullName);
  const loading = new LoadingScene(renderer, atlas, particles.stars, kb);
  sceneManager.replace(loading);
  void loadAndLaunch(repoFullName, loading).catch((err) => {
    console.error('[invaders] failed to load repo data', err);
    sceneManager.clear();
    sceneManager.push(new HomepageScene(renderer, particles.stars, (r) => startGame(r), audio, touch));
  });
}

async function loadAndLaunch(repoFullName: string, loading: LoadingScene): Promise<void> {
  const [owner, name] = repoFullName.split('/');
  if (!owner || !name) throw new Error(`malformed repo name: ${repoFullName}`);
  loading.setProgress(0.2, `loading ${repoFullName}`);
  const file = await loadRepo(owner, name);
  loading.setProgress(0.8, 'building levels');
  const { levels, ranks } = repoFileToLevels(file);
  loading.setProgress(1, 'ready');
  const stats = createGameStats();
  setTimeout(() => launchLevel(0, levels, ranks, repoFullName, stats), 250);
}
```

(Everything from `function launchLevel(...)` onwards stays unchanged.)

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean exit. (At this point `github-client.ts`, `mock-data.ts`, `token-prompt.ts`, and `title.ts` still exist on disk but are no longer imported by anything. They get deleted in Task 11.)

- [ ] **Step 5: Verify all tests still pass**

Run: `pnpm test`
Expected: tests pass. (`token-prompt.test.ts` still imports from a still-present file, so it continues to pass.)

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "wire HomepageScene at boot, drop loadRealRepo/loadMock paths"
```

---

## Task 9: `scripts/repos.txt` + `scripts/fetch-repos.sh`

**Why:** The data tier the homepage and game depend on. After this task, you (the user) run the script once with `GITHUB_TOKEN` set to populate `public/data/` and `public/avatars/`.

**Files:**
- Create: `games/invaders/scripts/repos.txt`
- Create: `games/invaders/scripts/fetch-repos.sh`
- Create: `games/invaders/public/data/.gitkeep`
- Create: `games/invaders/public/avatars/.gitkeep`

- [ ] **Step 1: Create `repos.txt` with placeholder content**

Create `scripts/repos.txt`:

```
# One owner/name per line. Lines starting with # are ignored.
# Run scripts/fetch-repos.sh after editing this file.
# Example entries (uncomment to test):
# facebook/react
# vitejs/vite
# microsoft/typescript
```

- [ ] **Step 2: Create the directory keep-files**

```bash
mkdir -p public/data/repos public/avatars
echo "# preserved for git" > public/data/.gitkeep
echo "# preserved for git" > public/avatars/.gitkeep
```

- [ ] **Step 3: Write `fetch-repos.sh`**

Create `scripts/fetch-repos.sh`:

```bash
#!/usr/bin/env bash
# Fetches GitHub data for the curated repo list and writes static JSON.
#
# Reads:   scripts/repos.txt (one owner/name per line; # comments allowed)
# Writes:  public/data/repos.json
#          public/data/repos/<owner>__<name>.json
#          public/avatars/<login>.png
#
# Requires: bash, curl, jq, awk. GITHUB_TOKEN env var (PAT with public_repo).
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx ./scripts/fetch-repos.sh           # incremental (skips fresh files)
#   GITHUB_TOKEN=ghp_xxx ./scripts/fetch-repos.sh --force   # re-fetch everything

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOS_FILE="$SCRIPT_DIR/repos.txt"
DATA_DIR="$ROOT_DIR/public/data"
REPOS_DATA_DIR="$DATA_DIR/repos"
AVATARS_DIR="$ROOT_DIR/public/avatars"
INDEX_FILE="$DATA_DIR/repos.json"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then FORCE=1; fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN env var is not set." >&2
  echo "Generate a personal access token at https://github.com/settings/tokens" >&2
  echo "(public_repo scope is sufficient), then re-run with:" >&2
  echo "  GITHUB_TOKEN=ghp_xxx $0" >&2
  exit 1
fi

for cmd in curl jq awk; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found in PATH." >&2
    exit 1
  fi
done

mkdir -p "$REPOS_DATA_DIR" "$AVATARS_DIR"

since_iso="$(date -u -v-365d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
  || date -u -d '365 days ago' '+%Y-%m-%dT%H:%M:%SZ')"

api() {
  # Single GitHub REST call. $1 = path, output = body on stdout, fails on HTTP >= 400.
  local path="$1"
  curl -sS --fail-with-body \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$path"
}

# is_fresh <file> — true if file exists and is younger than 7 days.
is_fresh() {
  local f="$1"
  [[ -f "$f" ]] && [[ $(($(date +%s) - $(stat -f %m "$f" 2>/dev/null \
    || stat -c %Y "$f"))) -lt 604800 ]]
}

download_avatar() {
  local login="$1" url="$2"
  local out="$AVATARS_DIR/$login.png"
  if [[ -f "$out" ]] && [[ "$FORCE" -eq 0 ]]; then return 0; fi
  curl -sSL "${url}?s=200" -o "$out" || {
    echo "  WARN: avatar download failed for $login" >&2
    rm -f "$out"
  }
}

# Fetch all commits by an author since since_iso, paged up to 3×100.
# Outputs a JSON array of commits to stdout.
fetch_commits() {
  local owner="$1" name="$2" login="$3"
  local page=1 acc='[]'
  while [[ $page -le 3 ]]; do
    local resp
    resp="$(api "/repos/$owner/$name/commits?author=$login&since=$since_iso&per_page=100&page=$page" || echo '[]')"
    local count
    count="$(echo "$resp" | jq 'length')"
    acc="$(jq -s '.[0] + .[1]' <(echo "$acc") <(echo "$resp"))"
    if [[ "$count" -lt 100 ]]; then break; fi
    page=$((page + 1))
  done
  echo "$acc"
}

# Aggregate a commits array into a 365-day daily array.
# stdin: commits JSON
# stdout: { "daily": [...], "biggestCommit": {...} | null }
aggregate_jq='
  def days_back(n): [range(0; n) | now - (. * 86400) | strftime("%Y-%m-%dT00:00:00Z") | .[:10]];
  . as $commits
  | (now | strftime("%Y-%m-%d")) as $today
  | (days_back(365) | reverse) as $window
  | reduce $commits[] as $c (
      {};
      . + (
        $c.commit.author.date[0:10] as $d
        | { ($d): ((.[$d] // 0) + 1) }
      )
    ) as $byDay
  | { daily:
      ( $window | map({ date: ., count: ($byDay[.] // 0) }) )
    }
  | . as $base
  | ( $commits
      | group_by(.commit.author.date[0:10])
      | map({ date: (.[0].commit.author.date[0:10]), commits: ., count: length })
      | max_by(.count // 0)
    ) as $busiest
  | $base + (
      if $busiest == null then { biggestCommit: null }
      else
        ($busiest.commits | max_by(.commit.message | length)) as $chosen
        | { biggestCommit: {
              sha: ($chosen.sha[0:7]),
              date: $busiest.date,
              message: (($chosen.commit.message // "") | split("\n")[0] | gsub("^\\s+|\\s+$"; "")),
              commitsThatDay: $busiest.count,
            } }
      end
    )
'

declare -a REPO_TUPLES=()  # collected (owner|name|totalContrib|file) for the index step

while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | awk '{$1=$1; print}')"
  [[ -z "$line" ]] && continue
  if [[ ! "$line" =~ ^[[:alnum:]_.-]+/[[:alnum:]_.-]+$ ]]; then
    echo "skip (invalid format): $line" >&2
    continue
  fi
  owner="${line%/*}"
  name="${line#*/}"
  out="$REPOS_DATA_DIR/${owner}__${name}.json"

  if is_fresh "$out" && [[ "$FORCE" -eq 0 ]]; then
    echo "[$owner/$name] fresh, skipping"
    total="$(jq '[.contributors[].totalCommits] | add' "$out")"
    REPO_TUPLES+=("$owner|$name|$total|$out")
    continue
  fi

  echo "[$owner/$name] fetching repo metadata"
  repo_json="$(api "/repos/$owner/$name")"
  language="$(echo "$repo_json" | jq -r '.language // ""')"
  description="$(echo "$repo_json" | jq -r '.description // ""')"

  echo "[$owner/$name] fetching contributors"
  contribs="$(api "/repos/$owner/$name/contributors?per_page=30")"
  candidates="$(echo "$contribs" | jq -c '.[:10] | map({login, avatar_url})')"

  ranked='[]'
  for row in $(echo "$candidates" | jq -c '.[]'); do
    login="$(echo "$row" | jq -r '.login')"
    avatar_url="$(echo "$row" | jq -r '.avatar_url')"
    echo "  · $login: commits"
    commits="$(fetch_commits "$owner" "$name" "$login")"
    aggregated="$(echo "$commits" | jq "$aggregate_jq")"
    total="$(echo "$aggregated" | jq '[.daily[].count] | add')"
    if [[ "$total" -le 0 ]]; then continue; fi
    echo "  · $login: profile + avatar"
    user="$(api "/users/$login" || echo '{}')"
    download_avatar "$login" "$avatar_url"
    profile="$(echo "$user" | jq '{
      location: (.location // ""),
      followers: (.followers // 0),
      publicRepos: (.public_repos // 0),
      joinedYear: ((.created_at // "2010-01-01")[:4] | tonumber),
      bio: (.bio // "")
    }')"
    contributor_obj="$(jq -n \
      --arg login "$login" \
      --arg avatarPath "avatars/$login.png" \
      --argjson totalCommits "$total" \
      --argjson agg "$aggregated" \
      --argjson profile "$profile" \
      '{ login: $login, avatarPath: $avatarPath, totalCommits: $totalCommits,
         daily: $agg.daily, biggestCommit: $agg.biggestCommit, profile: $profile }')"
    ranked="$(jq -c --argjson c "$contributor_obj" '. + [$c]' <(echo "$ranked"))"
    sleep 0.3
  done

  count="$(echo "$ranked" | jq 'length')"
  if [[ "$count" -lt 5 ]]; then
    echo "[$owner/$name] WARN: only $count contributors with last-year commits, skipping repo" >&2
    continue
  fi

  # Sort desc by totalCommits, take top 5, then reverse to weakest-first.
  top5="$(echo "$ranked" | jq -c 'sort_by(-.totalCommits) | .[:5] | reverse')"
  total_repo="$(echo "$top5" | jq '[.[].totalCommits] | add')"

  jq -n \
    --arg owner "$owner" \
    --arg name "$name" \
    --arg language "$language" \
    --argjson contributors "$top5" \
    '{ owner: $owner, name: $name, language: $language, contributors: $contributors }' \
    > "$out"
  echo "[$owner/$name] wrote $out"

  REPO_TUPLES+=("$owner|$name|$total_repo|$out")
  sleep 1
done < "$REPOS_FILE"

# Build index. Sort desc by totalContributions across all repos.
echo "[index] writing $INDEX_FILE"
index_entries='[]'
for tup in "${REPO_TUPLES[@]}"; do
  IFS='|' read -r owner name total file <<< "$tup"
  contributors="$(jq -c '.contributors' "$file")"
  language="$(jq -r '.language' "$file")"
  description="" # not stored in per-repo file; would have to be re-fetched. Leave empty.
  # Build top5 in display order (desc by contributions, boss first).
  top5="$(echo "$contributors" | jq -c '
    [.[] | { login, avatarPath, contributions: .totalCommits }]
    | sort_by(-.contributions)
    | (.[0] |= (. + { isBoss: true }))
    | .[1:] |= map(. + { isBoss: false })
  ')"
  entry="$(jq -n \
    --arg owner "$owner" \
    --arg name "$name" \
    --arg language "$language" \
    --arg description "$description" \
    --argjson totalContributions "$total" \
    --argjson top5 "$top5" \
    '{ owner: $owner, name: $name, language: $language, description: $description,
       totalContributions: $totalContributions, top5: $top5 }')"
  index_entries="$(jq -c --argjson e "$entry" '. + [$e]' <(echo "$index_entries"))"
done

jq -n \
  --arg generatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --argjson repos "$(echo "$index_entries" | jq 'sort_by(-.totalContributions)')" \
  '{ generatedAt: $generatedAt, repos: $repos }' \
  > "$INDEX_FILE"

echo "Done. ${#REPO_TUPLES[@]} repos in index."
```

- [ ] **Step 4: Make the script executable**

```bash
chmod +x scripts/fetch-repos.sh
```

- [ ] **Step 5: Smoke-test the script with a tiny `repos.txt`**

Edit `scripts/repos.txt` to have one or two known-good entries:

```
facebook/react
vitejs/vite
```

Then:

```bash
GITHUB_TOKEN=<your-token> ./scripts/fetch-repos.sh
```

Verify:
- `public/avatars/<login>.png` files exist (try `ls public/avatars/`).
- `public/data/repos/facebook__react.json` exists and has 5 contributors.
- `public/data/repos.json` exists, has 2 entries, sorted desc by `totalContributions`.

```bash
jq '.repos | length' public/data/repos.json
jq '.repos[0] | {owner, name, totalContributions, top5: (.top5 | map(.login))}' public/data/repos.json
jq '.contributors | length' public/data/repos/facebook__react.json
```

Expected: `2`, then a JSON object with `top5` listing 5 logins, then `5`.

- [ ] **Step 6: Restore `repos.txt` to placeholder state**

Re-edit `scripts/repos.txt` back to its placeholder content (keeping the example lines commented out) so the user can fill it in.

- [ ] **Step 7: Commit**

```bash
git add scripts/repos.txt scripts/fetch-repos.sh public/data/.gitkeep public/avatars/.gitkeep
git commit -m "add fetch-repos.sh + repos.txt for static data baking"
```

(Generated `public/data/repos.json`, the per-repo files, and avatar PNGs are *not* committed yet — they're regenerated by the user with their full `repos.txt`. Confirm `.gitignore` doesn't already exclude them; if you want them tracked once the user populates, you'll commit them separately at the end.)

---

## Task 10: Delete the dead code

**Why:** github-client, mock-data, token-prompt, title — all orphaned after Task 8. Also delete `aggregateDaily` and `pickBiggestCommit` from `contributor-stats.ts` (their last caller was `loadRealRepo`).

**Files:**
- Delete: `games/invaders/src/data/github-client.ts`
- Delete: `games/invaders/src/data/mock-data.ts`
- Delete: `games/invaders/src/ui/token-prompt.ts`
- Delete: `games/invaders/src/scenes/title.ts`
- Delete: `games/invaders/src/tests/token-prompt.test.ts`
- Modify: `games/invaders/src/data/contributor-stats.ts`

- [ ] **Step 1: Delete the orphaned files**

```bash
rm src/data/github-client.ts
rm src/data/mock-data.ts
rm src/ui/token-prompt.ts
rm src/scenes/title.ts
rm src/tests/token-prompt.test.ts
```

- [ ] **Step 2: Strip `contributor-stats.ts` down to types only**

Replace the whole contents of `src/data/contributor-stats.ts` with:

```ts
export interface DailyCommitCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface RealCommit {
  sha: string;
  date: string;
  message: string;
  commitsThatDay: number;
}

export interface ContributorStats {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  daily: DailyCommitCount[]; // 365 entries, oldest first
  biggestCommit?: RealCommit;
}
```

(`pickBiggestCommit` and `aggregateDaily` are gone — their last consumer was `loadRealRepo`, which is also gone. Their bash-script equivalents now live in the `aggregate_jq` block of `fetch-repos.sh`.)

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean exit. If any error mentions a missing type or function from a deleted file, that file's last caller wasn't fully migrated — investigate which surviving file imports the missing symbol and either remove the import or migrate the call.

- [ ] **Step 4: Verify tests**

Run: `pnpm test`
Expected: 4 test files (mapping, knowledge-extractor, boss-ai, repos-loader, homepage-filter) pass — token-prompt tests are gone. Total: `pnpm test` reports something like 24+ tests passing across 5 files.

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: vite build succeeds, output mentions `dist/index.html` and a JS bundle.

- [ ] **Step 6: Commit**

```bash
git add -u src/
git commit -m "delete github-client, mock-data, token-prompt, title scene"
```

---

## Task 11: Manual end-to-end smoke

**Why:** The plan up to here has been mostly mechanical. This task confirms the homepage actually works in a browser with a real (small) data set.

- [ ] **Step 1: Populate `repos.txt` with 3–5 entries you actually want**

Edit `scripts/repos.txt`. Suggested starters:

```
facebook/react
vitejs/vite
microsoft/typescript
nodejs/node
tanstack/query
```

- [ ] **Step 2: Run the fetch script**

```bash
GITHUB_TOKEN=<your-token> ./scripts/fetch-repos.sh
```

Expected: completes in ~30–60 s. Check `public/data/repos.json` exists and has 5 entries; `public/avatars/` has ~25 PNGs.

- [ ] **Step 3: Start the dev server and exercise the UI**

```bash
pnpm dev
```

Open the printed URL. Verify:
- Header reads `// pick your battle`. List shows 5 rows.
- Each row shows `owner/name`, language tag with coloured dot, "N commits last year", 5 avatars right-aligned, the rightmost (boss) noticeably larger than the others.
- Down arrow moves the focus highlight; PageDown jumps; the green border tracks correctly.
- Mouse wheel scrolls (only matters once you have > 6 entries; add a few more to `repos.txt` and re-run if you want to verify).
- Typing characters into the (canvas-rendered) filter input narrows the list. Backspace deletes. Esc clears.
- Clicking a row shows the loading scene briefly, then the level intro for that repo. Press through and check that the boss is the most-active contributor.
- Reload with `?repo=facebook/react` in the URL → goes straight to the deep-link intro (skipping the homepage).
- Reload with `?repo=zzz/zzz` (not in the index) → renders the homepage normally.

- [ ] **Step 4: If everything works, commit the populated data**

```bash
git add public/data public/avatars scripts/repos.txt
git commit -m "bake static repo data + avatars"
```

(If you'd rather not check in the avatar binaries, add `public/avatars/*.png` and `public/data/**/*.json` to `.gitignore` before committing — the design assumes they're committed for offline-friendly deploys, but it's a reasonable choice either way.)

- [ ] **Step 5: Final verification**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all green.

---

## Self-Review Notes

- **Spec coverage:** every section of the spec maps to a task — type decoupling (T1), index loader (T2), per-repo loader + level builder (T3), filter helpers (T4), homepage scene visual (T5) + scroll/keyboard (T6) + filter+click (T7), main.ts wiring including deep-link validation (T8), fetch script + input file (T9), dead-code deletion (T10), end-to-end manual verification (T11).
- **Placeholders:** none — every code block is concrete. The only "fill this in yourself" step is `repos.txt` content in T11, which is intentional per the spec ("user fills the input file").
- **Type consistency:** `RepoIndex`/`RepoIndexEntry`/`RepoFile`/`RepoFileContributor` defined in T2/T3, used identically in T5–T7, and emitted by the bash script in T9 in exactly that shape. `Level`/`ContributorStats`/`ContributorUserOverride` reuse existing types.
- **Order:** every task between commits leaves the codebase typecheck-clean and test-green. The deletion task runs *after* main.ts is rewired so the orphaned imports are gone before the files disappear.
