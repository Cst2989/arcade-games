# Open Source Invaders — Design Spec

**Status:** Draft (brainstorming output, pre-implementation)
**Date:** 2026-04-11
**Author:** brainstorming session

## 1. Summary

Open Source Invaders is a browser-based Space Invaders–style game that turns any public GitHub repository into a playable experience. The player enters a repo URL; the game fetches the repo's top 5 contributors and their contribution graphs, then builds 5 levels — one per contributor — where each daily commit becomes an enemy with HP and fire-rate proportional to the commit count. The final level is a three-phase boss fight against the #1 contributor. Between levels, "briefing" screens display educational content extracted from the project's README and docs, giving the game a learn-by-playing dimension.

The project has two deliverables:
1. **`@osi/engine`** — a small, reusable 2D canvas game engine with ECS, fixed-timestep loop, particles, tweens, audio, and input. Game-agnostic; intended to host future games.
2. **`@osi/invaders`** — the first game built on the engine. Houses all game-specific logic (GitHub data fetching, contribution mapping, boss AI, ship progression, educational briefings).

## 2. Goals & non-goals

### Goals

- A playable browser game that loads in under 2 seconds and runs at 60 fps on a 5-year-old laptop.
- Turn any GitHub repo into 5 distinct, thematically appropriate levels with no runtime configuration.
- Deliver "real game" polish: particles, hit-stop, screen shake, tweens, sound, and parallax starfields — not a prototype aesthetic.
- Produce a reusable engine package that can host future games without invasive change.
- Ship as a static site on GitHub Pages with no backend.

### Non-goals (explicit v1 cutline)

- Mobile / touch controls (desktop keyboard only)
- Leaderboards, online scoring, or any backend
- Multiplayer
- Accessibility beyond a "reduce motion" toggle
- Localization (English only)
- Save state or resume between sessions
- Difficulty settings (one difficulty, tuned)
- Physics beyond axis-aligned bounding-box collisions

## 3. Tech stack

- **Language:** TypeScript (strict mode)
- **Bundler:** Vite
- **Monorepo:** pnpm workspaces
- **Rendering:** HTML5 Canvas 2D (no WebGL, no Phaser, no Pixi)
- **Engine:** custom, implemented as `@osi/engine`
- **Test runner:** Vitest (engine only)
- **Deployment:** GitHub Pages via GitHub Actions
- **Assets:**
  - Sprites: Kenney Space Shooter Redux pack (CC0, bundled in `public/assets/`)
  - Audio: CC0 sound effects from freesound.org / kenney.nl / opengameart.org
  - Fonts: system monospace (no web font dependency)

The `html-in-canvas` proposal (WICG `drawElement()`) is noted as a potential progressive enhancement for the contributor card, not a requirement.

## 4. Monorepo structure

```
open-source-invaders/
├── package.json                  # root, pnpm workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   └── engine/                   # @osi/engine — reusable
│       ├── package.json
│       ├── src/
│       │   ├── core/             # world, system, gameloop, events
│       │   ├── render/           # renderer, sprite-atlas, camera, glow-pass
│       │   ├── input/            # keyboard, pointer, input-map
│       │   ├── audio/            # audio-bus, sfx-pool
│       │   ├── fx/               # particles, tween, screen-shake
│       │   ├── scene/            # scene, scene-manager
│       │   └── index.ts
│       └── tests/                # vitest
└── games/
    └── invaders/                 # @osi/invaders — the game
        ├── package.json
        ├── index.html
        ├── public/assets/
        │   ├── kenney-space-shooter/
        │   └── sfx/
        └── src/
            ├── main.ts
            ├── data/             # github-client, contributor-stats, mapping, knowledge-extractor
            ├── scenes/           # title, loading, level-intro, gameplay, boss, victory
            ├── components/       # invaders ECS components
            ├── systems/          # wave-spawner, enemy-ai, boss-ai, powerup, chaos-events, progression
            ├── ui/               # hud, contributor-card, level-transition
            └── config/           # ships.ts, powerups.ts, balance.ts
```

**Boundary rule:** the engine knows nothing about GitHub, contributors, weeks, or bosses. Every engine feature must be used by Invaders; nothing is added to the engine until Invaders needs it.

## 5. Engine API (`@osi/engine`)

### 5.1 Core primitives

The engine exposes six primary classes plus utility types:

1. **`World`** — ECS container. Entities are numeric IDs. Components live in typed stores keyed by component type (classic SoA-ish layout for cache-friendliness). API:
   ```ts
   const world = new World();
   const Position = defineComponent<{ x: number; y: number }>('Position');
   const e = world.spawn().add(Position, { x: 0, y: 0 });
   for (const [entity, pos] of world.query(Position)) { ... }
   ```

2. **`GameLoop`** — fixed-timestep simulation (60 Hz) with render interpolation. Reference: Glenn Fiedler's "Fix Your Timestep". Guards against the spiral of death via `maxStepsPerFrame`. Exposes a `timeScale` hook used for hit-stop and slow-motion effects.

3. **`Renderer`** — Canvas 2D drawing with a stacked-layer model. Layers have optional post-FX. The `glow` layer is implemented as an offscreen canvas with `filter: blur()` composited back with `lighter` blend mode. Used for Style C's subtle glow on bullets, ship, and HUD accents.

4. **`SpriteAtlas`** — loads a Kenney-format `sheet.png` + `sheet.xml` pair once, exposes sprites by name. Sub-rect draws via `ctx.drawImage`. Supports tinting via a cached offscreen composite per tint color.

5. **`ParticleEmitter`** — pooled particle system backed by `Float32Array` state (`x, y, vx, vy, life, maxLife`). Zero runtime allocation. Five pre-allocated pools, total 1,250 particles, ~30 KB.

6. **`Tween` + `Easing`** — chained, looped, eased value interpolation. Used for every on-screen motion that isn't physics: HUD numbers counting, level-up flashes, ship entry, contributor card slide-in, boss phase transitions.

Plus: `Camera`, `ScreenShake`, `AudioBus`, `Sfx`, `Scene`, `SceneManager`, `Keyboard`, `Pointer`, `InputMap`, `EventBus`, `Vec2`, `Rect`, `clamp`, `lerp`, `randRange`.

### 5.2 What the engine deliberately does not include

- No physics engine (box AABB only)
- No UI framework (HUD draws directly to a canvas layer)
- No networking
- No asset manager beyond `SpriteAtlas.load` and `AudioBus.load` composed with `Promise.all`

### 5.3 Screen shake and hit-stop

**Screen shake** uses Perlin noise for smooth camera offset, decays each active shake independently, stacks additively, and caps at a max amplitude to prevent cascading explosions from tearing the camera off-screen.

**Hit-stop** is implemented as `GameLoop.timeScale = 0` for a short window (30–80 ms) on impact. Every system receives `dt * timeScale`, so setting time to zero freezes simulation without freezing render or input. Hit-stop is the single highest-impact game-feel feature and is required on every meaningful impact.

## 6. Game design

### 6.1 Data pipeline (GitHub → playable levels)

```
User enters "owner/repo"
  → GET /repos/:owner/:repo                             (1 call)
  → GET /repos/:owner/:repo/contributors                (1 call)  # returns top 30 sorted by all-time commits
    → take top 5
  → For each of 5 contributors:
      GET /repos/:owner/:repo/commits?author=X&since=1y (1–3 paginated calls each)
  → GET /repos/:owner/:repo/readme                      (1 call)
  → GET /repos/:owner/:repo/contents                    (1 call)
  → (optional) GET contents of ARCHITECTURE.md, CONTRIBUTING.md, docs/  (1–3 more)

Total worst case: ~17–20 API calls per fresh load.
```

**Rate limit strategy:** start unauthenticated (60/hr IP limit). On `403 rate-limit-exceeded`, surface a modal prompting the user to paste a GitHub Personal Access Token (classic, read-only, `public_repo` scope). Token is stored in `localStorage['osi:gh-token']` and sent as `Authorization: Bearer`, lifting the limit to 5,000/hr. A `sessionStorage` cache keyed by `${owner}/${repo}` makes replay cost zero API calls.

**Loading screen** is a scene, not a spinner: while the fetch runs, a `LoadingScene` plays a parallax starfield with a playable ship the user can move around, and a progress bar showing fetch stage. Makes the wait feel alive.

### 6.2 Contributor → Level mapping (pure function)

```ts
type Level = {
  contributor: { login: string; avatar: string; name: string; totalCommits: number };
  waves: Wave[];              // 52 weeks
};

type Wave = {
  weekStart: string;          // ISO date
  enemies: EnemySpec[];       // up to 7 per day
};

type EnemySpec = {
  date: string;
  commits: number;            // raw count for tooltip/score
  hp: number;                 // ceil(commits / 2), min 1
  fireRate: number;           // shots/sec
  color: string;              // GitHub green bucket
};
```

**Difficulty formula (B + D from brainstorming):**
- `enemy.hp = max(1, ceil(ceil(commits / 2) * (1 + levelIndex * 0.25)))`  (integer, ≥ 1)
- `enemy.fireRate = (0.2 + commits * 0.05) * (1 + levelIndex * 0.25)`      (float, shots/sec)
- `enemy.color` bucketed by commits: `0 | 1–3 | 4–6 | 7–9 | 10+` → `#161b22 | #0e4429 | #006d32 | #26a641 | #39d353`
- Days with 0 commits produce no enemy (empty slot in the wave).

All numeric coefficients live in `config/balance.ts` — no magic numbers elsewhere.

### 6.3 Level flow (scene state machine)

```
TitleScene
  → (user enters repo or picks featured chip)
LoadingScene       # github fetch, playable ship background, progress bar
  → (all data ready)
LevelIntroScene    # left: contributor card + ship upgrade, right: knowledge briefing
  → (user presses SPACE)
GameplayScene      # 52 weekly waves, enemy AI, powerups, chaos events
  → (all waves cleared)
LevelIntroScene (next)
  → ... levels 2, 3, 4 ...
BossIntroScene     # dramatic cue, red tint
BossScene          # 3-phase boss fight
  → (boss defeated)
VictoryScene       # repo stats, share button, replay
```

All transitions cross-fade via tween (~400 ms). Scene manager is a stack; the pause screen is just a scene pushed on top that renders the frozen world underneath.

### 6.4 Gameplay system order (fixed per sim step)

1. `InputSystem` — keyboard/pointer → Player intent
2. `PlayerControlSystem` — intent → player velocity
3. `EnemyAISystem` — march left/right/drop + fire decision
4. `BossAISystem` — active only in BossScene (phase state machine)
5. `PhysicsSystem` — pos += vel · dt for all entities
6. `BulletSpawnSystem` — processes shoot events
7. `CollisionSystem` — player↔bullet, enemy↔bullet, player↔powerup, player↔enemy
8. `DamageSystem` — HP deltas, hit flashes, impact particles, hit-stop triggers
9. `DeathSystem` — remove dead entities, roll powerup drops, emit `enemyKilled`
10. `PowerupSystem` — pickup + active effect application
11. `ChaosEventSystem` — once-per-level random event
12. `WaveSpawnerSystem` — advances to next wave when current is clear
13. `ParticleSystem` — updates all pools
14. `ScreenShakeSystem` — decays active shakes
15. `TweenSystem` — advances active tweens
16. `HudUpdateSystem` — world state → HUD display

Each system is a pure function over `World` + `dt`, unit-testable in isolation.

### 6.5 Ship progression (5 tiers)

| Level | Contributor rank | Kenney sprite | Upgrade |
|---|---|---|---|
| 1 | #5 | `playerShip1_blue` | Base: single shot |
| 2 | #4 | `playerShip2_blue` | +1 HP max |
| 3 | #3 | `playerShip3_blue` | Double shot (two parallel bullets) |
| 4 | #2 | `playerShip2_orange` | +1 HP max, faster movement |
| 5 | #1 (boss) | `playerShip3_red` | Triple shot + idle regen |

Each `LevelIntroScene` plays a brief morph animation when the sprite changes.

### 6.6 Powerups (drop on hard-square kills, i.e. ≥10 commits)

| Powerup | Effect | Duration |
|---|---|---|
| `git revert` | Restore 1 HP | instant |
| `fork` | Next shot fires 3 bullets in a spread | next shot |
| `rebase` | All enemies slowed to 50% | 5 s |
| `squash` | Next shot pierces entire column | next shot |
| `force push` | Screen-clearing bomb | instant, 1 per level max |

Drop selection is uniform random. Enemy firing has a small jitter so patterns don't feel robotic.

### 6.7 Chaos events (one per level, random timing 30–70% progress)

| Event | Duration | Effect |
|---|---|---|
| `CI failed` | 8 s | All enemies +20% fire rate, screen tint red |
| `PR approved` | 8 s | Player gains temporary shield ring |
| `Merge conflict` | 6 s | Player controls inverted left↔right |
| `Dependabot alert` | 10 s | Random enemies flash yellow, worth 2× score |
| `Main branch green` | 5 s | Player fire rate doubled |

### 6.8 Boss fight (Level 5)

`BossScene` is a dedicated scene. The boss AI is an explicit `switch` over a `BossPhase` enum:

- **Phase 1 — "Commit Storm"**: single large sprite (Kenney `ufoBlue` or `enemyBlack5`), 300 HP, fires 3-way spread pattern. Ends when HP ≤ 200.
- **Transition FX**: white flash, boss splits into 3 drones via burst particles.
- **Phase 2 — "Rebase Rage"**: 3 drone entities, 60 HP each, homing behavior. Ends when all drones dead.
- **Reassemble FX**: drones converge, boss reforms at 100 HP.
- **Phase 3 — "Final Commit"**: persistent red screen tint, camera zooms 5% over 2 s, boss fires laser sweep pattern. Ends at HP ≤ 0.
- **Victory**: 5-stage explosion cascade over 1.5 s, fade to white, `VictoryScene`.

### 6.9 Educational briefings (inter-level knowledge chunks)

On game start, in addition to commits, we fetch the repo's `README.md`, root `contents`, and (best effort) `ARCHITECTURE.md` / `CONTRIBUTING.md` / `docs/*.md`. A `knowledge-extractor.ts` module parses these via the `marked` lexer and categorizes content into tagged chunks:

```ts
type Chunk =
  | { kind: 'FEATURE'; text: string; source: string }
  | { kind: 'CODE'; lang: string; code: string; source: string }
  | { kind: 'CONCEPT'; heading: string; body: string; source: string }
  | { kind: 'QUOTE'; text: string; source: string }
  | { kind: 'FACT'; text: string; source: string };
```

Extraction rules:
- Code blocks in `ts/js/py/rust/go/java/cpp/sh` → `CODE`
- `##`/`###` headings followed by paragraph → `CONCEPT`
- Bullets under "Features" heading → `FEATURE`
- Blockquotes → `QUOTE`
- Bold-emphasized sentences → `FACT`
- Skip badges, ToCs, install-command blocks, HTML comments

**The 5-level arc** (deterministically seeded from repo name so replays are consistent):

- Level 1 intro → `QUOTE` or tagline paragraph — "what is this?"
- Level 2 intro → `FEATURE` — "what does it do?"
- Level 3 intro → `CONCEPT` — "how does it work?"
- Level 4 intro → `CODE` — "what does using it look like?"
- Level 5 (boss) intro → `QUOTE` or contributor `FACT` — "why does it matter?"

Fallback chain if README is insufficient: CONTRIBUTING → ARCHITECTURE → repo description → topic tags → language stats.

**UI**: split-panel. Left = contributor card + ship upgrade animation. Right = single chunk with typewriter reveal (~40 chars/sec). Code chunks use a built-in ~80-line syntax tokenizer for the 8 target languages (no Prism/highlight.js). Player can `SPACE` to skip typewriter and `SPACE` again to launch.

## 7. Visual style & polish

### 7.1 Visual direction: "Terminal + subtle glow" (hybrid)

- **Background:** GitHub dark palette (`#0d1117`, `#161b22`)
- **Accent colors:** `#58a6ff` (primary cyan), `#3fb950` (green), `#f85149` (red), `#d29922` (yellow)
- **Typography:** system monospace (`ui-monospace`, `SF Mono`, `Menlo`) — no web font
- **Enemy colors:** GitHub contribution graph green buckets (see 6.2)
- **Glow:** applied to bullets, ship, HUD progress bar, and boss via the offscreen `glow` layer
- **No CRT scanlines, no synthwave gradients** — restrained and dev-native

### 7.2 Effect catalog (required polish moments)

Every impactful moment layers **visual + audio + shake + hit-stop**:

- **Player shoots** — muzzle flash, kick-back, pitched `shoot.wav`
- **Bullet hits enemy (non-fatal)** — white flash tint, 6-particle burst, 30 ms hit-stop, shake(2, 80 ms)
- **Enemy destroyed** — 20-particle explosion, sprite scale-up, 50 ms hit-stop, shake(4, 150 ms)
- **Player hit** — red vignette flash, invuln flicker 1.2 s, shake(8, 300 ms)
- **Wave cleared** — "WAVE 14 CLEARED" drop banner, 60% time-slow for 400 ms
- **Level-up** — white flash, ship sprite morph, "UPGRADE ACQUIRED" banner, particle fountain
- **Boss phase transition** — white flash, 60-particle burst, shake(12, 500 ms), 30% time-slow for 600 ms
- **Multi-kill combo** — floating "×N COMBO" / "FORK'D!" / "MERGED!" text tween up-fade

### 7.3 Particle budgets (pre-allocated pools)

| Pool | Capacity | Use |
|---|---|---|
| sparks | 500 | Hits, trails, muzzle flashes |
| explosions | 300 | Enemy deaths |
| bigExplosions | 150 | Boss phases, player death |
| stars | 200 | Parallax background |
| powerupDust | 100 | Powerup wobble trails |

Total ~1,250 particles, ~30 KB typed-array memory, zero runtime allocation in the main loop.

### 7.4 Parallax starfield (3 layers)

- Far: 80 stars, 8 px/s, 1×1 px, `#2a3340`
- Mid: 50 stars, 20 px/s, 2×2 px, `#4d5a70`
- Near: 20 stars, 50 px/s, 3×3 px, `#8ba4c5`

Stars wrap vertically. Used in title, loading, gameplay, boss, and victory scenes.

### 7.5 Audio plan

All CC0 sources (kenney.nl, freesound.org, opengameart.org):

- SFX: shoot, enemy_shoot, hit_soft, hit_hard, explode_small, explode_big, powerup_drop, powerup_get, level_up, boss_phase, boss_roar, boss_die, ui_hover, ui_click
- Music: one track per scene type (title, gameplay, boss, victory), cross-faded on scene change, user-togglable
- Autoplay policy: music is silent until first user interaction (Chrome autoplay block workaround)

## 8. Performance targets

- 60 fps on a 5-year-old laptop (2020 MacBook Air baseline)
- Max simultaneous entities: 200 (well under budget)
- Draw calls per frame: ≤ 300
- First interactive paint ≤ 1.5 s from initial page load
- JS heap stable after boot (no allocations in the main loop — enforced by pools)
- Bundle budget: game code < 200 KB gzipped, atlas + audio ~250 KB, total ~450 KB initial load

## 9. Testing strategy

### Engine — full unit test coverage (target 80%+)

```
packages/engine/tests/
├── core/
│   ├── world.test.ts         # spawn, query, remove, component isolation
│   ├── gameloop.test.ts      # fixed-timestep accumulator, spiral-of-death guard, timeScale
│   └── events.test.ts        # typed pub/sub order, unsubscribe
├── fx/
│   ├── particles.test.ts     # pool fixed size, dead particles recycled
│   ├── tween.test.ts         # easing math, chains, loops, onComplete
│   └── screen-shake.test.ts  # decay, stacking, amplitude cap
└── render/
    ├── sprite-atlas.test.ts  # XML parse, sub-rect lookup, tint cache
    └── camera.test.ts        # pan, zoom, offset
```

### Invaders — targeted tests only

- `mapping.ts` — pure data transform, JSON fixture in / Level out
- `knowledge-extractor.ts` — README fixtures → tagged chunks
- `boss-ai.ts` — phase transition edges
- `balance.ts` — no test (pure data)

### Not tested

- Visual regression (low ROI for solo dev)
- End-to-end gameplay (flaky, manual QA is the real test)
- GitHub API mocking (we test `mapping.ts` against saved fixtures instead)

### Manual QA checklist (before each release)

1. Title loads < 1.5 s, parallax smooth
2. Featured repo reaches gameplay < 3 s
3. Each level shows contributor card, ship upgrade, knowledge chunk
4. Boss has all 3 phases visually distinct
5. Powerups drop and function (fire one of each)
6. At least one chaos event per run
7. Rate-limit fallback: PAT modal appears and works
8. 60 fps in Chrome, Firefox, Safari on baseline hardware
9. Keyboard: ←→ move, SPACE shoot/skip, ESC pause
10. Mobile: doesn't crash (full support is v2)

## 10. Deployment

- **Target:** GitHub Pages at `https://<user>.github.io/open-source-invaders/`
- **Pipeline:** GitHub Actions on push to `main`
  1. `pnpm install`
  2. `pnpm -r test`
  3. `pnpm --filter @osi/invaders build`
  4. Deploy `games/invaders/dist/` via `peaceiris/actions-gh-pages`
- **Vite config:** `base: '/open-source-invaders/'`
- **No backend, no environment secrets.** PAT lives in user's `localStorage` only.

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rate limits break demos | High | High | PAT modal fallback + `sessionStorage` cache + in-memory cache for featured repos |
| Kenney sprites insufficient | Low | Medium | Pack has 295+ sprites; fallback to Space Shooter Extension pack |
| README parsing breaks on weird markdown | Medium | Low | Chain: README → CONTRIBUTING → ARCHITECTURE → description → static fallback text |
| Performance drops on old hardware | Medium | High | Pools, entity budget, profile early, cap particles on slow-frame detection |
| Repo has < 5 contributors | Low | Low | `min(5, contributors.length)` levels; boss is always rank 1 |
| CORS blocking GitHub API | None | — | `api.github.com` sends permissive CORS |
| Audio autoplay blocked | High (Chrome) | Low | Music silent until first click |
| No README at all | Low | Low | Fall back to repo description + topic tags |
| Over-engineering the engine | **High** | **High** | Hard rule: no engine feature without current Invaders use. Extract, don't design. |

The last row is the single biggest risk: "make it reusable" is the known failure mode for solo game projects. Mitigation is enforced by monorepo boundaries and by brainstorming-to-plan discipline.

## 12. Out of scope (v1 YAGNI list)

- Mobile / touch controls
- Leaderboards / online scoring
- Multiplayer
- Procedurally generated music
- Real physics engine
- Accessibility beyond "reduce motion"
- Localization
- Save state / resume
- Difficulty settings
- Post-launch content
- GraphQL v4 migration (REST is enough)
- WebGL / Pixi / Phaser

## 13. Open questions (to be resolved during implementation)

- Exact Kenney sprite names for each ship tier — may need to pick from the atlas once loaded
- Specific boss phase numerical tuning (HP thresholds, fire patterns) — tune to feel
- Final color palette for tint variations (blue / orange / red on Kenney's base ships)
- Which CC0 music tracks to bundle — auditioned during implementation

None of these block the implementation plan.

## 14. Success criteria

The project is done when:

1. A new visitor can play the full game (title → 5 levels → boss → victory) with any valid public GitHub repo URL
2. The game runs at 60 fps throughout on the baseline hardware
3. The engine package (`@osi/engine`) compiles and tests in isolation from the game
4. The site is deployed to GitHub Pages and reachable via a permalink
5. Play-feel sanity check: multi-kill combos, hit-stop, particle explosions, and screen shake are all visibly functioning on any gameplay screenshot
