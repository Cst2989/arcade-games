# Open Source Invaders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser Space Invaders clone that turns any public GitHub repo into 5 levels + a boss, built on a reusable custom 2D canvas engine, deployed as a static site to GitHub Pages.

**Architecture:** pnpm monorepo with two packages. `@osi/engine` is a game-agnostic ECS engine (World, GameLoop, Renderer, SpriteAtlas, ParticleEmitter, Tween, Camera, ScreenShake, AudioBus, SceneManager, Input). `@osi/invaders` contains all game-specific logic (GitHub fetch, contributor→level mapping, knowledge extractor, scenes, systems, UI, config). Boundary rule: nothing enters the engine until Invaders needs it.

**Tech Stack:** TypeScript strict, Vite, pnpm workspaces, HTML5 Canvas 2D, Vitest (engine-only unit tests), `marked` (README lexer), GitHub Actions + `peaceiris/actions-gh-pages` for deploy. Kenney Space Shooter Redux for sprites (CC0), CC0 SFX from kenney.nl / freesound.org.

---

## Phase Overview

- **Phase 0** — Monorepo setup (Tasks 1–3)
- **Phase 1** — Engine core: math, events, ECS, gameloop, scene, input (Tasks 4–11)
- **Phase 2** — Engine render: renderer, atlas, camera (Tasks 12–14)
- **Phase 3** — Engine FX: particles, tween, screen shake (Tasks 15–17)
- **Phase 4** — Engine audio + barrel exports (Tasks 18–19)
- **Phase 5** — Invaders data: github client, mapping, knowledge extractor (Tasks 20–23)
- **Phase 6** — Invaders config + components (Tasks 24–25)
- **Phase 7** — Invaders systems (Tasks 26–40)
- **Phase 8** — Invaders scenes + UI + bootstrap (Tasks 41–50)
- **Phase 9** — Deploy + release QA (Tasks 51–52)

Conventions:
- Every engine task is TDD: failing test → run → impl → run → commit.
- Invaders tasks write tests only for `mapping.ts`, `knowledge-extractor.ts`, `boss-ai.ts` per spec §9.
- Commit after every task. Commit messages: `feat(engine): ...`, `feat(invaders): ...`, `test: ...`, `chore: ...`.
- All numeric constants in `games/invaders/src/config/balance.ts` — no magic numbers elsewhere.

---

## File Structure (locked before task breakdown)

```
open-source-invaders/
├── package.json                       # root, pnpm workspaces, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # strict, shared
├── .github/workflows/deploy.yml       # CI: test + build + pages
├── packages/
│   └── engine/
│       ├── package.json               # name: @osi/engine
│       ├── tsconfig.json              # extends base
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── index.ts               # barrel exports
│       │   ├── util/
│       │   │   ├── math.ts            # clamp, lerp, randRange
│       │   │   ├── vec2.ts            # Vec2
│       │   │   ├── rect.ts            # Rect + AABB test
│       │   │   └── perlin.ts          # 1D Perlin for shake
│       │   ├── core/
│       │   │   ├── world.ts           # World, defineComponent
│       │   │   ├── gameloop.ts        # fixed-timestep + timeScale
│       │   │   └── events.ts          # EventBus
│       │   ├── scene/
│       │   │   ├── scene.ts           # Scene base
│       │   │   └── scene-manager.ts   # stack
│       │   ├── input/
│       │   │   ├── keyboard.ts
│       │   │   ├── pointer.ts
│       │   │   └── input-map.ts
│       │   ├── render/
│       │   │   ├── renderer.ts        # stacked layers + glow pass
│       │   │   ├── sprite-atlas.ts    # Kenney XML loader + tint cache
│       │   │   └── camera.ts
│       │   ├── fx/
│       │   │   ├── particles.ts       # 5 pooled emitters, Float32Array
│       │   │   ├── tween.ts           # Tween + Easing
│       │   │   └── screen-shake.ts    # Perlin decay, stacking, cap
│       │   └── audio/
│       │       ├── audio-bus.ts
│       │       └── sfx.ts
│       └── tests/
│           ├── core/{world,gameloop,events}.test.ts
│           ├── fx/{particles,tween,screen-shake}.test.ts
│           └── render/{sprite-atlas,camera}.test.ts
└── games/
    └── invaders/
        ├── package.json               # name: @osi/invaders
        ├── tsconfig.json
        ├── vite.config.ts             # base: '/open-source-invaders/'
        ├── index.html
        ├── public/assets/
        │   ├── kenney-space-shooter/  # sheet.png + sheet.xml
        │   └── sfx/                   # *.wav, *.ogg
        └── src/
            ├── main.ts                # bootstraps engine, loads atlas, starts SceneManager
            ├── data/
            │   ├── github-client.ts   # fetch + PAT + rate limit + cache
            │   ├── contributor-stats.ts
            │   ├── mapping.ts         # pure contributor → Level
            │   └── knowledge-extractor.ts
            ├── config/
            │   ├── balance.ts         # all magic numbers
            │   ├── ships.ts           # 5 tiers
            │   └── powerups.ts
            ├── components/
            │   └── index.ts           # all ECS components
            ├── systems/
            │   ├── input.ts
            │   ├── player-control.ts
            │   ├── enemy-ai.ts
            │   ├── boss-ai.ts
            │   ├── physics.ts
            │   ├── bullet-spawn.ts
            │   ├── collision.ts
            │   ├── damage.ts
            │   ├── death.ts
            │   ├── powerup.ts
            │   ├── chaos-events.ts
            │   ├── wave-spawner.ts
            │   ├── particle.ts
            │   ├── screen-shake.ts
            │   ├── tween.ts
            │   └── hud-update.ts
            ├── scenes/
            │   ├── title.ts
            │   ├── loading.ts
            │   ├── level-intro.ts
            │   ├── gameplay.ts
            │   ├── boss-intro.ts
            │   ├── boss.ts
            │   ├── victory.ts
            │   └── pause.ts
            ├── ui/
            │   ├── hud.ts
            │   ├── contributor-card.ts
            │   └── level-transition.ts
            └── tests/                  # targeted only
                ├── mapping.test.ts
                ├── knowledge-extractor.test.ts
                └── boss-ai.test.ts
```

---

## Phase 0 — Monorepo Setup

### Task 1: Initialize pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore` (append)

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "open-source-invaders",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm --filter @osi/invaders build",
    "dev": "pnpm --filter @osi/invaders dev",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "5.6.2"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "games/*"
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ES2022", "DOM"]
  }
}
```

- [ ] **Step 4: Append to `.gitignore`**

```
node_modules/
dist/
.vite/
*.tsbuildinfo
```

- [ ] **Step 5: Install and verify**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: init pnpm workspace with strict TS base"
```

---

### Task 2: Scaffold `@osi/engine` package

**Files:**
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`
- Create: `packages/engine/tests/smoke.test.ts`

- [ ] **Step 1: Write `packages/engine/package.json`**

```json
{
  "name": "@osi/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "2.1.1",
    "typescript": "5.6.2"
  }
}
```

- [ ] **Step 2: Write `packages/engine/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `packages/engine/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write placeholder `packages/engine/src/index.ts`**

```ts
export const ENGINE_VERSION = '0.1.0';
```

- [ ] **Step 5: Write smoke test `packages/engine/tests/smoke.test.ts`**

```ts
import { expect, test } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

test('engine version is exported', () => {
  expect(ENGINE_VERSION).toBe('0.1.0');
});
```

- [ ] **Step 6: Install and run**

Run: `pnpm install && pnpm --filter @osi/engine test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add packages/engine package.json pnpm-lock.yaml
git commit -m "feat(engine): scaffold @osi/engine with vitest"
```

---

### Task 3: Scaffold `@osi/invaders` package

**Files:**
- Create: `games/invaders/package.json`
- Create: `games/invaders/tsconfig.json`
- Create: `games/invaders/vite.config.ts`
- Create: `games/invaders/index.html`
- Create: `games/invaders/src/main.ts`

- [ ] **Step 1: Write `games/invaders/package.json`**

```json
{
  "name": "@osi/invaders",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@osi/engine": "workspace:*",
    "marked": "14.1.2"
  },
  "devDependencies": {
    "vite": "5.4.8",
    "vitest": "2.1.1",
    "typescript": "5.6.2"
  }
}
```

- [ ] **Step 2: Write `games/invaders/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `games/invaders/vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/open-source-invaders/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: { port: 5173 },
});
```

- [ ] **Step 4: Write `games/invaders/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Source Invaders</title>
    <style>
      html, body { margin: 0; padding: 0; background: #0d1117; overflow: hidden; }
      canvas { display: block; margin: 0 auto; image-rendering: pixelated; }
    </style>
  </head>
  <body>
    <canvas id="game" width="960" height="600"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write placeholder `games/invaders/src/main.ts`**

```ts
import { ENGINE_VERSION } from '@osi/engine';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#58a6ff';
ctx.font = '20px ui-monospace, Menlo, monospace';
ctx.fillText(`Open Source Invaders — engine v${ENGINE_VERSION}`, 20, 40);
```

- [ ] **Step 6: Install and start dev server**

Run: `pnpm install && pnpm --filter @osi/invaders dev`
Expected: Vite dev server up on http://localhost:5173/open-source-invaders/, canvas shows engine version.
Kill the server after verifying.

- [ ] **Step 7: Commit**

```bash
git add games/invaders package.json pnpm-lock.yaml
git commit -m "feat(invaders): scaffold @osi/invaders with vite"
```

---

## Phase 1 — Engine Core

### Task 4: Math utilities (clamp, lerp, randRange, Vec2, Rect)

**Files:**
- Create: `packages/engine/src/util/math.ts`
- Create: `packages/engine/src/util/vec2.ts`
- Create: `packages/engine/src/util/rect.ts`
- Create: `packages/engine/tests/util/math.test.ts`

- [ ] **Step 1: Write failing test `packages/engine/tests/util/math.test.ts`**

```ts
import { expect, test } from 'vitest';
import { clamp, lerp, randRange } from '../../src/util/math.js';
import { Vec2 } from '../../src/util/vec2.js';
import { Rect } from '../../src/util/rect.js';

test('clamp bounds value', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(11, 0, 10)).toBe(10);
});

test('lerp interpolates', () => {
  expect(lerp(0, 10, 0)).toBe(0);
  expect(lerp(0, 10, 1)).toBe(10);
  expect(lerp(0, 10, 0.5)).toBe(5);
});

test('randRange stays in bounds', () => {
  for (let i = 0; i < 100; i++) {
    const v = randRange(5, 10);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThan(10);
  }
});

test('Vec2 add/scale', () => {
  const a = new Vec2(1, 2);
  const b = new Vec2(3, 4);
  a.add(b);
  expect(a.x).toBe(4);
  expect(a.y).toBe(6);
  a.scale(2);
  expect(a.x).toBe(8);
  expect(a.y).toBe(12);
});

test('Rect AABB intersect', () => {
  const a = new Rect(0, 0, 10, 10);
  const b = new Rect(5, 5, 10, 10);
  const c = new Rect(100, 100, 1, 1);
  expect(a.intersects(b)).toBe(true);
  expect(a.intersects(c)).toBe(false);
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/engine/src/util/math.ts`**

```ts
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);
```

- [ ] **Step 4: Implement `packages/engine/src/util/vec2.ts`**

```ts
export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  add(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
```

- [ ] **Step 5: Implement `packages/engine/src/util/rect.ts`**

```ts
export class Rect {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  intersects(o: Rect): boolean {
    return (
      this.x < o.x + o.w &&
      this.x + this.w > o.x &&
      this.y < o.y + o.h &&
      this.y + this.h > o.y
    );
  }

  contains(px: number, py: number): boolean {
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }
}
```

- [ ] **Step 6: Run test, expect pass**

Run: `pnpm --filter @osi/engine test`
Expected: all util tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/util packages/engine/tests/util
git commit -m "feat(engine): math utils (clamp, lerp, randRange, Vec2, Rect)"
```

---

### Task 5: EventBus (typed pub/sub)

**Files:**
- Create: `packages/engine/src/core/events.ts`
- Create: `packages/engine/tests/core/events.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/core/events.test.ts
import { expect, test, vi } from 'vitest';
import { EventBus } from '../../src/core/events.js';

type Events = {
  hit: { dmg: number };
  death: { id: number };
};

test('subscribe, emit, unsubscribe', () => {
  const bus = new EventBus<Events>();
  const fn = vi.fn();
  const off = bus.on('hit', fn);
  bus.emit('hit', { dmg: 5 });
  expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  off();
  bus.emit('hit', { dmg: 99 });
  expect(fn).toHaveBeenCalledTimes(1);
});

test('multiple listeners fire in registration order', () => {
  const bus = new EventBus<Events>();
  const calls: number[] = [];
  bus.on('death', () => calls.push(1));
  bus.on('death', () => calls.push(2));
  bus.on('death', () => calls.push(3));
  bus.emit('death', { id: 7 });
  expect(calls).toEqual([1, 2, 3]);
});

test('clear removes all listeners', () => {
  const bus = new EventBus<Events>();
  const fn = vi.fn();
  bus.on('hit', fn);
  bus.clear();
  bus.emit('hit', { dmg: 1 });
  expect(fn).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test events`
Expected: FAIL, EventBus not defined.

- [ ] **Step 3: Implement `packages/engine/src/core/events.ts`**

```ts
type Handler<T> = (payload: T) => void;

export class EventBus<E extends Record<string, unknown>> {
  private listeners = new Map<keyof E, Set<Handler<unknown>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set!.delete(handler as Handler<unknown>);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test`
Expected: events tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/core/events.ts packages/engine/tests/core/events.test.ts
git commit -m "feat(engine): typed EventBus with ordered dispatch"
```

---

### Task 6: World + ECS (defineComponent, spawn, query, remove)

**Files:**
- Create: `packages/engine/src/core/world.ts`
- Create: `packages/engine/tests/core/world.test.ts`

- [ ] **Step 1: Write failing test `packages/engine/tests/core/world.test.ts`**

```ts
import { expect, test } from 'vitest';
import { World, defineComponent } from '../../src/core/world.js';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ vx: number; vy: number }>('Velocity');

test('spawn returns unique ids', () => {
  const w = new World();
  const a = w.spawn();
  const b = w.spawn();
  expect(a).not.toBe(b);
});

test('add + get component', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 1, y: 2 });
  const p = w.get(e, Position);
  expect(p).toEqual({ x: 1, y: 2 });
});

test('query yields only entities with all listed components', () => {
  const w = new World();
  const e1 = w.spawn();
  const e2 = w.spawn();
  const e3 = w.spawn();
  w.add(e1, Position, { x: 0, y: 0 });
  w.add(e1, Velocity, { vx: 1, vy: 1 });
  w.add(e2, Position, { x: 5, y: 5 });
  w.add(e3, Velocity, { vx: 2, vy: 2 });

  const results: number[] = [];
  for (const [id] of w.query(Position, Velocity)) results.push(id);
  expect(results).toEqual([e1]);
});

test('remove deletes entity and its components', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 0, y: 0 });
  w.remove(e);
  expect(w.get(e, Position)).toBeUndefined();
  const ids: number[] = [];
  for (const [id] of w.query(Position)) ids.push(id);
  expect(ids).not.toContain(e);
});

test('removeComponent removes single component only', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 0, y: 0 });
  w.add(e, Velocity, { vx: 1, vy: 0 });
  w.removeComponent(e, Velocity);
  expect(w.get(e, Position)).toBeDefined();
  expect(w.get(e, Velocity)).toBeUndefined();
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test world`
Expected: FAIL, world.ts not found.

- [ ] **Step 3: Implement `packages/engine/src/core/world.ts`**

```ts
export type Entity = number;

export interface Component<T> {
  readonly id: symbol;
  readonly name: string;
  readonly _type?: T;
}

export function defineComponent<T>(name: string): Component<T> {
  return { id: Symbol(name), name };
}

export class World {
  private nextId: Entity = 1;
  private stores = new Map<symbol, Map<Entity, unknown>>();
  private alive = new Set<Entity>();

  spawn(): Entity {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  add<T>(e: Entity, c: Component<T>, value: T): void {
    let store = this.stores.get(c.id);
    if (!store) {
      store = new Map();
      this.stores.set(c.id, store);
    }
    store.set(e, value);
  }

  get<T>(e: Entity, c: Component<T>): T | undefined {
    return this.stores.get(c.id)?.get(e) as T | undefined;
  }

  has<T>(e: Entity, c: Component<T>): boolean {
    return this.stores.get(c.id)?.has(e) ?? false;
  }

  removeComponent<T>(e: Entity, c: Component<T>): void {
    this.stores.get(c.id)?.delete(e);
  }

  remove(e: Entity): void {
    this.alive.delete(e);
    for (const store of this.stores.values()) store.delete(e);
  }

  isAlive(e: Entity): boolean {
    return this.alive.has(e);
  }

  *query<A>(a: Component<A>): Iterable<[Entity, A]>;
  *query<A, B>(a: Component<A>, b: Component<B>): Iterable<[Entity, A, B]>;
  *query<A, B, C>(
    a: Component<A>,
    b: Component<B>,
    c: Component<C>,
  ): Iterable<[Entity, A, B, C]>;
  *query(...comps: Component<unknown>[]): Iterable<unknown[]> {
    const stores = comps.map((c) => this.stores.get(c.id));
    if (stores.some((s) => !s)) return;
    const [first, ...rest] = stores as Map<Entity, unknown>[];
    outer: for (const [id, v0] of first) {
      const row: unknown[] = [id, v0];
      for (const s of rest) {
        const v = s.get(id);
        if (v === undefined) continue outer;
        row.push(v);
      }
      yield row;
    }
  }

  size(): number {
    return this.alive.size;
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test world`
Expected: all 5 world tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/core/world.ts packages/engine/tests/core/world.test.ts
git commit -m "feat(engine): World ECS with typed defineComponent + query"
```

---

### Task 7: GameLoop (fixed timestep + timeScale + spiral-of-death guard)

**Files:**
- Create: `packages/engine/src/core/gameloop.ts`
- Create: `packages/engine/tests/core/gameloop.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/core/gameloop.test.ts
import { expect, test, vi } from 'vitest';
import { GameLoop } from '../../src/core/gameloop.js';

test('fixed step accumulates and fires update at fixed dt', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  const updates: number[] = [];
  loop.onUpdate = (dt) => updates.push(dt);
  loop.tick(0);
  loop.tick(16.67);
  loop.tick(33.34);
  expect(updates.length).toBeGreaterThanOrEqual(2);
  for (const dt of updates) expect(dt).toBeCloseTo(1 / 60, 5);
});

test('timeScale scales update dt', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  loop.timeScale = 0;
  const updates: number[] = [];
  loop.onUpdate = (dt) => updates.push(dt);
  loop.tick(0);
  loop.tick(100);
  for (const dt of updates) expect(dt).toBe(0);
});

test('maxStepsPerFrame caps catch-up', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 3 });
  const fn = vi.fn();
  loop.onUpdate = fn;
  loop.tick(0);
  loop.tick(10_000); // huge gap
  expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
});

test('render fires once per tick with interpolation alpha in [0,1]', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  const alphas: number[] = [];
  loop.onRender = (a) => alphas.push(a);
  loop.tick(0);
  loop.tick(10);
  loop.tick(25);
  for (const a of alphas) {
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  }
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test gameloop`
Expected: FAIL, GameLoop not found.

- [ ] **Step 3: Implement `packages/engine/src/core/gameloop.ts`**

```ts
export interface GameLoopOptions {
  fixedDt: number;
  maxStepsPerFrame: number;
}

export class GameLoop {
  timeScale = 1;
  onUpdate: ((dt: number) => void) | null = null;
  onRender: ((alpha: number) => void) | null = null;

  private accumulator = 0;
  private lastMs = -1;
  private running = false;
  private rafId = 0;

  constructor(private readonly opts: GameLoopOptions) {}

  tick(nowMs: number): void {
    if (this.lastMs < 0) {
      this.lastMs = nowMs;
      this.onRender?.(0);
      return;
    }
    const frameSec = Math.min((nowMs - this.lastMs) / 1000, 0.25);
    this.lastMs = nowMs;
    this.accumulator += frameSec;

    let steps = 0;
    while (this.accumulator >= this.opts.fixedDt && steps < this.opts.maxStepsPerFrame) {
      this.onUpdate?.(this.opts.fixedDt * this.timeScale);
      this.accumulator -= this.opts.fixedDt;
      steps++;
    }
    if (this.accumulator > this.opts.fixedDt * this.opts.maxStepsPerFrame) {
      this.accumulator = 0; // drop to avoid spiral
    }
    const alpha = this.accumulator / this.opts.fixedDt;
    this.onRender?.(alpha);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.tick(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.lastMs = -1;
    this.accumulator = 0;
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test gameloop`
Expected: all 4 gameloop tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/core/gameloop.ts packages/engine/tests/core/gameloop.test.ts
git commit -m "feat(engine): fixed-timestep GameLoop with timeScale + step cap"
```

---

### Task 8: Scene + SceneManager (stack)

**Files:**
- Create: `packages/engine/src/scene/scene.ts`
- Create: `packages/engine/src/scene/scene-manager.ts`
- Create: `packages/engine/tests/scene/scene-manager.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/scene/scene-manager.test.ts
import { expect, test } from 'vitest';
import { Scene } from '../../src/scene/scene.js';
import { SceneManager } from '../../src/scene/scene-manager.js';

class LogScene extends Scene {
  constructor(public label: string, public log: string[]) {
    super();
  }
  override onEnter(): void {
    this.log.push(`enter:${this.label}`);
  }
  override onExit(): void {
    this.log.push(`exit:${this.label}`);
  }
  override update(dt: number): void {
    this.log.push(`update:${this.label}:${dt}`);
  }
}

test('push fires onEnter, replace fires onExit then onEnter', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('a', log));
  mgr.replace(new LogScene('b', log));
  expect(log).toEqual(['enter:a', 'exit:a', 'enter:b']);
});

test('update only calls top scene by default', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('bg', log));
  mgr.push(new LogScene('top', log));
  mgr.update(0.016);
  expect(log.filter((x) => x.startsWith('update'))).toEqual(['update:top:0.016']);
});

test('pop re-enters underneath scene as top', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('a', log));
  mgr.push(new LogScene('b', log));
  mgr.pop();
  mgr.update(0.016);
  expect(log).toContain('exit:b');
  expect(log).toContain('update:a:0.016');
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test scene`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `packages/engine/src/scene/scene.ts`**

```ts
export abstract class Scene {
  onEnter(): void {}
  onExit(): void {}
  update(_dt: number): void {}
  render(_alpha: number): void {}
  onResume(): void {}
  onPause(): void {}
}
```

- [ ] **Step 4: Implement `packages/engine/src/scene/scene-manager.ts`**

```ts
import { Scene } from './scene.js';

export class SceneManager {
  private stack: Scene[] = [];

  push(s: Scene): void {
    const prev = this.top();
    prev?.onPause();
    this.stack.push(s);
    s.onEnter();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.onExit();
    this.top()?.onResume();
  }

  replace(s: Scene): void {
    const old = this.stack.pop();
    old?.onExit();
    this.stack.push(s);
    s.onEnter();
  }

  top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  update(dt: number): void {
    this.top()?.update(dt);
  }

  render(alpha: number): void {
    for (const s of this.stack) s.render(alpha);
  }

  clear(): void {
    while (this.stack.length) this.pop();
  }
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `pnpm --filter @osi/engine test scene`
Expected: all 3 scene tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/scene packages/engine/tests/scene
git commit -m "feat(engine): Scene + SceneManager stack with enter/exit/pause/resume"
```

---

### Task 9: Keyboard + Pointer + InputMap

**Files:**
- Create: `packages/engine/src/input/keyboard.ts`
- Create: `packages/engine/src/input/pointer.ts`
- Create: `packages/engine/src/input/input-map.ts`

No unit tests — browser DOM APIs; tested via gameplay.

- [ ] **Step 1: Implement `packages/engine/src/input/keyboard.ts`**

```ts
export class Keyboard {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private releasedThisFrame = new Set<string>();
  private onDown = (e: KeyboardEvent) => {
    if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
    this.down.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => {
    if (this.down.has(e.code)) this.releasedThisFrame.add(e.code);
    this.down.delete(e.code);
  };

  attach(target: Window | HTMLElement = window): void {
    target.addEventListener('keydown', this.onDown as EventListener);
    target.addEventListener('keyup', this.onUp as EventListener);
  }

  detach(target: Window | HTMLElement = window): void {
    target.removeEventListener('keydown', this.onDown as EventListener);
    target.removeEventListener('keyup', this.onUp as EventListener);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  wasReleased(code: string): boolean {
    return this.releasedThisFrame.has(code);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }
}
```

- [ ] **Step 2: Implement `packages/engine/src/input/pointer.ts`**

```ts
export class Pointer {
  x = 0;
  y = 0;
  down = false;
  clickedThisFrame = false;

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.x = e.clientX - r.left;
      this.y = e.clientY - r.top;
    });
    canvas.addEventListener('pointerdown', () => {
      this.down = true;
      this.clickedThisFrame = true;
    });
    canvas.addEventListener('pointerup', () => {
      this.down = false;
    });
  }

  endFrame(): void {
    this.clickedThisFrame = false;
  }
}
```

- [ ] **Step 3: Implement `packages/engine/src/input/input-map.ts`**

```ts
import { Keyboard } from './keyboard.js';

export type Action = string;

export class InputMap {
  private bindings = new Map<Action, string[]>();
  constructor(private kb: Keyboard) {}

  bind(action: Action, codes: string[]): this {
    this.bindings.set(action, codes);
    return this;
  }

  isDown(action: Action): boolean {
    const codes = this.bindings.get(action);
    if (!codes) return false;
    return codes.some((c) => this.kb.isDown(c));
  }

  wasPressed(action: Action): boolean {
    const codes = this.bindings.get(action);
    if (!codes) return false;
    return codes.some((c) => this.kb.wasPressed(c));
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @osi/engine typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/input
git commit -m "feat(engine): Keyboard + Pointer + InputMap"
```

---

## Phase 2 — Engine Render

### Task 10: Renderer with stacked layers + glow pass

**Files:**
- Create: `packages/engine/src/render/renderer.ts`

No unit test — rendering tested visually.

- [ ] **Step 1: Implement `packages/engine/src/render/renderer.ts`**

```ts
export type LayerName = string;

export interface LayerConfig {
  name: LayerName;
  postFx?: 'glow' | 'none';
  clear?: boolean;
}

interface InternalLayer extends LayerConfig {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class Renderer {
  readonly width: number;
  readonly height: number;
  readonly main: CanvasRenderingContext2D;
  private layers: InternalLayer[] = [];
  private byName = new Map<LayerName, InternalLayer>();

  constructor(private target: HTMLCanvasElement) {
    this.width = target.width;
    this.height = target.height;
    this.main = target.getContext('2d')!;
  }

  addLayer(cfg: LayerConfig): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const layer: InternalLayer = {
      ...cfg,
      canvas,
      ctx: canvas.getContext('2d')!,
    };
    this.layers.push(layer);
    this.byName.set(cfg.name, layer);
  }

  layer(name: LayerName): CanvasRenderingContext2D {
    const l = this.byName.get(name);
    if (!l) throw new Error(`layer not registered: ${name}`);
    return l.ctx;
  }

  beginFrame(): void {
    this.main.fillStyle = '#0d1117';
    this.main.fillRect(0, 0, this.width, this.height);
    for (const l of this.layers) {
      if (l.clear !== false) l.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  endFrame(): void {
    for (const l of this.layers) {
      if (l.postFx === 'glow') {
        this.main.save();
        this.main.globalCompositeOperation = 'lighter';
        this.main.filter = 'blur(6px)';
        this.main.drawImage(l.canvas, 0, 0);
        this.main.filter = 'none';
        this.main.globalCompositeOperation = 'source-over';
        this.main.drawImage(l.canvas, 0, 0);
        this.main.restore();
      } else {
        this.main.drawImage(l.canvas, 0, 0);
      }
    }
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @osi/engine typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/render/renderer.ts
git commit -m "feat(engine): stacked-layer Renderer with glow post-FX"
```

---

### Task 11: SpriteAtlas (Kenney XML + tint cache)

**Files:**
- Create: `packages/engine/src/render/sprite-atlas.ts`
- Create: `packages/engine/tests/render/sprite-atlas.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/render/sprite-atlas.test.ts
import { expect, test } from 'vitest';
import { parseAtlasXml } from '../../src/render/sprite-atlas.js';

const xml = `<?xml version="1.0"?>
<TextureAtlas imagePath="sheet.png">
  <SubTexture name="playerShip1_blue.png" x="0" y="0" width="99" height="75"/>
  <SubTexture name="laserBlue01.png" x="100" y="0" width="9" height="54"/>
</TextureAtlas>`;

test('parseAtlasXml returns sub-rects keyed by name', () => {
  const frames = parseAtlasXml(xml);
  expect(frames.get('playerShip1_blue.png')).toEqual({ x: 0, y: 0, w: 99, h: 75 });
  expect(frames.get('laserBlue01.png')).toEqual({ x: 100, y: 0, w: 9, h: 54 });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test sprite-atlas`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/engine/src/render/sprite-atlas.ts`**

```ts
export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseAtlasXml(xml: string): Map<string, AtlasFrame> {
  const frames = new Map<string, AtlasFrame>();
  const re = /<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    frames.set(m[1]!, {
      x: Number(m[2]),
      y: Number(m[3]),
      w: Number(m[4]),
      h: Number(m[5]),
    });
  }
  return frames;
}

export class SpriteAtlas {
  private image: HTMLImageElement | null = null;
  private frames: Map<string, AtlasFrame> = new Map();
  private tintCache = new Map<string, HTMLCanvasElement>();

  async load(imageUrl: string, xmlUrl: string): Promise<void> {
    const [img, xml] = await Promise.all([
      loadImage(imageUrl),
      fetch(xmlUrl).then((r) => r.text()),
    ]);
    this.image = img;
    this.frames = parseAtlasXml(xml);
  }

  has(name: string): boolean {
    return this.frames.has(name);
  }

  frame(name: string): AtlasFrame {
    const f = this.frames.get(name);
    if (!f) throw new Error(`sprite not found: ${name}`);
    return f;
  }

  draw(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, scale = 1): void {
    if (!this.image) return;
    const f = this.frame(name);
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      dx - (f.w * scale) / 2,
      dy - (f.h * scale) / 2,
      f.w * scale,
      f.h * scale,
    );
  }

  drawTinted(
    ctx: CanvasRenderingContext2D,
    name: string,
    dx: number,
    dy: number,
    tint: string,
    scale = 1,
  ): void {
    if (!this.image) return;
    const key = `${name}|${tint}`;
    let cached = this.tintCache.get(key);
    if (!cached) {
      const f = this.frame(name);
      cached = document.createElement('canvas');
      cached.width = f.w;
      cached.height = f.h;
      const c = cached.getContext('2d')!;
      c.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = tint;
      c.fillRect(0, 0, f.w, f.h);
      this.tintCache.set(key, cached);
    }
    ctx.drawImage(
      cached,
      dx - (cached.width * scale) / 2,
      dy - (cached.height * scale) / 2,
      cached.width * scale,
      cached.height * scale,
    );
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test sprite-atlas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/render/sprite-atlas.ts packages/engine/tests/render/sprite-atlas.test.ts
git commit -m "feat(engine): SpriteAtlas with Kenney XML loader + tint cache"
```

---

### Task 12: Camera (pan/offset + world-to-screen)

**Files:**
- Create: `packages/engine/src/render/camera.ts`
- Create: `packages/engine/tests/render/camera.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/render/camera.test.ts
import { expect, test } from 'vitest';
import { Camera } from '../../src/render/camera.js';

test('worldToScreen respects pan', () => {
  const cam = new Camera();
  cam.x = 100;
  cam.y = 50;
  const s = cam.worldToScreen(150, 80);
  expect(s).toEqual({ x: 50, y: 30 });
});

test('shakeOffset applies to output', () => {
  const cam = new Camera();
  cam.shakeOffsetX = 4;
  cam.shakeOffsetY = -2;
  const s = cam.worldToScreen(0, 0);
  expect(s).toEqual({ x: 4, y: -2 });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test camera`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/engine/src/render/camera.ts`**

```ts
export class Camera {
  x = 0;
  y = 0;
  shakeOffsetX = 0;
  shakeOffsetY = 0;

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x + this.shakeOffsetX, y: wy - this.y + this.shakeOffsetY };
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-this.x + this.shakeOffsetX, -this.y + this.shakeOffsetY);
  }

  restore(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test camera`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/render/camera.ts packages/engine/tests/render/camera.test.ts
git commit -m "feat(engine): Camera with pan + shake offset"
```

---

### Task 13: ScreenShake (Perlin decay, stacking, amplitude cap)

**Files:**
- Create: `packages/engine/src/util/perlin.ts`
- Create: `packages/engine/src/fx/screen-shake.ts`
- Create: `packages/engine/tests/fx/screen-shake.test.ts`

- [ ] **Step 1: Implement `packages/engine/src/util/perlin.ts`** (1D value-noise, deterministic)

```ts
const PERM: number[] = (() => {
  const p = new Array(512);
  const base = [];
  for (let i = 0; i < 256; i++) base.push(i);
  // Fisher-Yates with fixed seed for determinism
  let seed = 1234567;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) p[i] = base[i % 256]!;
  return p;
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (hash: number, x: number) => ((hash & 1) === 0 ? x : -x);

export function perlin1(x: number): number {
  const xi = Math.floor(x) & 255;
  const xf = x - Math.floor(x);
  const u = fade(xf);
  const a = PERM[xi]!;
  const b = PERM[xi + 1]!;
  return ((1 - u) * grad(a, xf) + u * grad(b, xf - 1));
}
```

- [ ] **Step 2: Write failing test**

```ts
// packages/engine/tests/fx/screen-shake.test.ts
import { expect, test } from 'vitest';
import { ScreenShake } from '../../src/fx/screen-shake.js';

test('single shake decays to zero', () => {
  const s = new ScreenShake({ maxAmplitude: 20 });
  s.add({ amplitude: 10, duration: 0.1 });
  for (let i = 0; i < 20; i++) s.update(0.01);
  expect(Math.abs(s.offsetX)).toBeLessThan(0.0001);
  expect(Math.abs(s.offsetY)).toBeLessThan(0.0001);
});

test('stacked shakes add offsets but cap at maxAmplitude', () => {
  const s = new ScreenShake({ maxAmplitude: 5 });
  for (let i = 0; i < 10; i++) s.add({ amplitude: 10, duration: 1 });
  s.update(0.016);
  expect(Math.abs(s.offsetX)).toBeLessThanOrEqual(5 + 1e-6);
  expect(Math.abs(s.offsetY)).toBeLessThanOrEqual(5 + 1e-6);
});

test('zero duration removes shake immediately', () => {
  const s = new ScreenShake({ maxAmplitude: 20 });
  s.add({ amplitude: 5, duration: 0 });
  s.update(0.016);
  expect(s.activeCount()).toBe(0);
});
```

- [ ] **Step 3: Run test, expect failure**

Run: `pnpm --filter @osi/engine test screen-shake`
Expected: FAIL.

- [ ] **Step 4: Implement `packages/engine/src/fx/screen-shake.ts`**

```ts
import { perlin1 } from '../util/perlin.js';
import { clamp } from '../util/math.js';

export interface ShakeOptions {
  amplitude: number;
  duration: number;
}

interface ActiveShake {
  amp: number;
  remaining: number;
  total: number;
  seedX: number;
  seedY: number;
}

export interface ScreenShakeConfig {
  maxAmplitude: number;
}

export class ScreenShake {
  offsetX = 0;
  offsetY = 0;
  private shakes: ActiveShake[] = [];
  private t = 0;

  constructor(private cfg: ScreenShakeConfig) {}

  add(opts: ShakeOptions): void {
    if (opts.duration <= 0) return;
    this.shakes.push({
      amp: opts.amplitude,
      remaining: opts.duration,
      total: opts.duration,
      seedX: Math.random() * 1000,
      seedY: Math.random() * 1000,
    });
  }

  update(dt: number): void {
    this.t += dt;
    let sx = 0;
    let sy = 0;
    const next: ActiveShake[] = [];
    for (const s of this.shakes) {
      s.remaining -= dt;
      if (s.remaining <= 0) continue;
      const decay = s.remaining / s.total;
      const amp = s.amp * decay * decay;
      sx += perlin1(s.seedX + this.t * 25) * amp;
      sy += perlin1(s.seedY + this.t * 25) * amp;
      next.push(s);
    }
    this.shakes = next;
    this.offsetX = clamp(sx, -this.cfg.maxAmplitude, this.cfg.maxAmplitude);
    this.offsetY = clamp(sy, -this.cfg.maxAmplitude, this.cfg.maxAmplitude);
  }

  activeCount(): number {
    return this.shakes.length;
  }

  clear(): void {
    this.shakes.length = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `pnpm --filter @osi/engine test screen-shake`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/util/perlin.ts packages/engine/src/fx/screen-shake.ts packages/engine/tests/fx/screen-shake.test.ts
git commit -m "feat(engine): ScreenShake with Perlin decay + amplitude cap"
```

---

## Phase 3 — Engine FX

### Task 14: ParticleEmitter (pooled, Float32Array, 5 pools)

**Files:**
- Create: `packages/engine/src/fx/particles.ts`
- Create: `packages/engine/tests/fx/particles.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/fx/particles.test.ts
import { expect, test } from 'vitest';
import { ParticleEmitter } from '../../src/fx/particles.js';

test('pool respects capacity, spawns are rejected when full', () => {
  const p = new ParticleEmitter({ capacity: 4 });
  for (let i = 0; i < 10; i++) p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  expect(p.aliveCount()).toBe(4);
});

test('particles decrement life and recycle when dead', () => {
  const p = new ParticleEmitter({ capacity: 3 });
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 0.05 });
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  p.update(0.1);
  expect(p.aliveCount()).toBe(1);
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  expect(p.aliveCount()).toBe(2);
});

test('update integrates velocity into position', () => {
  const p = new ParticleEmitter({ capacity: 1 });
  p.spawn({ x: 0, y: 0, vx: 10, vy: -5, life: 1 });
  p.update(0.5);
  const [x, y] = p.debugFirst();
  expect(x).toBeCloseTo(5);
  expect(y).toBeCloseTo(-2.5);
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test particles`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/engine/src/fx/particles.ts`**

```ts
export interface ParticleSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface ParticleConfig {
  capacity: number;
  gravity?: number;
  drawColor?: string;
  drawSize?: number;
}

const STRIDE = 6; // x, y, vx, vy, life, maxLife

export class ParticleEmitter {
  private data: Float32Array;
  private alive: Uint8Array;
  private cursor = 0;
  private _count = 0;

  constructor(private cfg: ParticleConfig) {
    this.data = new Float32Array(cfg.capacity * STRIDE);
    this.alive = new Uint8Array(cfg.capacity);
  }

  spawn(s: ParticleSpawn): boolean {
    const cap = this.cfg.capacity;
    // linear probe for a free slot, starting at cursor
    for (let i = 0; i < cap; i++) {
      const idx = (this.cursor + i) % cap;
      if (!this.alive[idx]) {
        this.alive[idx] = 1;
        const o = idx * STRIDE;
        this.data[o] = s.x;
        this.data[o + 1] = s.y;
        this.data[o + 2] = s.vx;
        this.data[o + 3] = s.vy;
        this.data[o + 4] = s.life;
        this.data[o + 5] = s.life;
        this.cursor = (idx + 1) % cap;
        this._count++;
        return true;
      }
    }
    return false;
  }

  update(dt: number): void {
    const g = this.cfg.gravity ?? 0;
    const cap = this.cfg.capacity;
    for (let i = 0; i < cap; i++) {
      if (!this.alive[i]) continue;
      const o = i * STRIDE;
      this.data[o + 4]! -= dt;
      if (this.data[o + 4]! <= 0) {
        this.alive[i] = 0;
        this._count--;
        continue;
      }
      this.data[o]! += this.data[o + 2]! * dt;
      this.data[o + 1]! += this.data[o + 3]! * dt;
      this.data[o + 3]! += g * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const color = this.cfg.drawColor ?? '#ffffff';
    const size = this.cfg.drawSize ?? 2;
    const cap = this.cfg.capacity;
    ctx.save();
    for (let i = 0; i < cap; i++) {
      if (!this.alive[i]) continue;
      const o = i * STRIDE;
      const life = this.data[o + 4]! / this.data[o + 5]!;
      ctx.globalAlpha = Math.max(0, life);
      ctx.fillStyle = color;
      ctx.fillRect(this.data[o]! - size / 2, this.data[o + 1]! - size / 2, size, size);
    }
    ctx.restore();
  }

  aliveCount(): number {
    return this._count;
  }

  debugFirst(): [number, number] {
    for (let i = 0; i < this.cfg.capacity; i++) {
      if (this.alive[i]) return [this.data[i * STRIDE]!, this.data[i * STRIDE + 1]!];
    }
    return [NaN, NaN];
  }

  clear(): void {
    this.alive.fill(0);
    this._count = 0;
    this.cursor = 0;
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test particles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/fx/particles.ts packages/engine/tests/fx/particles.test.ts
git commit -m "feat(engine): pooled ParticleEmitter backed by Float32Array"
```

---

### Task 15: Tween + Easing

**Files:**
- Create: `packages/engine/src/fx/tween.ts`
- Create: `packages/engine/tests/fx/tween.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/engine/tests/fx/tween.test.ts
import { expect, test, vi } from 'vitest';
import { Tween, Easing } from '../../src/fx/tween.js';

test('linear tween interpolates and completes', () => {
  const obj = { x: 0 };
  const t = new Tween(obj, { x: 10 }, { duration: 1, easing: Easing.linear });
  t.update(0.5);
  expect(obj.x).toBe(5);
  t.update(0.5);
  expect(obj.x).toBe(10);
  expect(t.done).toBe(true);
});

test('onComplete fires once', () => {
  const obj = { x: 0 };
  const fn = vi.fn();
  const t = new Tween(obj, { x: 1 }, { duration: 0.1, easing: Easing.linear, onComplete: fn });
  t.update(1);
  t.update(1);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('loop resets progress and re-interpolates', () => {
  const obj = { x: 0 };
  const t = new Tween(obj, { x: 10 }, { duration: 1, easing: Easing.linear, loop: true });
  t.update(1.5);
  expect(obj.x).toBeCloseTo(5);
  expect(t.done).toBe(false);
});

test('easeOutQuad is monotonic', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const v = Easing.easeOutQuad(i / 10);
    expect(v).toBeGreaterThanOrEqual(prev);
    prev = v;
  }
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/engine test tween`
Expected: FAIL.

- [ ] **Step 3: Implement `packages/engine/src/fx/tween.ts`**

```ts
export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

export interface TweenOptions {
  duration: number;
  easing?: (t: number) => number;
  loop?: boolean;
  onComplete?: () => void;
}

export class Tween<T extends Record<string, number>> {
  done = false;
  private elapsed = 0;
  private start: Partial<T> = {};
  private completedFired = false;

  constructor(
    private target: T,
    private to: Partial<T>,
    private opts: TweenOptions,
  ) {
    for (const k of Object.keys(to)) {
      (this.start as Record<string, number>)[k] = target[k as keyof T] as number;
    }
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const raw = this.elapsed / this.opts.duration;
    if (raw >= 1 && !this.opts.loop) {
      for (const k of Object.keys(this.to)) {
        (this.target as Record<string, number>)[k] = this.to[k as keyof T] as number;
      }
      this.done = true;
      if (!this.completedFired) {
        this.completedFired = true;
        this.opts.onComplete?.();
      }
      return;
    }
    const t = this.opts.loop ? raw - Math.floor(raw) : Math.min(raw, 1);
    const ease = (this.opts.easing ?? Easing.linear)(t);
    for (const k of Object.keys(this.to)) {
      const s = (this.start as Record<string, number>)[k]!;
      const e = this.to[k as keyof T] as number;
      (this.target as Record<string, number>)[k] = s + (e - s) * ease;
    }
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/engine test tween`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/fx/tween.ts packages/engine/tests/fx/tween.test.ts
git commit -m "feat(engine): Tween + Easing with loop and onComplete"
```

---

## Phase 4 — Engine Audio + Exports

### Task 16: AudioBus + Sfx pool

**Files:**
- Create: `packages/engine/src/audio/audio-bus.ts`
- Create: `packages/engine/src/audio/sfx.ts`

No unit test (Web Audio is a browser API, tested in gameplay).

- [ ] **Step 1: Implement `packages/engine/src/audio/audio-bus.ts`**

```ts
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private unlocked = false;
  private pendingUnlock: (() => void)[] = [];

  async init(): Promise<void> {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  }

  // Call from first user gesture to satisfy autoplay policy.
  unlock(): void {
    if (this.unlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    for (const cb of this.pendingUnlock) cb();
    this.pendingUnlock.length = 0;
  }

  onUnlocked(cb: () => void): void {
    if (this.unlocked) cb();
    else this.pendingUnlock.push(cb);
  }

  async loadBuffer(url: string): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('AudioBus not initialized');
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return this.ctx.decodeAudioData(arr);
  }

  playSfx(buf: AudioBuffer, { pitch = 1, volume = 1 } = {}): void {
    if (!this.ctx || !this.sfxGain || !this.unlocked) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  playMusic(buf: AudioBuffer, { loop = true, volume = 1 } = {}): () => void {
    if (!this.ctx || !this.musicGain) return () => {};
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.musicGain);
    src.start();
    return () => {
      try { src.stop(); } catch {}
    };
  }

  setMusicVolume(v: number): void {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfxVolume(v: number): void {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
}
```

- [ ] **Step 2: Implement `packages/engine/src/audio/sfx.ts`**

```ts
import { AudioBus } from './audio-bus.js';

export class Sfx {
  private buffers = new Map<string, AudioBuffer>();
  constructor(private bus: AudioBus) {}

  async load(map: Record<string, string>): Promise<void> {
    const entries = await Promise.all(
      Object.entries(map).map(async ([name, url]) => [name, await this.bus.loadBuffer(url)] as const),
    );
    for (const [name, buf] of entries) this.buffers.set(name, buf);
  }

  play(name: string, opts?: { pitch?: number; volume?: number }): void {
    const buf = this.buffers.get(name);
    if (!buf) return;
    this.bus.playSfx(buf, opts);
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @osi/engine typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/audio
git commit -m "feat(engine): AudioBus + Sfx pool with autoplay unlock"
```

---

### Task 17: Engine barrel exports

**Files:**
- Modify: `packages/engine/src/index.ts`

- [ ] **Step 1: Replace `packages/engine/src/index.ts` with full barrel**

```ts
export const ENGINE_VERSION = '0.1.0';

// util
export { clamp, lerp, randRange } from './util/math.js';
export { Vec2 } from './util/vec2.js';
export { Rect } from './util/rect.js';
export { perlin1 } from './util/perlin.js';

// core
export { World, defineComponent } from './core/world.js';
export type { Entity, Component } from './core/world.js';
export { GameLoop } from './core/gameloop.js';
export { EventBus } from './core/events.js';

// scene
export { Scene } from './scene/scene.js';
export { SceneManager } from './scene/scene-manager.js';

// input
export { Keyboard } from './input/keyboard.js';
export { Pointer } from './input/pointer.js';
export { InputMap } from './input/input-map.js';

// render
export { Renderer } from './render/renderer.js';
export type { LayerConfig, LayerName } from './render/renderer.js';
export { SpriteAtlas, parseAtlasXml } from './render/sprite-atlas.js';
export type { AtlasFrame } from './render/sprite-atlas.js';
export { Camera } from './render/camera.js';

// fx
export { ParticleEmitter } from './fx/particles.js';
export type { ParticleSpawn, ParticleConfig } from './fx/particles.js';
export { Tween, Easing } from './fx/tween.js';
export { ScreenShake } from './fx/screen-shake.js';

// audio
export { AudioBus } from './audio/audio-bus.js';
export { Sfx } from './audio/sfx.js';
```

- [ ] **Step 2: Typecheck + all tests**

Run: `pnpm --filter @osi/engine typecheck && pnpm --filter @osi/engine test`
Expected: typecheck clean; all engine tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/index.ts
git commit -m "feat(engine): expose barrel index for all subsystems"
```

---

## Phase 5 — Invaders Data Pipeline

### Task 18: GitHub client (fetch + PAT + cache)

**Files:**
- Create: `games/invaders/src/data/github-client.ts`

- [ ] **Step 1: Implement `games/invaders/src/data/github-client.ts`**

```ts
const BASE = 'https://api.github.com';
const TOKEN_KEY = 'osi:gh-token';

export class GitHubRateLimitError extends Error {
  constructor() {
    super('GitHub API rate limit exceeded');
    this.name = 'GitHubRateLimitError';
  }
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  default_branch: string;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  contributions: number;
}

export interface GitHubCommit {
  sha: string;
  commit: { author: { date: string } | null };
  author: { login: string } | null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') throw new GitHubRateLimitError();
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export async function getRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return gh(`/repos/${owner}/${repo}`);
}

export async function getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
  return gh(`/repos/${owner}/${repo}/contributors?per_page=30`);
}

export async function getCommitsForAuthor(
  owner: string,
  repo: string,
  login: string,
  sinceIso: string,
): Promise<GitHubCommit[]> {
  const out: GitHubCommit[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<GitHubCommit[]>(
      `/repos/${owner}/${repo}/commits?author=${encodeURIComponent(login)}&since=${sinceIso}&per_page=100&page=${page}`,
    );
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export async function getReadme(owner: string, repo: string): Promise<string> {
  const data = await gh<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`);
  return data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;
}

export async function getContents(
  owner: string,
  repo: string,
  path = '',
): Promise<Array<{ name: string; path: string; type: string }>> {
  return gh(`/repos/${owner}/${repo}/contents/${path}`);
}

export async function tryGetFile(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const data = await gh<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}`,
    );
    return data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @osi/invaders typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/data/github-client.ts
git commit -m "feat(invaders): GitHub client with PAT + rate limit detection"
```

---

### Task 19: Contributor stats aggregator

**Files:**
- Create: `games/invaders/src/data/contributor-stats.ts`

- [ ] **Step 1: Implement `games/invaders/src/data/contributor-stats.ts`**

```ts
import type { GitHubCommit } from './github-client.js';

export interface DailyCommitCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface ContributorStats {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  daily: DailyCommitCount[]; // 365 entries, oldest first
}

export function aggregateDaily(commits: GitHubCommit[]): DailyCommitCount[] {
  const map = new Map<string, number>();
  for (const c of commits) {
    const iso = c.commit.author?.date;
    if (!iso) continue;
    const day = iso.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  // Fill 365 days back from today
  const out: DailyCommitCount[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, count: map.get(iso) ?? 0 });
  }
  return out;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/data/contributor-stats.ts
git commit -m "feat(invaders): aggregate commits into 365-day daily series"
```

---

### Task 20: sessionStorage cache wrapper

**Files:**
- Modify: `games/invaders/src/data/github-client.ts` (add `withCache`)

- [ ] **Step 1: Append to `games/invaders/src/data/github-client.ts`**

```ts
// --- session cache ---
const CACHE_PREFIX = 'osi:cache:';

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full — ignore
  }
}

export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fetcher();
  cacheSet(key, value);
  return value;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/data/github-client.ts
git commit -m "feat(invaders): sessionStorage cache for GitHub responses"
```

---

### Task 21: Contributor → Level mapping (pure, tested)

**Files:**
- Create: `games/invaders/src/data/mapping.ts`
- Create: `games/invaders/src/tests/mapping.test.ts`
- Create: `games/invaders/vitest.config.ts`

- [ ] **Step 1: Write `games/invaders/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write failing test `games/invaders/src/tests/mapping.test.ts`**

```ts
import { expect, test } from 'vitest';
import { contributorToLevel, enemyFromCommits } from '../data/mapping.js';
import type { ContributorStats } from '../data/contributor-stats.js';

test('0 commits produces no enemy', () => {
  expect(enemyFromCommits(0, 0)).toBeNull();
});

test('enemy hp scales with level index', () => {
  const e1 = enemyFromCommits(4, 0)!;
  const e2 = enemyFromCommits(4, 4)!;
  expect(e2.hp).toBeGreaterThan(e1.hp);
  expect(e1.hp).toBeGreaterThanOrEqual(1);
});

test('enemy color buckets match contribution graph scale', () => {
  expect(enemyFromCommits(0, 0)).toBeNull();
  expect(enemyFromCommits(1, 0)!.color).toBe('#0e4429');
  expect(enemyFromCommits(5, 0)!.color).toBe('#006d32');
  expect(enemyFromCommits(8, 0)!.color).toBe('#26a641');
  expect(enemyFromCommits(25, 0)!.color).toBe('#39d353');
});

test('contributorToLevel produces 52 weeks of waves', () => {
  const stats: ContributorStats = {
    login: 'octocat',
    avatarUrl: 'https://example/avatar.png',
    totalCommits: 100,
    daily: Array.from({ length: 365 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      count: i % 5,
    })),
  };
  const level = contributorToLevel(stats, { id: 'octocat', login: 'octocat', name: 'octocat' }, 2);
  expect(level.waves.length).toBe(52);
  for (const w of level.waves) expect(w.enemies.length).toBeLessThanOrEqual(7);
});
```

- [ ] **Step 3: Run test, expect failure**

Run: `pnpm --filter @osi/invaders test`
Expected: FAIL.

- [ ] **Step 4: Implement `games/invaders/src/data/mapping.ts`**

```ts
import type { ContributorStats } from './contributor-stats.js';
import { BALANCE } from '../config/balance.js';

export interface EnemySpec {
  date: string;
  commits: number;
  hp: number;
  fireRate: number;
  color: string;
}

export interface Wave {
  weekStart: string;
  enemies: EnemySpec[];
}

export interface ContributorInfo {
  id: string;
  login: string;
  name: string;
}

export interface Level {
  contributor: ContributorInfo & { avatar?: string; totalCommits?: number };
  waves: Wave[];
}

export function enemyFromCommits(commits: number, levelIndex: number): EnemySpec | null {
  if (commits <= 0) return null;
  const hpBase = Math.ceil(commits / 2);
  const hp = Math.max(1, Math.ceil(hpBase * (1 + levelIndex * BALANCE.levelDifficultyStep)));
  const fireRate = (BALANCE.baseFireRate + commits * BALANCE.fireRatePerCommit) *
    (1 + levelIndex * BALANCE.levelDifficultyStep);
  return {
    date: '',
    commits,
    hp,
    fireRate,
    color: bucketColor(commits),
  };
}

function bucketColor(commits: number): string {
  if (commits <= 0) return '#161b22';
  if (commits <= 3) return '#0e4429';
  if (commits <= 6) return '#006d32';
  if (commits <= 9) return '#26a641';
  return '#39d353';
}

export function contributorToLevel(
  stats: ContributorStats,
  info: ContributorInfo,
  levelIndex: number,
): Level {
  const waves: Wave[] = [];
  for (let w = 0; w < 52; w++) {
    const slice = stats.daily.slice(w * 7, w * 7 + 7);
    if (slice.length === 0) break;
    const enemies: EnemySpec[] = [];
    for (const day of slice) {
      const e = enemyFromCommits(day.count, levelIndex);
      if (e) enemies.push({ ...e, date: day.date });
    }
    waves.push({ weekStart: slice[0]!.date, enemies });
  }
  return {
    contributor: {
      ...info,
      avatar: stats.avatarUrl,
      totalCommits: stats.totalCommits,
    },
    waves,
  };
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `pnpm --filter @osi/invaders test`
Expected: all 4 mapping tests pass.

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/data/mapping.ts games/invaders/src/tests/mapping.test.ts games/invaders/vitest.config.ts
git commit -m "feat(invaders): pure contributor→Level mapping with balance formula"
```

---

### Task 22: Knowledge extractor (README → tagged chunks + 5-level arc)

**Files:**
- Create: `games/invaders/src/data/knowledge-extractor.ts`
- Create: `games/invaders/src/tests/knowledge-extractor.test.ts`

- [ ] **Step 1: Write failing test `games/invaders/src/tests/knowledge-extractor.test.ts`**

```ts
import { expect, test } from 'vitest';
import { extractChunks, selectArc } from '../data/knowledge-extractor.js';

const readme = `
# My Project

> A small, fast tool for parsing things.

## Features

- Fast lexing
- Zero deps

## How it works

The parser walks tokens and builds a tree. It is **deterministic** and streaming.

## Usage

\`\`\`ts
const ast = parse('1 + 2');
\`\`\`
`;

test('extractChunks tags QUOTE, FEATURE, CONCEPT, CODE, FACT', () => {
  const chunks = extractChunks(readme, 'README.md');
  const kinds = new Set(chunks.map((c) => c.kind));
  expect(kinds.has('QUOTE')).toBe(true);
  expect(kinds.has('FEATURE')).toBe(true);
  expect(kinds.has('CONCEPT')).toBe(true);
  expect(kinds.has('CODE')).toBe(true);
  expect(kinds.has('FACT')).toBe(true);
});

test('selectArc returns 5 deterministically-picked chunks', () => {
  const chunks = extractChunks(readme, 'README.md');
  const arc1 = selectArc(chunks, 'owner/repo');
  const arc2 = selectArc(chunks, 'owner/repo');
  expect(arc1.length).toBe(5);
  expect(arc1.map((c) => c.kind)).toEqual(arc2.map((c) => c.kind));
});

test('selectArc respects preferred kinds per level when available', () => {
  const chunks = extractChunks(readme, 'README.md');
  const arc = selectArc(chunks, 'owner/repo');
  // Level 2 should be FEATURE when one exists
  expect(arc[1]!.kind).toBe('FEATURE');
  // Level 4 should be CODE when one exists
  expect(arc[3]!.kind).toBe('CODE');
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/invaders test knowledge`
Expected: FAIL.

- [ ] **Step 3: Implement `games/invaders/src/data/knowledge-extractor.ts`**

```ts
import { marked, type Tokens } from 'marked';

export type Chunk =
  | { kind: 'FEATURE'; text: string; source: string }
  | { kind: 'CODE'; lang: string; code: string; source: string }
  | { kind: 'CONCEPT'; heading: string; body: string; source: string }
  | { kind: 'QUOTE'; text: string; source: string }
  | { kind: 'FACT'; text: string; source: string };

const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript', 'py', 'python', 'rust', 'rs', 'go', 'java', 'cpp', 'c++', 'sh', 'bash']);
const SKIP_HEADING_RE = /^(install|installation|license|table of contents|toc|badges)$/i;

export function extractChunks(markdown: string, source: string): Chunk[] {
  const tokens = marked.lexer(markdown);
  const chunks: Chunk[] = [];
  let currentHeading: string | null = null;
  let underFeatures = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === 'heading') {
      const h = t as Tokens.Heading;
      currentHeading = h.text.trim();
      underFeatures = /^features?$/i.test(currentHeading);
      if (SKIP_HEADING_RE.test(currentHeading)) {
        currentHeading = null;
        continue;
      }
      const next = tokens[i + 1];
      if (next && next.type === 'paragraph') {
        const body = (next as Tokens.Paragraph).text.trim();
        if (body.length > 0) {
          chunks.push({ kind: 'CONCEPT', heading: currentHeading, body, source });
        }
      }
    } else if (t.type === 'code') {
      const c = t as Tokens.Code;
      const lang = (c.lang ?? '').toLowerCase();
      if (CODE_LANGS.has(lang) || CODE_LANGS.has(lang.split(' ')[0]!)) {
        chunks.push({ kind: 'CODE', lang, code: c.text, source });
      }
    } else if (t.type === 'blockquote') {
      const bq = t as Tokens.Blockquote;
      const text = bq.tokens
        ?.map((tok) => (tok.type === 'paragraph' ? (tok as Tokens.Paragraph).text : ''))
        .join(' ')
        .trim() ?? '';
      if (text.length > 0) chunks.push({ kind: 'QUOTE', text, source });
    } else if (t.type === 'list' && underFeatures) {
      const l = t as Tokens.List;
      for (const item of l.items) {
        chunks.push({ kind: 'FEATURE', text: item.text.trim(), source });
      }
    } else if (t.type === 'paragraph') {
      const p = t as Tokens.Paragraph;
      const boldRe = /\*\*([^*]+)\*\*/g;
      let m: RegExpExecArray | null;
      while ((m = boldRe.exec(p.text)) !== null) {
        chunks.push({ kind: 'FACT', text: m[1]!, source });
      }
    }
  }

  return chunks;
}

function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFERRED: Chunk['kind'][] = ['QUOTE', 'FEATURE', 'CONCEPT', 'CODE', 'QUOTE'];

export function selectArc(chunks: Chunk[], repoFullName: string): Chunk[] {
  const rng = seededRng(repoFullName);
  const out: Chunk[] = [];
  const used = new Set<number>();
  for (let level = 0; level < 5; level++) {
    const preferred = PREFERRED[level]!;
    const candidates = chunks
      .map((c, idx) => ({ c, idx }))
      .filter(({ c, idx }) => c.kind === preferred && !used.has(idx));
    let chosen: { c: Chunk; idx: number } | undefined;
    if (candidates.length > 0) {
      chosen = candidates[Math.floor(rng() * candidates.length)];
    } else {
      const any = chunks
        .map((c, idx) => ({ c, idx }))
        .filter(({ idx }) => !used.has(idx));
      if (any.length === 0) {
        out.push({ kind: 'FACT', text: 'Open source is forever.', source: 'fallback' });
        continue;
      }
      chosen = any[Math.floor(rng() * any.length)];
    }
    used.add(chosen!.idx);
    out.push(chosen!.c);
  }
  return out;
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/invaders test knowledge`
Expected: all 3 knowledge tests pass.

- [ ] **Step 5: Commit**

```bash
git add games/invaders/src/data/knowledge-extractor.ts games/invaders/src/tests/knowledge-extractor.test.ts
git commit -m "feat(invaders): README lexer → tagged chunks + seeded 5-level arc"
```

---

## Phase 6 — Invaders Config + Components

### Task 23: balance.ts + ships.ts + powerups.ts

**Files:**
- Create: `games/invaders/src/config/balance.ts`
- Create: `games/invaders/src/config/ships.ts`
- Create: `games/invaders/src/config/powerups.ts`

- [ ] **Step 1: Write `games/invaders/src/config/balance.ts`**

```ts
export const BALANCE = {
  // World
  viewportWidth: 960,
  viewportHeight: 600,
  fixedDt: 1 / 60,

  // Difficulty
  levelDifficultyStep: 0.25,
  baseFireRate: 0.2,
  fireRatePerCommit: 0.05,

  // Player
  playerSpeed: 260,
  playerFireCooldown: 0.18,
  playerInvulnSeconds: 1.2,
  playerBulletSpeed: 520,

  // Enemies
  enemyMarchSpeed: 18,
  enemyDropDistance: 14,
  enemyBulletSpeed: 240,
  enemyBulletJitter: 0.3,

  // Powerups
  powerupDropChance: 0.22, // only hard squares qualify (commits >= 10)
  powerupFallSpeed: 80,
  powerupRebaseSlow: 0.5,
  powerupRebaseDuration: 5,
  powerupBombRadiusPx: 9999,
  maxBombsPerLevel: 1,

  // Hit-stop
  hitStopNonFatalMs: 30,
  hitStopFatalMs: 50,
  hitStopBossPhaseMs: 600,

  // Screen shake
  shakeHitNonFatal: { amplitude: 2, duration: 0.08 },
  shakeHitFatal: { amplitude: 4, duration: 0.15 },
  shakePlayerHit: { amplitude: 8, duration: 0.3 },
  shakeBossPhase: { amplitude: 12, duration: 0.5 },
  shakeMaxAmplitude: 18,

  // Boss
  bossPhase1Hp: 300,
  bossPhase1End: 200,
  bossPhase2DroneHp: 60,
  bossPhase3Hp: 100,

  // Chaos
  chaosWindowStart: 0.3,
  chaosWindowEnd: 0.7,

  // Particles
  particleCapacities: {
    sparks: 500,
    explosions: 300,
    bigExplosions: 150,
    stars: 200,
    powerupDust: 100,
  },

  // Colors (GitHub dark)
  bg: '#0d1117',
  bgAlt: '#161b22',
  accentCyan: '#58a6ff',
  accentGreen: '#3fb950',
  accentRed: '#f85149',
  accentYellow: '#d29922',
} as const;
```

- [ ] **Step 2: Write `games/invaders/src/config/ships.ts`**

```ts
export interface ShipTier {
  level: number;
  sprite: string;
  maxHp: number;
  speedMultiplier: number;
  shots: number;
  idleRegen: boolean;
}

export const SHIP_TIERS: ShipTier[] = [
  { level: 1, sprite: 'playerShip1_blue.png',   maxHp: 3, speedMultiplier: 1.00, shots: 1, idleRegen: false },
  { level: 2, sprite: 'playerShip2_blue.png',   maxHp: 4, speedMultiplier: 1.00, shots: 1, idleRegen: false },
  { level: 3, sprite: 'playerShip3_blue.png',   maxHp: 4, speedMultiplier: 1.00, shots: 2, idleRegen: false },
  { level: 4, sprite: 'playerShip2_orange.png', maxHp: 5, speedMultiplier: 1.15, shots: 2, idleRegen: false },
  { level: 5, sprite: 'playerShip3_red.png',    maxHp: 5, speedMultiplier: 1.15, shots: 3, idleRegen: true  },
];
```

- [ ] **Step 3: Write `games/invaders/src/config/powerups.ts`**

```ts
export type PowerupKind = 'revert' | 'fork' | 'rebase' | 'squash' | 'forcepush';

export interface PowerupDef {
  kind: PowerupKind;
  label: string;
  color: string;
}

export const POWERUPS: PowerupDef[] = [
  { kind: 'revert',    label: 'git revert', color: '#3fb950' },
  { kind: 'fork',      label: 'fork',       color: '#58a6ff' },
  { kind: 'rebase',    label: 'rebase',     color: '#d29922' },
  { kind: 'squash',    label: 'squash',     color: '#a371f7' },
  { kind: 'forcepush', label: 'force push', color: '#f85149' },
];
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/config
git commit -m "feat(invaders): balance/ships/powerups config with all magic numbers"
```

---

### Task 24: ECS components module

**Files:**
- Create: `games/invaders/src/components/index.ts`

- [ ] **Step 1: Implement `games/invaders/src/components/index.ts`**

```ts
import { defineComponent } from '@osi/engine';
import type { PowerupKind } from '../config/powerups.js';

export const Position = defineComponent<{ x: number; y: number }>('Position');
export const Velocity = defineComponent<{ vx: number; vy: number }>('Velocity');
export const SpriteRef = defineComponent<{ name: string; scale: number; tint?: string }>('SpriteRef');
export const Collider = defineComponent<{ w: number; h: number }>('Collider');
export const Health = defineComponent<{ hp: number; maxHp: number; flashUntil: number }>('Health');

export const Player = defineComponent<{
  tier: number;
  fireCooldown: number;
  invulnUntil: number;
  shotsMultiplier: 1 | 2 | 3;
  bombsLeft: number;
}>('Player');

export const Enemy = defineComponent<{
  commits: number;
  fireRate: number;
  fireAccumulator: number;
  color: string;
  hardSquare: boolean;
  row: number;
  col: number;
  worthYellow: boolean; // chaos: dependabot tint
}>('Enemy');

export const Bullet = defineComponent<{
  fromPlayer: boolean;
  damage: number;
  pierce: boolean;
}>('Bullet');

export const Powerup = defineComponent<{ kind: PowerupKind }>('Powerup');

export const Lifetime = defineComponent<{ remaining: number }>('Lifetime');

export const HitFlash = defineComponent<{ until: number }>('HitFlash');

export const BossTag = defineComponent<{
  phase: 1 | 2 | 3;
  phaseTime: number;
  fireTimer: number;
}>('BossTag');

export const Drone = defineComponent<{ targetX: number; targetY: number }>('Drone');
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/components
git commit -m "feat(invaders): ECS component definitions"
```

---

## Phase 7 — Invaders Systems

All systems are pure functions `(world, dt, ctx) => void`. `ctx` is a shared `GameContext` object (created in Task 41's GameplayScene). Its shape:

```ts
export interface GameContext {
  world: World;
  input: InputMap;
  events: EventBus<InvadersEvents>;
  gameLoop: GameLoop;
  screenShake: ScreenShake;
  particles: {
    sparks: ParticleEmitter;
    explosions: ParticleEmitter;
    bigExplosions: ParticleEmitter;
    stars: ParticleEmitter;
    powerupDust: ParticleEmitter;
  };
  tweens: Tween<any>[];
  sfx: Sfx;
  level: Level;
  levelIndex: number;
  state: {
    waveIndex: number;
    score: number;
    combo: number;
    comboExpires: number;
    chaosActive: { kind: string; until: number } | null;
  };
}
```

And events:

```ts
export type InvadersEvents = {
  enemyKilled: { entity: number; commits: number; hardSquare: boolean; x: number; y: number };
  playerHit: { damage: number };
  waveCleared: { waveIndex: number };
  levelCleared: {};
  bossPhase: { from: 1 | 2 | 3; to: 1 | 2 | 3 };
};
```

### Task 25: InputSystem + PlayerControlSystem

**Files:**
- Create: `games/invaders/src/systems/input.ts`
- Create: `games/invaders/src/systems/player-control.ts`

- [ ] **Step 1: Write `games/invaders/src/systems/input.ts`**

```ts
import type { World } from '@osi/engine';
import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Velocity } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { SHIP_TIERS } from '../config/ships.js';

export function inputSystem(_dt: number, ctx: GameContext): void {
  const { input, world } = ctx;
  const chaosInvert = ctx.state.chaosActive?.kind === 'MERGE_CONFLICT';
  for (const [e, p] of world.query(Player)) {
    const vel = world.get(e, Velocity) ?? { vx: 0, vy: 0 };
    const tier = SHIP_TIERS[p.tier - 1]!;
    const speed = BALANCE.playerSpeed * tier.speedMultiplier;
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    if (chaosInvert) dir = -dir;
    vel.vx = dir * speed;
    vel.vy = 0;
    world.add(e, Velocity, vel);
  }
}
```

- [ ] **Step 2: Write `games/invaders/src/systems/player-control.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Position, Bullet, Velocity, Collider, SpriteRef } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { SHIP_TIERS } from '../config/ships.js';

export function playerControlSystem(dt: number, ctx: GameContext): void {
  const { world, input, sfx } = ctx;
  const fireBoost = ctx.state.chaosActive?.kind === 'MAIN_GREEN' ? 2 : 1;
  for (const [e, p] of world.query(Player)) {
    p.fireCooldown = Math.max(0, p.fireCooldown - dt * fireBoost);
    if (SHIP_TIERS[p.tier - 1]!.idleRegen) {
      // handled in damage system via regen timer — skip here
    }
    if (input.isDown('fire') && p.fireCooldown <= 0) {
      const pos = world.get(e, Position)!;
      const spread = p.shotsMultiplier;
      for (let i = 0; i < spread; i++) {
        const offset = (i - (spread - 1) / 2) * 14;
        const b = world.spawn();
        world.add(b, Position, { x: pos.x + offset, y: pos.y - 20 });
        world.add(b, Velocity, { vx: 0, vy: -BALANCE.playerBulletSpeed });
        world.add(b, Bullet, { fromPlayer: true, damage: 1, pierce: false });
        world.add(b, Collider, { w: 6, h: 14 });
        world.add(b, SpriteRef, { name: 'laserBlue01.png', scale: 0.6 });
      }
      p.fireCooldown = BALANCE.playerFireCooldown;
      sfx.play('shoot', { pitch: 0.95 + Math.random() * 0.1 });
    }
    if (input.wasPressed('bomb') && p.bombsLeft > 0) {
      ctx.events.emit('playerHit', { damage: 0 }); // placeholder — handled by chaos-events system
      p.bombsLeft -= 1;
    }
  }
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/systems/input.ts games/invaders/src/systems/player-control.ts
git commit -m "feat(invaders): input + player-control systems with fire/bomb"
```

---

### Task 26: EnemyAISystem (march + drop + fire)

**Files:**
- Create: `games/invaders/src/systems/enemy-ai.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/enemy-ai.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { Enemy, Position, Velocity, Bullet, SpriteRef, Collider } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { randRange } from '@osi/engine';

export function enemyAiSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  const chaosFireBoost = ctx.state.chaosActive?.kind === 'CI_FAILED' ? 1.2 : 1;
  const chaosSlow = ctx.state.chaosActive?.kind === 'REBASE' ? BALANCE.powerupRebaseSlow : 1;

  // Detect march direction flip when any enemy hits a wall.
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [, pos] of world.query(Position, Enemy)) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
  }
  let direction: 1 | -1 = 1;
  const marchKey = '_osi_marchDir';
  const anyCtx = ctx as unknown as Record<string, unknown>;
  if (typeof anyCtx[marchKey] === 'number') {
    direction = (anyCtx[marchKey] as 1 | -1);
  } else {
    anyCtx[marchKey] = 1;
  }
  let flip = false;
  if (direction === 1 && maxX > BALANCE.viewportWidth - 40) flip = true;
  if (direction === -1 && minX < 40) flip = true;
  if (flip) {
    direction = (direction === 1 ? -1 : 1) as 1 | -1;
    anyCtx[marchKey] = direction;
  }

  for (const [e, pos, en] of world.query(Position, Enemy)) {
    const vel = world.get(e, Velocity) ?? { vx: 0, vy: 0 };
    vel.vx = direction * BALANCE.enemyMarchSpeed * chaosSlow;
    vel.vy = flip ? BALANCE.enemyDropDistance / dt : 0;
    world.add(e, Velocity, vel);

    en.fireAccumulator += dt * chaosSlow * chaosFireBoost;
    const period = 1 / en.fireRate;
    if (en.fireAccumulator >= period) {
      en.fireAccumulator = 0;
      if (Math.random() < 0.1) {
        const b = world.spawn();
        const jitter = randRange(-BALANCE.enemyBulletJitter, BALANCE.enemyBulletJitter);
        world.add(b, Position, { x: pos.x, y: pos.y + 10 });
        world.add(b, Velocity, { vx: jitter * 60, vy: BALANCE.enemyBulletSpeed });
        world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
        world.add(b, Collider, { w: 6, h: 14 });
        world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 0.6 });
      }
    }
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @osi/invaders typecheck`

```bash
git add games/invaders/src/systems/enemy-ai.ts
git commit -m "feat(invaders): enemy march/drop/fire AI with chaos modifiers"
```

---

### Task 27: PhysicsSystem (integrate velocities)

**Files:**
- Create: `games/invaders/src/systems/physics.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/physics.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { Position, Velocity, Bullet, Lifetime } from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function physicsSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  for (const [, pos, vel] of world.query(Position, Velocity)) {
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
  // Clamp player (only via Lifetime-less bullets out-of-bounds cleanup)
  for (const [e, pos] of world.query(Position, Bullet)) {
    if (
      pos.y < -20 ||
      pos.y > BALANCE.viewportHeight + 20 ||
      pos.x < -20 ||
      pos.x > BALANCE.viewportWidth + 20
    ) {
      world.remove(e);
    }
  }
  // Tick lifetimes
  for (const [e, l] of world.query(Lifetime)) {
    l.remaining -= dt;
    if (l.remaining <= 0) world.remove(e);
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add games/invaders/src/systems/physics.ts
git commit -m "feat(invaders): physics integration + out-of-bounds bullet cleanup"
```

---

### Task 28: BulletSpawnSystem (powerup fork/squash queued shots)

**Files:**
- Create: `games/invaders/src/systems/bullet-spawn.ts`

The fork/squash powerups queue a one-shot modifier. This system exists to process those queued spawn requests if we keep them in ctx. In v1 we inline fork/squash directly in `playerControlSystem`; this system acts as a no-op placeholder that later tasks can hook into.

- [ ] **Step 1: Implement `games/invaders/src/systems/bullet-spawn.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';

// Reserved for future one-shot bullet modifiers. Kept as a system so the
// pipeline order stays locked even when v1 doesn't use it.
export function bulletSpawnSystem(_dt: number, _ctx: GameContext): void {}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/bullet-spawn.ts
git commit -m "feat(invaders): bullet-spawn system placeholder in pipeline"
```

---

### Task 29: CollisionSystem (AABB, all pairs)

**Files:**
- Create: `games/invaders/src/systems/collision.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/collision.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Bullet, Collider, Enemy, Player, Position, Powerup, BossTag, Drone,
} from '../components/index.js';

export interface HitEvent {
  bullet: number;
  target: number;
  targetKind: 'enemy' | 'player' | 'powerup' | 'boss' | 'drone';
}

export function collisionSystem(_dt: number, ctx: GameContext): HitEvent[] {
  const { world } = ctx;
  const hits: HitEvent[] = [];

  const bullets: { id: number; x: number; y: number; w: number; h: number; fromPlayer: boolean }[] = [];
  for (const [id, pos, col, b] of world.query(Position, Collider, Bullet)) {
    bullets.push({ id, x: pos.x - col.w / 2, y: pos.y - col.h / 2, w: col.w, h: col.h, fromPlayer: b.fromPlayer });
  }

  for (const b of bullets) {
    if (b.fromPlayer) {
      for (const [eid, pos, col] of world.query(Position, Collider, Enemy)) {
        if (aabb(b, pos, col)) {
          hits.push({ bullet: b.id, target: eid, targetKind: 'enemy' });
        }
      }
      for (const [eid, pos, col] of world.query(Position, Collider, BossTag)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'boss' });
      }
      for (const [eid, pos, col] of world.query(Position, Collider, Drone)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'drone' });
      }
    } else {
      for (const [eid, pos, col] of world.query(Position, Collider, Player)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'player' });
      }
    }
  }

  // Player ↔ powerup
  for (const [pid, ppos, pcol] of world.query(Position, Collider, Player)) {
    for (const [uid, upos, ucol] of world.query(Position, Collider, Powerup)) {
      if (
        Math.abs(ppos.x - upos.x) < (pcol.w + ucol.w) / 2 &&
        Math.abs(ppos.y - upos.y) < (pcol.h + ucol.h) / 2
      ) {
        hits.push({ bullet: uid, target: pid, targetKind: 'powerup' });
      }
    }
  }

  return hits;
}

function aabb(
  b: { x: number; y: number; w: number; h: number },
  pos: { x: number; y: number },
  col: { w: number; h: number },
): boolean {
  const ax = pos.x - col.w / 2;
  const ay = pos.y - col.h / 2;
  return b.x < ax + col.w && b.x + b.w > ax && b.y < ay + col.h && b.y + b.h > ay;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add games/invaders/src/systems/collision.ts
git commit -m "feat(invaders): AABB collision system returning hit pairs"
```

---

### Task 30: DamageSystem (apply HP, hit-stop trigger, flashes)

**Files:**
- Create: `games/invaders/src/systems/damage.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/damage.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import type { HitEvent } from './collision.js';
import {
  Bullet, Enemy, Health, Player, Position, BossTag,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function damageSystem(hits: HitEvent[], now: number, ctx: GameContext): void {
  const { world, events, sfx, particles, screenShake, gameLoop } = ctx;

  for (const h of hits) {
    if (h.targetKind === 'enemy' || h.targetKind === 'boss' || h.targetKind === 'drone') {
      const hp = world.get(h.target, Health);
      const bullet = world.get(h.bullet, Bullet);
      if (!hp || !bullet) continue;
      hp.hp -= bullet.damage;
      hp.flashUntil = now + 0.08;
      const pos = world.get(h.target, Position);
      if (pos) {
        for (let i = 0; i < 6; i++) {
          particles.sparks.spawn({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.35,
          });
        }
      }
      if (!bullet.pierce) world.remove(h.bullet);
      if (hp.hp > 0) {
        // non-fatal: small hit-stop + shake
        gameLoop.timeScale = 0;
        setTimeout(() => (gameLoop.timeScale = 1), BALANCE.hitStopNonFatalMs);
        screenShake.add(BALANCE.shakeHitNonFatal);
        sfx.play('hit_soft');
      } else {
        // fatal — death system will process
        gameLoop.timeScale = 0;
        setTimeout(() => (gameLoop.timeScale = 1), BALANCE.hitStopFatalMs);
        screenShake.add(BALANCE.shakeHitFatal);
        sfx.play('hit_hard');
      }
    } else if (h.targetKind === 'player') {
      const p = world.get(h.target, Player);
      const hp = world.get(h.target, Health);
      if (!p || !hp) continue;
      if (now < p.invulnUntil) {
        world.remove(h.bullet);
        continue;
      }
      hp.hp -= 1;
      p.invulnUntil = now + BALANCE.playerInvulnSeconds;
      screenShake.add(BALANCE.shakePlayerHit);
      sfx.play('hit_hard');
      events.emit('playerHit', { damage: 1 });
      world.remove(h.bullet);
    }
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add games/invaders/src/systems/damage.ts
git commit -m "feat(invaders): damage system with hit-stop, shake, sparks"
```

---

### Task 31: DeathSystem (drops + combo + enemyKilled)

**Files:**
- Create: `games/invaders/src/systems/death.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/death.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Enemy, Health, Position, Powerup, Collider, SpriteRef, Velocity, BossTag, Drone,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { POWERUPS } from '../config/powerups.js';

export function deathSystem(_dt: number, now: number, ctx: GameContext): void {
  const { world, events, particles, screenShake, sfx } = ctx;

  for (const [e, hp] of world.query(Health)) {
    if (hp.hp > 0) continue;
    const pos = world.get(e, Position);
    const en = world.get(e, Enemy);
    const boss = world.get(e, BossTag);
    const drone = world.get(e, Drone);

    if (pos) {
      for (let i = 0; i < 20; i++) {
        particles.explosions.spawn({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 300,
          vy: (Math.random() - 0.5) * 300,
          life: 0.6 + Math.random() * 0.3,
        });
      }
      screenShake.add({ amplitude: 4, duration: 0.15 });
      sfx.play('explode_small');
    }

    if (en) {
      events.emit('enemyKilled', {
        entity: e,
        commits: en.commits,
        hardSquare: en.hardSquare,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
      });
      if (en.hardSquare && pos && Math.random() < BALANCE.powerupDropChance) {
        const def = POWERUPS[Math.floor(Math.random() * POWERUPS.length)]!;
        const p = world.spawn();
        world.add(p, Position, { x: pos.x, y: pos.y });
        world.add(p, Velocity, { vx: 0, vy: BALANCE.powerupFallSpeed });
        world.add(p, Powerup, { kind: def.kind });
        world.add(p, Collider, { w: 22, h: 22 });
        world.add(p, SpriteRef, { name: 'power-up.png', scale: 1, tint: def.color });
      }
      ctx.state.score += en.commits * 10;
      ctx.state.combo += 1;
      ctx.state.comboExpires = now + 1.2;
    }
    if (boss) {
      events.emit('bossPhase', { from: boss.phase, to: boss.phase });
    }
    if (drone) {
      // handled by boss phase advance in boss-ai system
    }
    world.remove(e);
  }

  if (ctx.state.combo > 0 && now > ctx.state.comboExpires) {
    ctx.state.combo = 0;
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
git add games/invaders/src/systems/death.ts
git commit -m "feat(invaders): death system with powerup drops, combos, explosions"
```

---

### Task 32: PowerupSystem (pickup + apply effects)

**Files:**
- Create: `games/invaders/src/systems/powerup.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/powerup.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { Powerup, Player, Health, Position, Enemy } from '../components/index.js';

export function applyPowerup(kind: string, playerEntity: number, ctx: GameContext, now: number): void {
  const { world, sfx, particles } = ctx;
  const p = world.get(playerEntity, Player);
  const hp = world.get(playerEntity, Health);
  const pos = world.get(playerEntity, Position);
  if (!p || !hp || !pos) return;
  sfx.play('powerup_get');

  switch (kind) {
    case 'revert':
      hp.hp = Math.min(hp.maxHp, hp.hp + 1);
      break;
    case 'fork':
      p.shotsMultiplier = 3;
      setTimeout(() => { p.shotsMultiplier = Math.min(3, p.shotsMultiplier) as 1 | 2 | 3; }, 800);
      break;
    case 'rebase':
      ctx.state.chaosActive = { kind: 'REBASE', until: now + 5 };
      break;
    case 'squash':
      // Next shot pierces column — handled by marking next bullets pierce:true in player-control next frame
      (ctx as unknown as Record<string, unknown>)._osi_nextShotPierce = true;
      break;
    case 'forcepush':
      for (const [e, pos] of world.query(Position, Enemy)) {
        for (let i = 0; i < 12; i++) {
          particles.bigExplosions.spawn({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 400,
            vy: (Math.random() - 0.5) * 400,
            life: 0.8,
          });
        }
        world.remove(e);
      }
      break;
  }
}

export function powerupPickupSystem(_dt: number, ctx: GameContext, now: number): void {
  const { world } = ctx;
  // Called from gameplay loop with collision hits in targetKind==='powerup'
  // No-op here: applyPowerup is invoked from the gameplay scene's collision resolver.
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/powerup.ts
git commit -m "feat(invaders): powerup effects (revert/fork/rebase/squash/force-push)"
```

---

### Task 33: ChaosEventSystem (random mid-level event)

**Files:**
- Create: `games/invaders/src/systems/chaos-events.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/chaos-events.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { BALANCE } from '../config/balance.js';

type ChaosKind = 'CI_FAILED' | 'PR_APPROVED' | 'MERGE_CONFLICT' | 'DEPENDABOT' | 'MAIN_GREEN';
const DURATIONS: Record<ChaosKind, number> = {
  CI_FAILED: 8,
  PR_APPROVED: 8,
  MERGE_CONFLICT: 6,
  DEPENDABOT: 10,
  MAIN_GREEN: 5,
};
const ALL: ChaosKind[] = ['CI_FAILED', 'PR_APPROVED', 'MERGE_CONFLICT', 'DEPENDABOT', 'MAIN_GREEN'];

export function chaosEventSystem(_dt: number, now: number, ctx: GameContext): void {
  if (ctx.state.chaosActive) {
    if (now > ctx.state.chaosActive.until) ctx.state.chaosActive = null;
    return;
  }
  const progress = ctx.state.waveIndex / Math.max(1, ctx.level.waves.length);
  if (progress < BALANCE.chaosWindowStart || progress > BALANCE.chaosWindowEnd) return;
  // 0.5% chance per tick to trigger once inside window
  if (Math.random() < 0.005) {
    const kind = ALL[Math.floor(Math.random() * ALL.length)]!;
    ctx.state.chaosActive = { kind, until: now + DURATIONS[kind] };
    ctx.sfx.play('boss_phase');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/chaos-events.ts
git commit -m "feat(invaders): chaos event system with 5 mid-level events"
```

---

### Task 34: WaveSpawnerSystem (advance when clear)

**Files:**
- Create: `games/invaders/src/systems/wave-spawner.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/wave-spawner.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Enemy, Health, Position, Collider, SpriteRef, Velocity,
} from '../components/index.js';
import type { Wave } from '../data/mapping.js';
import { BALANCE } from '../config/balance.js';

export function spawnWave(wave: Wave, ctx: GameContext): void {
  const { world } = ctx;
  const cols = Math.max(1, wave.enemies.length);
  const spacing = (BALANCE.viewportWidth - 120) / cols;
  wave.enemies.forEach((spec, i) => {
    const e = world.spawn();
    world.add(e, Position, { x: 60 + i * spacing, y: 80 });
    world.add(e, Velocity, { vx: 0, vy: 0 });
    world.add(e, Collider, { w: 44, h: 36 });
    world.add(e, Health, { hp: spec.hp, maxHp: spec.hp, flashUntil: 0 });
    world.add(e, SpriteRef, {
      name: pickEnemySprite(spec.commits),
      scale: 0.6,
      tint: spec.color,
    });
    world.add(e, Enemy, {
      commits: spec.commits,
      fireRate: spec.fireRate,
      fireAccumulator: Math.random() * (1 / spec.fireRate),
      color: spec.color,
      hardSquare: spec.commits >= 10,
      row: 0,
      col: i,
      worthYellow: false,
    });
  });
}

function pickEnemySprite(commits: number): string {
  if (commits <= 3) return 'enemyBlack1.png';
  if (commits <= 6) return 'enemyBlack2.png';
  if (commits <= 9) return 'enemyBlack3.png';
  return 'enemyBlack4.png';
}

export function waveSpawnerSystem(_dt: number, ctx: GameContext): void {
  const { world } = ctx;
  let alive = 0;
  for (const [] of world.query(Enemy)) alive++;
  if (alive > 0) return;

  ctx.state.waveIndex += 1;
  if (ctx.state.waveIndex >= ctx.level.waves.length) {
    ctx.events.emit('levelCleared', {});
    return;
  }
  const wave = ctx.level.waves[ctx.state.waveIndex]!;
  if (wave.enemies.length === 0) {
    // Skip empty weeks (all-zero day slots)
    return waveSpawnerSystem(_dt, ctx);
  }
  spawnWave(wave, ctx);
  ctx.events.emit('waveCleared', { waveIndex: ctx.state.waveIndex - 1 });
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/wave-spawner.ts
git commit -m "feat(invaders): wave spawner with 52-week progression"
```

---

### Task 35: BossAISystem (3-phase state machine, tested)

**Files:**
- Create: `games/invaders/src/systems/boss-ai.ts`
- Create: `games/invaders/src/tests/boss-ai.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// games/invaders/src/tests/boss-ai.test.ts
import { expect, test } from 'vitest';
import { advanceBossPhase } from '../systems/boss-ai.js';

test('phase 1 → 2 when hp drops below threshold', () => {
  expect(advanceBossPhase({ phase: 1, hp: 250 })).toBe(1);
  expect(advanceBossPhase({ phase: 1, hp: 199 })).toBe(2);
  expect(advanceBossPhase({ phase: 1, hp: 150 })).toBe(2);
});

test('phase 2 → 3 only when drones=0', () => {
  expect(advanceBossPhase({ phase: 2, dronesAlive: 2 })).toBe(2);
  expect(advanceBossPhase({ phase: 2, dronesAlive: 0 })).toBe(3);
});

test('phase 3 persists until hp<=0', () => {
  expect(advanceBossPhase({ phase: 3, hp: 50 })).toBe(3);
  expect(advanceBossPhase({ phase: 3, hp: 0 })).toBe(3);
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @osi/invaders test boss-ai`
Expected: FAIL.

- [ ] **Step 3: Implement `games/invaders/src/systems/boss-ai.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import {
  BossTag, Drone, Health, Position, Velocity, Collider, SpriteRef, Bullet,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export type BossPhaseInput =
  | { phase: 1; hp: number }
  | { phase: 2; dronesAlive: number }
  | { phase: 3; hp: number };

export function advanceBossPhase(s: BossPhaseInput): 1 | 2 | 3 {
  if (s.phase === 1) return s.hp <= BALANCE.bossPhase1End ? 2 : 1;
  if (s.phase === 2) return s.dronesAlive <= 0 ? 3 : 2;
  return 3;
}

export function bossAiSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  for (const [bossE, tag] of world.query(BossTag)) {
    const pos = world.get(bossE, Position);
    const hp = world.get(bossE, Health);
    if (!pos || !hp) continue;
    tag.phaseTime += dt;
    tag.fireTimer -= dt;

    if (tag.phase === 1) {
      pos.x = BALANCE.viewportWidth / 2 + Math.sin(tag.phaseTime) * 180;
      pos.y = 100;
      if (tag.fireTimer <= 0) {
        tag.fireTimer = 0.8;
        for (const dir of [-0.3, 0, 0.3]) {
          const b = world.spawn();
          world.add(b, Position, { x: pos.x, y: pos.y + 20 });
          world.add(b, Velocity, { vx: dir * 260, vy: BALANCE.enemyBulletSpeed });
          world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
          world.add(b, Collider, { w: 8, h: 16 });
          world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 0.8 });
        }
      }
      const next = advanceBossPhase({ phase: 1, hp: hp.hp });
      if (next === 2) transitionPhase1To2(bossE, ctx);
    } else if (tag.phase === 2) {
      let drones = 0;
      for (const [] of world.query(Drone)) drones++;
      const next = advanceBossPhase({ phase: 2, dronesAlive: drones });
      if (next === 3) transitionPhase2To3(bossE, ctx);
    } else {
      pos.x = BALANCE.viewportWidth / 2 + Math.sin(tag.phaseTime * 2) * 220;
      pos.y = 120;
      if (tag.fireTimer <= 0) {
        tag.fireTimer = 0.25;
        const b = world.spawn();
        world.add(b, Position, { x: pos.x, y: pos.y + 20 });
        world.add(b, Velocity, { vx: Math.cos(tag.phaseTime * 4) * 300, vy: BALANCE.enemyBulletSpeed });
        world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
        world.add(b, Collider, { w: 10, h: 18 });
        world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 1 });
      }
    }
  }
}

function transitionPhase1To2(bossE: number, ctx: GameContext): void {
  const { world, particles, screenShake, sfx, events } = ctx;
  const tag = world.get(bossE, BossTag)!;
  tag.phase = 2;
  tag.phaseTime = 0;
  events.emit('bossPhase', { from: 1, to: 2 });
  const pos = world.get(bossE, Position)!;
  for (let i = 0; i < 60; i++) {
    particles.bigExplosions.spawn({
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 500,
      vy: (Math.random() - 0.5) * 500,
      life: 1,
    });
  }
  screenShake.add(BALANCE.shakeBossPhase);
  sfx.play('boss_phase');
  // Spawn 3 drones
  for (let i = 0; i < 3; i++) {
    const d = world.spawn();
    world.add(d, Position, { x: pos.x + (i - 1) * 140, y: pos.y + 20 });
    world.add(d, Velocity, { vx: 0, vy: 0 });
    world.add(d, Collider, { w: 48, h: 36 });
    world.add(d, Health, { hp: BALANCE.bossPhase2DroneHp, maxHp: BALANCE.bossPhase2DroneHp, flashUntil: 0 });
    world.add(d, SpriteRef, { name: 'ufoRed.png', scale: 0.7 });
    world.add(d, Drone, { targetX: pos.x, targetY: pos.y });
  }
  // Hide main boss
  world.removeComponent(bossE, SpriteRef);
  world.removeComponent(bossE, Collider);
}

function transitionPhase2To3(bossE: number, ctx: GameContext): void {
  const { world, particles, screenShake, sfx, events } = ctx;
  const tag = world.get(bossE, BossTag)!;
  tag.phase = 3;
  tag.phaseTime = 0;
  const hp = world.get(bossE, Health)!;
  hp.hp = BALANCE.bossPhase3Hp;
  hp.maxHp = BALANCE.bossPhase3Hp;
  events.emit('bossPhase', { from: 2, to: 3 });
  const pos = world.get(bossE, Position)!;
  world.add(bossE, SpriteRef, { name: 'ufoRed.png', scale: 1.2, tint: '#f85149' });
  world.add(bossE, Collider, { w: 120, h: 80 });
  for (let i = 0; i < 80; i++) {
    particles.bigExplosions.spawn({
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 600,
      vy: (Math.random() - 0.5) * 600,
      life: 1.2,
    });
  }
  screenShake.add({ amplitude: 14, duration: 0.6 });
  sfx.play('boss_roar');
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @osi/invaders test boss-ai`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/invaders/src/systems/boss-ai.ts games/invaders/src/tests/boss-ai.test.ts
git commit -m "feat(invaders): boss AI 3-phase state machine with transitions"
```

---

### Task 36: ParticleSystem (update 5 pools)

**Files:**
- Create: `games/invaders/src/systems/particle.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/particle.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';

export function particleSystem(dt: number, ctx: GameContext): void {
  ctx.particles.sparks.update(dt);
  ctx.particles.explosions.update(dt);
  ctx.particles.bigExplosions.update(dt);
  ctx.particles.stars.update(dt);
  ctx.particles.powerupDust.update(dt);
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/particle.ts
git commit -m "feat(invaders): particle update system for all 5 pools"
```

---

### Task 37: ScreenShakeSystem (decay)

**Files:**
- Create: `games/invaders/src/systems/screen-shake.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/screen-shake.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';

export function screenShakeSystem(dt: number, ctx: GameContext): void {
  ctx.screenShake.update(dt);
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/screen-shake.ts
git commit -m "feat(invaders): screen shake update system"
```

---

### Task 38: TweenSystem (advance active tweens)

**Files:**
- Create: `games/invaders/src/systems/tween.ts`

- [ ] **Step 1: Implement `games/invaders/src/systems/tween.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';

export function tweenSystem(dt: number, ctx: GameContext): void {
  for (let i = ctx.tweens.length - 1; i >= 0; i--) {
    ctx.tweens[i]!.update(dt);
    if (ctx.tweens[i]!.done) ctx.tweens.splice(i, 1);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/systems/tween.ts
git commit -m "feat(invaders): tween system advances active tweens"
```

---

### Task 39: HudUpdateSystem (world → HUD values)

**Files:**
- Create: `games/invaders/src/systems/hud-update.ts`

This system collects HUD-relevant data from the world into a `ctx.hud` object that the Hud UI reads each frame.

- [ ] **Step 1: Extend `GameContext` with `hud` field** in `games/invaders/src/scenes/gameplay-context.ts` (will be created in Task 41; for now note the field here).

- [ ] **Step 2: Implement `games/invaders/src/systems/hud-update.ts`**

```ts
import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Health } from '../components/index.js';

export function hudUpdateSystem(_dt: number, ctx: GameContext): void {
  const hud = ctx.hud;
  hud.score = ctx.state.score;
  hud.combo = ctx.state.combo;
  hud.waveIndex = ctx.state.waveIndex;
  hud.totalWaves = ctx.level.waves.length;
  hud.chaos = ctx.state.chaosActive?.kind ?? null;
  for (const [e, ] of ctx.world.query(Player)) {
    const h = ctx.world.get(e, Health);
    if (h) {
      hud.playerHp = h.hp;
      hud.playerMaxHp = h.maxHp;
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/systems/hud-update.ts
git commit -m "feat(invaders): HUD update system syncs world → display state"
```

---

## Phase 8 — Invaders Scenes + UI

### Task 40: GameContext shared type

**Files:**
- Create: `games/invaders/src/scenes/gameplay-context.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/gameplay-context.ts`**

```ts
import type {
  World, InputMap, EventBus, GameLoop, ScreenShake, ParticleEmitter, Sfx, Tween,
} from '@osi/engine';
import type { Level } from '../data/mapping.js';

export type InvadersEvents = {
  enemyKilled: { entity: number; commits: number; hardSquare: boolean; x: number; y: number };
  playerHit: { damage: number };
  waveCleared: { waveIndex: number };
  levelCleared: Record<string, never>;
  bossPhase: { from: 1 | 2 | 3; to: 1 | 2 | 3 };
};

export interface HudState {
  score: number;
  combo: number;
  waveIndex: number;
  totalWaves: number;
  playerHp: number;
  playerMaxHp: number;
  chaos: string | null;
}

export interface GameContext {
  world: World;
  input: InputMap;
  events: EventBus<InvadersEvents>;
  gameLoop: GameLoop;
  screenShake: ScreenShake;
  particles: {
    sparks: ParticleEmitter;
    explosions: ParticleEmitter;
    bigExplosions: ParticleEmitter;
    stars: ParticleEmitter;
    powerupDust: ParticleEmitter;
  };
  tweens: Tween<any>[];
  sfx: Sfx;
  level: Level;
  levelIndex: number;
  hud: HudState;
  state: {
    waveIndex: number;
    score: number;
    combo: number;
    comboExpires: number;
    chaosActive: { kind: string; until: number } | null;
  };
}

export function createHudState(): HudState {
  return {
    score: 0,
    combo: 0,
    waveIndex: 0,
    totalWaves: 0,
    playerHp: 0,
    playerMaxHp: 0,
    chaos: null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/scenes/gameplay-context.ts
git commit -m "feat(invaders): shared GameContext type for systems + scenes"
```

---

### Task 41: TitleScene (input form + featured chips)

**Files:**
- Create: `games/invaders/src/scenes/title.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/title.ts`**

```ts
import { Scene } from '@osi/engine';
import type { Renderer, ParticleEmitter } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

const FEATURED = ['facebook/react', 'vitejs/vite', 'nodejs/node', 'microsoft/typescript'];

export class TitleScene extends Scene {
  private inputValue = '';
  private blinkT = 0;
  private selectedChip = 0;

  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onStart: (repo: string) => void,
  ) {
    super();
  }

  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
    // Seed parallax stars if empty
    for (let i = 0; i < 200 - this.stars.aliveCount(); i++) {
      this.stars.spawn({
        x: Math.random() * BALANCE.viewportWidth,
        y: Math.random() * BALANCE.viewportHeight,
        vx: 0,
        vy: 8 + Math.random() * 40,
        life: 999,
      });
    }
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = this.inputValue.trim() || FEATURED[this.selectedChip]!;
      this.onStart(val);
    } else if (e.key === 'Backspace') {
      this.inputValue = this.inputValue.slice(0, -1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.selectedChip = (this.selectedChip + 1) % FEATURED.length;
    } else if (e.key.length === 1 && /[\w\-/.]/.test(e.key)) {
      this.inputValue += e.key;
    }
  };

  override update(dt: number): void {
    this.blinkT += dt;
    this.stars.update(dt);
  }

  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    this.stars.render(ctx);
    ctx.fillStyle = BALANCE.accentCyan;
    ctx.font = 'bold 42px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OPEN SOURCE INVADERS', BALANCE.viewportWidth / 2, 140);
    ctx.font = '16px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('enter a GitHub repo — owner/name', BALANCE.viewportWidth / 2, 180);

    ctx.fillStyle = BALANCE.bgAlt;
    ctx.fillRect(BALANCE.viewportWidth / 2 - 200, 210, 400, 48);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '22px ui-monospace, Menlo, monospace';
    ctx.fillText(
      this.inputValue + (Math.floor(this.blinkT * 2) % 2 === 0 ? '_' : ' '),
      BALANCE.viewportWidth / 2,
      243,
    );

    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('featured:', BALANCE.viewportWidth / 2, 300);
    FEATURED.forEach((name, i) => {
      const y = 324 + i * 26;
      ctx.fillStyle = i === this.selectedChip ? BALANCE.accentGreen : '#484f58';
      ctx.fillText(name, BALANCE.viewportWidth / 2, y);
    });
    ctx.fillStyle = '#484f58';
    ctx.fillText('TAB cycles · ENTER launches', BALANCE.viewportWidth / 2, 480);
    this.renderer.endFrame();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/scenes/title.ts
git commit -m "feat(invaders): TitleScene with repo input + featured chips"
```

---

### Task 42: LoadingScene (playable ship + progress)

**Files:**
- Create: `games/invaders/src/scenes/loading.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/loading.ts`**

```ts
import { Scene, Keyboard, ParticleEmitter, Renderer, SpriteAtlas } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class LoadingScene extends Scene {
  private shipX = BALANCE.viewportWidth / 2;
  private progress = 0;
  private label = 'fetching repo';

  constructor(
    private renderer: Renderer,
    private atlas: SpriteAtlas,
    private stars: ParticleEmitter,
    private kb: Keyboard,
  ) {
    super();
  }

  setProgress(p: number, label: string): void {
    this.progress = Math.max(0, Math.min(1, p));
    this.label = label;
  }

  override update(dt: number): void {
    this.stars.update(dt);
    const speed = BALANCE.playerSpeed * 0.6;
    if (this.kb.isDown('ArrowLeft')) this.shipX -= speed * dt;
    if (this.kb.isDown('ArrowRight')) this.shipX += speed * dt;
    this.shipX = Math.max(40, Math.min(BALANCE.viewportWidth - 40, this.shipX));
  }

  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    this.stars.render(ctx);
    if (this.atlas.has('playerShip1_blue.png')) {
      this.atlas.draw(ctx, 'playerShip1_blue.png', this.shipX, BALANCE.viewportHeight - 90, 0.7);
    }
    // Progress bar
    const barW = 500;
    const barX = (BALANCE.viewportWidth - barW) / 2;
    const barY = BALANCE.viewportHeight - 40;
    ctx.fillStyle = BALANCE.bgAlt;
    ctx.fillRect(barX, barY, barW, 12);
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.fillRect(barX, barY, barW * this.progress, 12);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, BALANCE.viewportWidth / 2, barY - 10);
    this.renderer.endFrame();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/scenes/loading.ts
git commit -m "feat(invaders): LoadingScene with playable ship + progress bar"
```

---

### Task 43: LevelIntroScene (contributor card + knowledge briefing)

**Files:**
- Create: `games/invaders/src/scenes/level-intro.ts`
- Create: `games/invaders/src/ui/contributor-card.ts`
- Create: `games/invaders/src/ui/syntax-highlight.ts`

- [ ] **Step 1: Implement `games/invaders/src/ui/syntax-highlight.ts`**

```ts
const KEYWORDS: Record<string, RegExp> = {
  ts: /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|enum|async|await|new|this|public|private|protected|readonly|extends|implements)\b/g,
  js: /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|async|await|new|this|extends)\b/g,
  py: /\b(def|class|import|from|return|if|elif|else|for|while|as|with|try|except|raise|yield|lambda|self)\b/g,
  rs: /\b(fn|let|mut|pub|struct|enum|impl|trait|match|if|else|for|while|loop|return|use|mod|as|crate|self|Self)\b/g,
  go: /\b(func|package|import|var|const|type|struct|interface|return|if|else|for|range|go|chan|defer|map|switch|case|break|continue)\b/g,
  java: /\b(public|private|protected|static|final|class|interface|extends|implements|return|if|else|for|while|new|this|void|int|long|double|float|boolean|char|String)\b/g,
  cpp: /\b(int|long|double|float|bool|char|void|class|struct|public|private|protected|return|if|else|for|while|new|delete|const|static|namespace|using|template|typename)\b/g,
  sh: /\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|local)\b/g,
};
const STRING_RE = /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)/g;
const COMMENT_RE = /(\/\/[^\n]*|#[^\n]*)/g;
const NUMBER_RE = /\b\d+(\.\d+)?\b/g;

export type Token = { text: string; color: string };

export function tokenize(code: string, lang: string): Token[] {
  const normalized = lang.toLowerCase();
  const key = KEYWORDS[normalized] ? normalized : normalized.startsWith('type') ? 'ts' : 'ts';
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    let match: { re: RegExp; color: string } | null = null;
    COMMENT_RE.lastIndex = 0;
    const cm = COMMENT_RE.exec(rest);
    if (cm && cm.index === 0) {
      tokens.push({ text: cm[0], color: '#8b949e' });
      i += cm[0].length;
      continue;
    }
    STRING_RE.lastIndex = 0;
    const sm = STRING_RE.exec(rest);
    if (sm && sm.index === 0) {
      tokens.push({ text: sm[0], color: '#a5d6ff' });
      i += sm[0].length;
      continue;
    }
    NUMBER_RE.lastIndex = 0;
    const nm = NUMBER_RE.exec(rest);
    if (nm && nm.index === 0) {
      tokens.push({ text: nm[0], color: '#79c0ff' });
      i += nm[0].length;
      continue;
    }
    const kwRe = KEYWORDS[key]!;
    kwRe.lastIndex = 0;
    const km = kwRe.exec(rest);
    if (km && km.index === 0) {
      tokens.push({ text: km[0], color: '#ff7b72' });
      i += km[0].length;
      continue;
    }
    tokens.push({ text: rest[0]!, color: '#c9d1d9' });
    i += 1;
  }
  return tokens;
}
```

- [ ] **Step 2: Implement `games/invaders/src/ui/contributor-card.ts`**

```ts
import { BALANCE } from '../config/balance.js';

export interface ContributorCardData {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  rank: number;
}

export function drawContributorCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  data: ContributorCardData,
  avatarImg: HTMLImageElement | null,
): void {
  const w = 340;
  const h = 380;
  ctx.save();
  ctx.fillStyle = BALANCE.bgAlt;
  ctx.strokeStyle = BALANCE.accentCyan;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 110, 70, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, x + w / 2 - 70, y + 40, 140, 140);
    ctx.restore();
  }

  ctx.fillStyle = BALANCE.accentCyan;
  ctx.font = 'bold 24px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`@${data.login}`, x + w / 2, y + 220);
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#8b949e';
  ctx.fillText(`rank #${data.rank}`, x + w / 2, y + 244);
  ctx.fillStyle = BALANCE.accentGreen;
  ctx.font = '18px ui-monospace, Menlo, monospace';
  ctx.fillText(`${data.totalCommits} commits`, x + w / 2, y + 278);
  ctx.restore();
}
```

- [ ] **Step 3: Implement `games/invaders/src/scenes/level-intro.ts`**

```ts
import { Scene, Renderer, Keyboard } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { drawContributorCard } from '../ui/contributor-card.js';
import { tokenize } from '../ui/syntax-highlight.js';
import type { Chunk } from '../data/knowledge-extractor.js';

export class LevelIntroScene extends Scene {
  private typedChars = 0;
  private typewriterT = 0;
  private avatarImg: HTMLImageElement | null = null;

  constructor(
    private renderer: Renderer,
    private kb: Keyboard,
    private levelIndex: number,
    private contributor: { login: string; avatarUrl: string; totalCommits: number; rank: number },
    private chunk: Chunk,
    private onLaunch: () => void,
  ) {
    super();
  }

  override onEnter(): void {
    if (this.contributor.avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = this.contributor.avatarUrl;
      img.onload = () => (this.avatarImg = img);
    }
  }

  override update(dt: number): void {
    this.typewriterT += dt;
    const target = Math.floor(this.typewriterT * 40); // 40 chars/sec
    const full = this.chunkText().length;
    this.typedChars = Math.min(target, full);
    if (this.kb.wasPressed('Space')) {
      if (this.typedChars < full) this.typedChars = full;
      else this.onLaunch();
    }
    this.kb.endFrame();
  }

  private chunkText(): string {
    const c = this.chunk;
    if (c.kind === 'CODE') return c.code;
    if (c.kind === 'CONCEPT') return c.body;
    if (c.kind === 'QUOTE') return `"${c.text}"`;
    if (c.kind === 'FEATURE') return `• ${c.text}`;
    return c.text;
  }

  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = BALANCE.accentCyan;
    ctx.font = 'bold 20px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${this.levelIndex + 1}`, 40, 50);

    drawContributorCard(ctx, 40, 90, this.contributor, this.avatarImg);

    // Right panel — typewriter text
    const panelX = 420;
    const panelY = 90;
    ctx.fillStyle = BALANCE.bgAlt;
    ctx.fillRect(panelX, panelY, 500, 380);
    ctx.strokeStyle = '#30363d';
    ctx.strokeRect(panelX, panelY, 500, 380);

    const text = this.chunkText().slice(0, this.typedChars);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '16px ui-monospace, Menlo, monospace';
    if (this.chunk.kind === 'CODE') {
      this.drawTokens(ctx, panelX + 20, panelY + 40, this.chunk.lang, text);
    } else {
      this.drawWrapped(ctx, panelX + 20, panelY + 40, text, 460);
    }

    ctx.fillStyle = '#8b949e';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE to continue', BALANCE.viewportWidth / 2, BALANCE.viewportHeight - 30);
    this.renderer.endFrame();
  }

  private drawWrapped(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, maxW: number) {
    const words = text.split(/\s+/);
    let line = '';
    let cy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, cy);
        line = w;
        cy += 22;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  private drawTokens(ctx: CanvasRenderingContext2D, x: number, y: number, lang: string, text: string) {
    const tokens = tokenize(text, lang);
    let cx = x;
    let cy = y;
    for (const t of tokens) {
      if (t.text === '\n') {
        cy += 20;
        cx = x;
        continue;
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, cx, cy);
      cx += ctx.measureText(t.text).width;
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add games/invaders/src/scenes/level-intro.ts games/invaders/src/ui/contributor-card.ts games/invaders/src/ui/syntax-highlight.ts
git commit -m "feat(invaders): LevelIntroScene with contributor card + typewriter briefing"
```

---

### Task 44: GameplayScene (the big one)

**Files:**
- Create: `games/invaders/src/scenes/gameplay.ts`
- Create: `games/invaders/src/ui/hud.ts`

- [ ] **Step 1: Implement `games/invaders/src/ui/hud.ts`**

```ts
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { HudState } from '../scenes/gameplay-context.js';

export function drawHud(renderer: Renderer, hud: HudState): void {
  const ctx = renderer.main;
  ctx.save();
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${hud.score}`, 20, 24);
  ctx.fillText(`WAVE ${hud.waveIndex + 1}/${hud.totalWaves}`, 20, 44);
  // HP bar
  const hpW = 160;
  ctx.fillStyle = BALANCE.bgAlt;
  ctx.fillRect(BALANCE.viewportWidth - hpW - 20, 16, hpW, 12);
  ctx.fillStyle = BALANCE.accentGreen;
  const r = hud.playerMaxHp > 0 ? hud.playerHp / hud.playerMaxHp : 0;
  ctx.fillRect(BALANCE.viewportWidth - hpW - 20, 16, hpW * r, 12);
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'right';
  ctx.fillText(`HP ${hud.playerHp}/${hud.playerMaxHp}`, BALANCE.viewportWidth - 20, 44);
  if (hud.combo > 1) {
    ctx.fillStyle = BALANCE.accentYellow;
    ctx.font = 'bold 28px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`×${hud.combo} COMBO`, BALANCE.viewportWidth / 2, 40);
  }
  if (hud.chaos) {
    ctx.fillStyle = BALANCE.accentRed;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`!! ${hud.chaos.replace(/_/g, ' ')} !!`, BALANCE.viewportWidth / 2, 70);
  }
  ctx.restore();
}
```

- [ ] **Step 2: Implement `games/invaders/src/scenes/gameplay.ts`**

```ts
import { Scene, Renderer, SpriteAtlas, InputMap, EventBus, ScreenShake, Sfx, World, GameLoop, Tween } from '@osi/engine';
import type { Level } from '../data/mapping.js';
import { GameContext, createHudState, InvadersEvents } from './gameplay-context.js';
import {
  Position, SpriteRef, Health, Player, Enemy, Powerup, BossTag,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { SHIP_TIERS } from '../config/ships.js';

import { inputSystem } from '../systems/input.js';
import { playerControlSystem } from '../systems/player-control.js';
import { enemyAiSystem } from '../systems/enemy-ai.js';
import { bossAiSystem } from '../systems/boss-ai.js';
import { physicsSystem } from '../systems/physics.js';
import { bulletSpawnSystem } from '../systems/bullet-spawn.js';
import { collisionSystem } from '../systems/collision.js';
import { damageSystem } from '../systems/damage.js';
import { deathSystem } from '../systems/death.js';
import { applyPowerup } from '../systems/powerup.js';
import { chaosEventSystem } from '../systems/chaos-events.js';
import { waveSpawnerSystem, spawnWave } from '../systems/wave-spawner.js';
import { particleSystem } from '../systems/particle.js';
import { screenShakeSystem } from '../systems/screen-shake.js';
import { tweenSystem } from '../systems/tween.js';
import { hudUpdateSystem } from '../systems/hud-update.js';

import { drawHud } from '../ui/hud.js';

export class GameplayScene extends Scene {
  readonly ctx: GameContext;
  private now = 0;

  constructor(
    private renderer: Renderer,
    private atlas: SpriteAtlas,
    level: Level,
    levelIndex: number,
    deps: {
      input: InputMap;
      gameLoop: GameLoop;
      sfx: Sfx;
      screenShake: ScreenShake;
      particles: GameContext['particles'];
    },
    private onLevelCleared: () => void,
  ) {
    super();
    const events = new EventBus<InvadersEvents>();
    this.ctx = {
      world: new World(),
      input: deps.input,
      events,
      gameLoop: deps.gameLoop,
      screenShake: deps.screenShake,
      particles: deps.particles,
      tweens: [] as Tween<any>[],
      sfx: deps.sfx,
      level,
      levelIndex,
      hud: createHudState(),
      state: {
        waveIndex: 0,
        score: 0,
        combo: 0,
        comboExpires: 0,
        chaosActive: null,
      },
    };
    events.on('levelCleared', () => this.onLevelCleared());
  }

  override onEnter(): void {
    // Spawn player
    const e = this.ctx.world.spawn();
    const tier = SHIP_TIERS[this.ctx.levelIndex]!;
    this.ctx.world.add(e, Position, {
      x: BALANCE.viewportWidth / 2,
      y: BALANCE.viewportHeight - 60,
    });
    this.ctx.world.add(e, SpriteRef, { name: tier.sprite, scale: 0.7 });
    this.ctx.world.add(e, Health, { hp: tier.maxHp, maxHp: tier.maxHp, flashUntil: 0 });
    this.ctx.world.add(e, Player, {
      tier: tier.level,
      fireCooldown: 0,
      invulnUntil: 0,
      shotsMultiplier: tier.shots as 1 | 2 | 3,
      bombsLeft: BALANCE.maxBombsPerLevel,
    });
    this.ctx.world.add(e, { id: Symbol('Collider'), name: 'Collider' } as never, { w: 40, h: 32 } as never);
    // Spawn first non-empty wave
    let wi = 0;
    while (wi < this.ctx.level.waves.length && this.ctx.level.waves[wi]!.enemies.length === 0) wi++;
    this.ctx.state.waveIndex = wi;
    if (wi < this.ctx.level.waves.length) spawnWave(this.ctx.level.waves[wi]!, this.ctx);
  }

  override update(dt: number): void {
    this.now += dt;
    inputSystem(dt, this.ctx);
    playerControlSystem(dt, this.ctx);
    enemyAiSystem(dt, this.ctx);
    bossAiSystem(dt, this.ctx);
    physicsSystem(dt, this.ctx);
    bulletSpawnSystem(dt, this.ctx);
    const hits = collisionSystem(dt, this.ctx);
    damageSystem(hits.filter((h) => h.targetKind !== 'powerup'), this.now, this.ctx);
    // Apply powerup pickups
    for (const h of hits.filter((h) => h.targetKind === 'powerup')) {
      const pu = this.ctx.world.get(h.bullet, Powerup);
      if (pu) {
        applyPowerup(pu.kind, h.target, this.ctx, this.now);
        this.ctx.world.remove(h.bullet);
      }
    }
    deathSystem(dt, this.now, this.ctx);
    chaosEventSystem(dt, this.now, this.ctx);
    waveSpawnerSystem(dt, this.ctx);
    particleSystem(dt, this.ctx);
    screenShakeSystem(dt, this.ctx);
    tweenSystem(dt, this.ctx);
    hudUpdateSystem(dt, this.ctx);
  }

  override render(): void {
    const r = this.renderer;
    r.beginFrame();
    const offX = this.ctx.screenShake.offsetX;
    const offY = this.ctx.screenShake.offsetY;
    const main = r.main;
    // Parallax
    this.ctx.particles.stars.render(main);
    // Sprites
    main.save();
    main.translate(offX, offY);
    for (const [e, pos, sprite] of this.ctx.world.query(Position, SpriteRef)) {
      const hp = this.ctx.world.get(e, Health);
      const flashing = hp && hp.flashUntil > this.now;
      if (flashing) {
        this.atlas.drawTinted(main, sprite.name, pos.x, pos.y, '#ffffff', sprite.scale);
      } else if (sprite.tint) {
        this.atlas.drawTinted(main, sprite.name, pos.x, pos.y, sprite.tint, sprite.scale);
      } else {
        this.atlas.draw(main, sprite.name, pos.x, pos.y, sprite.scale);
      }
    }
    // Particles
    this.ctx.particles.sparks.render(main);
    this.ctx.particles.explosions.render(main);
    this.ctx.particles.bigExplosions.render(main);
    this.ctx.particles.powerupDust.render(main);
    main.restore();
    drawHud(r, this.ctx.hud);
    // Chaos tint
    if (this.ctx.state.chaosActive?.kind === 'CI_FAILED') {
      main.fillStyle = 'rgba(248, 81, 73, 0.10)';
      main.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    }
    r.endFrame();
  }
}
```

Note: the `Collider` add-call above uses a bogus placeholder; replace with the real imported component:

- [ ] **Step 3: Replace placeholder in gameplay.ts**

Replace:
```ts
this.ctx.world.add(e, { id: Symbol('Collider'), name: 'Collider' } as never, { w: 40, h: 32 } as never);
```
with:
```ts
this.ctx.world.add(e, Collider, { w: 40, h: 32 });
```
And add `Collider` to the import from `../components/index.js`.

- [ ] **Step 4: Commit**

```bash
git add games/invaders/src/ui/hud.ts games/invaders/src/scenes/gameplay.ts
git commit -m "feat(invaders): GameplayScene wires full ECS pipeline + HUD"
```

---

### Task 45: BossIntroScene + BossScene

**Files:**
- Create: `games/invaders/src/scenes/boss-intro.ts`
- Create: `games/invaders/src/scenes/boss.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/boss-intro.ts`**

```ts
import { Scene, Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class BossIntroScene extends Scene {
  private t = 0;
  constructor(
    private renderer: Renderer,
    private contributorLogin: string,
    private onDone: () => void,
  ) {
    super();
  }
  override update(dt: number): void {
    this.t += dt;
    if (this.t > 2.2) this.onDone();
  }
  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    const alpha = Math.min(1, this.t / 0.3);
    ctx.fillStyle = `rgba(248, 81, 73, ${0.25 * alpha})`;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = BALANCE.accentRed;
    ctx.font = 'bold 52px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINAL COMMIT', BALANCE.viewportWidth / 2, 260);
    ctx.font = '22px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(`vs @${this.contributorLogin}`, BALANCE.viewportWidth / 2, 310);
    this.renderer.endFrame();
  }
}
```

- [ ] **Step 2: Implement `games/invaders/src/scenes/boss.ts`**

Boss scene is a variant of GameplayScene that spawns a boss instead of waves.

```ts
import { GameplayScene } from './gameplay.js';
import { BossTag, Health, Position, Collider, SpriteRef, Velocity } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import type { Renderer, SpriteAtlas, InputMap, GameLoop, Sfx, ScreenShake } from '@osi/engine';
import type { Level } from '../data/mapping.js';
import type { GameContext } from './gameplay-context.js';

export class BossScene extends GameplayScene {
  constructor(
    renderer: Renderer,
    atlas: SpriteAtlas,
    level: Level,
    levelIndex: number,
    deps: {
      input: InputMap;
      gameLoop: GameLoop;
      sfx: Sfx;
      screenShake: ScreenShake;
      particles: GameContext['particles'];
    },
    onVictory: () => void,
  ) {
    super(renderer, atlas, level, levelIndex, deps, onVictory);
  }

  override onEnter(): void {
    super.onEnter();
    // Clear any spawned waves — boss replaces them.
    for (const [e] of this.ctx.world.query(SpriteRef, Collider)) {
      if (!this.ctx.world.get(e, BossTag)) {
        // keep player
        const isPlayer = this.ctx.world.has(e, { id: Symbol.for('Player'), name: 'Player' } as never);
        if (!isPlayer) this.ctx.world.remove(e);
      }
    }
    // Spawn boss
    const boss = this.ctx.world.spawn();
    this.ctx.world.add(boss, Position, { x: BALANCE.viewportWidth / 2, y: 100 });
    this.ctx.world.add(boss, Velocity, { vx: 0, vy: 0 });
    this.ctx.world.add(boss, Collider, { w: 140, h: 90 });
    this.ctx.world.add(boss, Health, {
      hp: BALANCE.bossPhase1Hp,
      maxHp: BALANCE.bossPhase1Hp,
      flashUntil: 0,
    });
    this.ctx.world.add(boss, SpriteRef, { name: 'ufoBlue.png', scale: 1.4 });
    this.ctx.world.add(boss, BossTag, { phase: 1, phaseTime: 0, fireTimer: 1 });
  }
}
```

Note: the `Symbol.for('Player')` trick above is a hack. Replace with a real import.

- [ ] **Step 3: Fix the boss scene player-keep logic**

Import `Player` from `../components/index.js` and replace:
```ts
const isPlayer = this.ctx.world.has(e, { id: Symbol.for('Player'), name: 'Player' } as never);
```
with:
```ts
const isPlayer = this.ctx.world.has(e, Player);
```

- [ ] **Step 4: Commit**

```bash
git add games/invaders/src/scenes/boss-intro.ts games/invaders/src/scenes/boss.ts
git commit -m "feat(invaders): BossIntro + BossScene with phase-1 boss spawn"
```

---

### Task 46: VictoryScene

**Files:**
- Create: `games/invaders/src/scenes/victory.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/victory.ts`**

```ts
import { Scene, Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class VictoryScene extends Scene {
  constructor(
    private renderer: Renderer,
    private repoName: string,
    private finalScore: number,
    private onReplay: () => void,
  ) {
    super();
  }
  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
  }
  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') this.onReplay();
  };
  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.font = 'bold 48px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAIN BRANCH GREEN', BALANCE.viewportWidth / 2, 200);
    ctx.font = '20px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(`${this.repoName} — shipped`, BALANCE.viewportWidth / 2, 250);
    ctx.fillText(`final score ${this.finalScore}`, BALANCE.viewportWidth / 2, 290);
    ctx.fillStyle = '#8b949e';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillText('ENTER to play another repo', BALANCE.viewportWidth / 2, 400);
    this.renderer.endFrame();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/scenes/victory.ts
git commit -m "feat(invaders): VictoryScene with final score + replay"
```

---

### Task 47: PauseScene (overlay pushed on stack)

**Files:**
- Create: `games/invaders/src/scenes/pause.ts`

- [ ] **Step 1: Implement `games/invaders/src/scenes/pause.ts`**

```ts
import { Scene, Renderer, GameLoop } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class PauseScene extends Scene {
  constructor(
    private renderer: Renderer,
    private gameLoop: GameLoop,
    private onResume: () => void,
  ) {
    super();
  }
  override onEnter(): void {
    this.gameLoop.timeScale = 0;
    window.addEventListener('keydown', this.onKey);
  }
  override onExit(): void {
    this.gameLoop.timeScale = 1;
    window.removeEventListener('keydown', this.onKey);
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.onResume();
  };
  override render(): void {
    const ctx = this.renderer.main;
    ctx.save();
    ctx.fillStyle = 'rgba(13, 17, 23, 0.70)';
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 40px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', BALANCE.viewportWidth / 2, BALANCE.viewportHeight / 2);
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('ESC to resume', BALANCE.viewportWidth / 2, BALANCE.viewportHeight / 2 + 30);
    ctx.restore();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/invaders/src/scenes/pause.ts
git commit -m "feat(invaders): PauseScene overlay halts time via timeScale"
```

---

## Phase 9 — Bootstrap, Deploy, Release

### Task 48: Level transition helper + main.ts bootstrap

**Files:**
- Create: `games/invaders/src/ui/level-transition.ts`
- Modify: `games/invaders/src/main.ts`

- [ ] **Step 1: Implement `games/invaders/src/ui/level-transition.ts`**

```ts
import type { Renderer, Tween } from '@osi/engine';
import { Easing } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export function crossFadeTween(
  ctx: { alpha: number },
  to: number,
  durationSec: number,
): { update: (dt: number) => void; done: () => boolean } {
  let t = 0;
  const from = ctx.alpha;
  return {
    update(dt: number) {
      t += dt;
      const p = Math.min(1, t / durationSec);
      ctx.alpha = from + (to - from) * Easing.easeInOutQuad(p);
    },
    done() { return t >= durationSec; },
  };
}

export function drawFadeOverlay(r: Renderer, alpha: number): void {
  if (alpha <= 0) return;
  const ctx = r.main;
  ctx.save();
  ctx.fillStyle = `rgba(13, 17, 23, ${Math.min(1, alpha)})`;
  ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
  ctx.restore();
}
```

- [ ] **Step 2: Replace `games/invaders/src/main.ts` with full bootstrap**

```ts
import {
  Renderer, SpriteAtlas, Keyboard, Pointer, InputMap, GameLoop, SceneManager,
  AudioBus, Sfx, ScreenShake, ParticleEmitter,
} from '@osi/engine';
import { BALANCE } from './config/balance.js';
import {
  getRepo, getContributors, getCommitsForAuthor, getReadme, tryGetFile,
  withCache, GitHubRateLimitError, setToken,
} from './data/github-client.js';
import { aggregateDaily } from './data/contributor-stats.js';
import { contributorToLevel, type Level } from './data/mapping.js';
import { extractChunks, selectArc, type Chunk } from './data/knowledge-extractor.js';
import { TitleScene } from './scenes/title.js';
import { LoadingScene } from './scenes/loading.js';
import { LevelIntroScene } from './scenes/level-intro.js';
import { GameplayScene } from './scenes/gameplay.js';
import { BossIntroScene } from './scenes/boss-intro.js';
import { BossScene } from './scenes/boss.js';
import { VictoryScene } from './scenes/victory.js';
import { PauseScene } from './scenes/pause.js';

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  renderer.addLayer({ name: 'world', clear: true });
  renderer.addLayer({ name: 'glow', clear: true, postFx: 'glow' });

  const atlas = new SpriteAtlas();
  await atlas.load('./assets/kenney-space-shooter/sheet.png', './assets/kenney-space-shooter/sheet.xml');

  const audio = new AudioBus();
  await audio.init();
  const sfx = new Sfx(audio);
  await sfx.load({
    shoot: './assets/sfx/shoot.wav',
    enemy_shoot: './assets/sfx/enemy_shoot.wav',
    hit_soft: './assets/sfx/hit_soft.wav',
    hit_hard: './assets/sfx/hit_hard.wav',
    explode_small: './assets/sfx/explode_small.wav',
    explode_big: './assets/sfx/explode_big.wav',
    powerup_drop: './assets/sfx/powerup_drop.wav',
    powerup_get: './assets/sfx/powerup_get.wav',
    level_up: './assets/sfx/level_up.wav',
    boss_phase: './assets/sfx/boss_phase.wav',
    boss_roar: './assets/sfx/boss_roar.wav',
    boss_die: './assets/sfx/boss_die.wav',
    ui_hover: './assets/sfx/ui_hover.wav',
    ui_click: './assets/sfx/ui_click.wav',
  });

  const kb = new Keyboard();
  kb.attach(window);
  const pointer = new Pointer();
  pointer.attach(canvas);
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  const input = new InputMap(kb)
    .bind('left', ['ArrowLeft', 'KeyA'])
    .bind('right', ['ArrowRight', 'KeyD'])
    .bind('fire', ['Space'])
    .bind('bomb', ['KeyX']);

  const gameLoop = new GameLoop({ fixedDt: BALANCE.fixedDt, maxStepsPerFrame: 5 });
  const sceneMgr = new SceneManager();
  const screenShake = new ScreenShake({ maxAmplitude: BALANCE.shakeMaxAmplitude });
  const particles = {
    sparks: new ParticleEmitter({ capacity: BALANCE.particleCapacities.sparks, drawColor: '#ffffff', drawSize: 2 }),
    explosions: new ParticleEmitter({ capacity: BALANCE.particleCapacities.explosions, drawColor: '#f0883e', drawSize: 3, gravity: 40 }),
    bigExplosions: new ParticleEmitter({ capacity: BALANCE.particleCapacities.bigExplosions, drawColor: '#ff7b72', drawSize: 4, gravity: 30 }),
    stars: new ParticleEmitter({ capacity: BALANCE.particleCapacities.stars, drawColor: '#8ba4c5', drawSize: 1 }),
    powerupDust: new ParticleEmitter({ capacity: BALANCE.particleCapacities.powerupDust, drawColor: '#58a6ff', drawSize: 2 }),
  };

  gameLoop.onUpdate = (dt) => {
    sceneMgr.update(dt);
    kb.endFrame();
    pointer.endFrame();
  };
  gameLoop.onRender = (alpha) => sceneMgr.render(alpha);

  // Scene flow
  const showTitle = () => {
    sceneMgr.replace(new TitleScene(renderer, particles.stars, (repo) => startRun(repo)));
  };

  const startRun = async (repoFullName: string) => {
    const [owner, name] = repoFullName.split('/');
    if (!owner || !name) return showTitle();
    const loading = new LoadingScene(renderer, atlas, particles.stars, kb);
    sceneMgr.replace(loading);
    try {
      loading.setProgress(0.05, 'fetching repo metadata');
      const repo = await withCache(`repo:${owner}/${name}`, () => getRepo(owner, name));
      loading.setProgress(0.15, 'fetching contributors');
      const contribs = await withCache(`contribs:${owner}/${name}`, () => getContributors(owner, name));
      const top5 = contribs.slice(0, 5);
      const sinceIso = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
      const levels: Level[] = [];
      for (let i = 0; i < top5.length; i++) {
        loading.setProgress(0.15 + (0.55 * (i / top5.length)), `fetching commits for ${top5[i]!.login}`);
        const commits = await withCache(
          `commits:${owner}/${name}/${top5[i]!.login}`,
          () => getCommitsForAuthor(owner, name, top5[i]!.login, sinceIso),
        );
        const daily = aggregateDaily(commits);
        levels.push(
          contributorToLevel(
            {
              login: top5[i]!.login,
              avatarUrl: top5[i]!.avatar_url,
              totalCommits: top5[i]!.contributions,
              daily,
            },
            { id: String(top5[i]!.id), login: top5[i]!.login, name: top5[i]!.login },
            // Level index is reversed: rank #5 is level 1, rank #1 is level 5 (boss)
            top5.length - 1 - i,
          ),
        );
      }
      // Reverse so levels[0] = rank #5
      levels.reverse();
      loading.setProgress(0.75, 'fetching README');
      const readme = await withCache(`readme:${owner}/${name}`, () => getReadme(owner, name));
      loading.setProgress(0.85, 'scanning docs');
      const extraDocs = await Promise.all([
        tryGetFile(owner, name, 'ARCHITECTURE.md'),
        tryGetFile(owner, name, 'CONTRIBUTING.md'),
      ]);
      const combined = [readme, ...extraDocs.filter(Boolean)].join('\n\n');
      const chunks = extractChunks(combined, 'README.md');
      if (chunks.length === 0 && repo.description) {
        chunks.push({ kind: 'FACT', text: repo.description, source: 'description' });
      }
      const arc: Chunk[] = selectArc(chunks, repo.full_name);
      loading.setProgress(1, 'launching');
      await new Promise((r) => setTimeout(r, 250));
      playLevel(0, levels, arc, repo.full_name);
    } catch (err) {
      if (err instanceof GitHubRateLimitError) {
        promptForToken(() => startRun(repoFullName));
      } else {
        console.error(err);
        showTitle();
      }
    }
  };

  const playLevel = (idx: number, levels: Level[], arc: Chunk[], repoFullName: string) => {
    if (idx >= levels.length) {
      sceneMgr.replace(new VictoryScene(renderer, repoFullName, 0, showTitle));
      return;
    }
    const isBossLevel = idx === levels.length - 1;
    const level = levels[idx]!;
    const contributorInfo = {
      login: level.contributor.login,
      avatarUrl: level.contributor.avatar ?? '',
      totalCommits: level.contributor.totalCommits ?? 0,
      rank: levels.length - idx,
    };
    const intro = new LevelIntroScene(
      renderer,
      kb,
      idx,
      contributorInfo,
      arc[idx] ?? arc[arc.length - 1]!,
      () => {
        if (isBossLevel) {
          sceneMgr.replace(
            new BossIntroScene(renderer, level.contributor.login, () => {
              sceneMgr.replace(
                new BossScene(renderer, atlas, level, idx, { input, gameLoop, sfx, screenShake, particles }, () => {
                  sceneMgr.replace(
                    new VictoryScene(renderer, repoFullName, 0, showTitle),
                  );
                }),
              );
            }),
          );
        } else {
          sceneMgr.replace(
            new GameplayScene(renderer, atlas, level, idx, { input, gameLoop, sfx, screenShake, particles }, () => {
              playLevel(idx + 1, levels, arc, repoFullName);
            }),
          );
        }
      },
    );
    sceneMgr.replace(intro);
  };

  // Global pause
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !(sceneMgr.top() instanceof PauseScene)) {
      sceneMgr.push(new PauseScene(renderer, gameLoop, () => sceneMgr.pop()));
    }
  });

  showTitle();
  gameLoop.start();
}

function promptForToken(retry: () => void): void {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(13,17,23,0.9);z-index:9999;color:#c9d1d9;font-family:ui-monospace,Menlo,monospace;';
  el.innerHTML = `
    <div style="background:#161b22;border:1px solid #30363d;padding:24px;max-width:480px;">
      <h2 style="margin:0 0 12px 0;">rate limit hit</h2>
      <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;">
        GitHub unauth'd API is 60/hr. Paste a personal access token
        (classic, scope <code>public_repo</code>) to keep going. Stored only in localStorage.
      </p>
      <input id="osi-tok" style="width:100%;padding:8px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;" placeholder="ghp_..."/>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
        <button id="osi-cancel">cancel</button>
        <button id="osi-save">save</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  (document.getElementById('osi-cancel') as HTMLButtonElement).onclick = () => el.remove();
  (document.getElementById('osi-save') as HTMLButtonElement).onclick = () => {
    const val = (document.getElementById('osi-tok') as HTMLInputElement).value.trim();
    if (val) setToken(val);
    el.remove();
    retry();
  };
}

main();
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @osi/invaders typecheck`
Expected: clean.

- [ ] **Step 4: Dev-run smoke**

Run: `pnpm --filter @osi/invaders dev`
Open http://localhost:5173/open-source-invaders/. Expected: title screen shows, featured chip `vitejs/vite` picks it, loading screen shows parallax, level intro shows contributor card, gameplay starts and enemies march.
Kill server when satisfied.

- [ ] **Step 5: Commit**

```bash
git add games/invaders/src/ui/level-transition.ts games/invaders/src/main.ts
git commit -m "feat(invaders): main.ts bootstraps engine, scenes, and full game flow"
```

---

### Task 49: Bundle Kenney assets

**Files:**
- Create: `games/invaders/public/assets/kenney-space-shooter/sheet.png`
- Create: `games/invaders/public/assets/kenney-space-shooter/sheet.xml`
- Create: `games/invaders/public/assets/sfx/*.wav` (14 files)
- Create: `games/invaders/public/assets/CREDITS.md`

- [ ] **Step 1: Download Kenney Space Shooter Redux pack**

Run: `mkdir -p games/invaders/public/assets/kenney-space-shooter games/invaders/public/assets/sfx && curl -L -o /tmp/kenney.zip https://kenney.nl/media/pages/assets/space-shooter-redux/9a50b6ab7c-1677693167/kenney_space-shooter-redux.zip && unzip -o /tmp/kenney.zip -d /tmp/kenney`
Expected: pack extracted.
(If the direct URL 404s, download manually from https://kenney.nl/assets/space-shooter-redux and place the files.)

- [ ] **Step 2: Copy `sheet.png` and `sheet.xml` from the Spritesheet folder to `games/invaders/public/assets/kenney-space-shooter/`**

- [ ] **Step 3: Acquire 14 CC0 SFX files from kenney.nl/assets/interface-sounds or freesound.org** and place them in `games/invaders/public/assets/sfx/` with these filenames: `shoot.wav enemy_shoot.wav hit_soft.wav hit_hard.wav explode_small.wav explode_big.wav powerup_drop.wav powerup_get.wav level_up.wav boss_phase.wav boss_roar.wav boss_die.wav ui_hover.wav ui_click.wav`

- [ ] **Step 4: Write `games/invaders/public/assets/CREDITS.md`**

```markdown
# Asset Credits

## Sprites
Kenney Space Shooter Redux — https://kenney.nl/assets/space-shooter-redux — CC0

## Sound Effects
All SFX from kenney.nl and freesound.org under CC0.
```

- [ ] **Step 5: Manual QA — reload dev server and confirm all sprites render and no 404s**

Run: `pnpm --filter @osi/invaders dev`
Open DevTools Network tab, filter by assets/, expect zero 404s.

- [ ] **Step 6: Commit**

```bash
git add games/invaders/public/assets
git commit -m "chore(invaders): bundle Kenney sprites + CC0 SFX"
```

---

### Task 50: GitHub Actions deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r test
      - run: pnpm -r typecheck
      - run: pnpm --filter @osi/invaders build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./games/invaders/dist
          force_orphan: true
```

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy @osi/invaders to GitHub Pages on main"
```

- [ ] **Step 3: Verify GitHub Pages**

After push, go to repo Settings → Pages, set Source: "Deploy from branch", Branch: `gh-pages`, root. Wait for first workflow run. Expected: site reachable at `https://<user>.github.io/open-source-invaders/`.

---

### Task 51: Manual QA release checklist

**Files:**
- (none — process task)

- [ ] Title loads in under 1.5 s, parallax is smooth
- [ ] Featured repo reaches gameplay in under 3 s after cache warm
- [ ] Each level shows: contributor card, ship upgrade sprite, knowledge chunk
- [ ] Boss has 3 visually-distinct phases (large → drones → red final)
- [ ] Each powerup observed at least once: `revert`, `fork`, `rebase`, `squash`, `forcepush`
- [ ] At least one chaos event fires per run
- [ ] Rate-limit fallback: exhaust 60/hr via anonymous mode, PAT modal appears, token accepted
- [ ] 60 fps in Chrome, Firefox, Safari on a 2020 MacBook Air
- [ ] Keyboard: ←→ move, SPACE shoot/skip, ESC pause, X bomb
- [ ] Mobile load does not crash (full support deferred to v2)
- [ ] Multi-kill combos, hit-stop, particle bursts, and screen shake all visibly firing

No commit — this is a process checklist run against a built deploy.

---

### Task 52: Self-review sweep

**Files:**
- (none — review pass over plan + implementation)

- [ ] Grep the codebase for magic numbers outside `config/balance.ts`:
  Run: Grep for numeric literals > 5 in `games/invaders/src/systems/` and `games/invaders/src/scenes/`. Expected: every flagged literal either (a) is a coordinate/index, or (b) is imported from `BALANCE`.
- [ ] Run full test suite:
  `pnpm -r test` — expected all engine + invaders tests green
- [ ] Run full typecheck:
  `pnpm -r typecheck` — expected clean
- [ ] Run production build:
  `pnpm --filter @osi/invaders build` — expected bundle size < 200 KB gzipped (inspect `games/invaders/dist/assets/*.js`)
- [ ] Tag the release:
  `git tag v0.1.0 && git push --tags`

---

## Completion criteria

This plan is complete when all 14 success-criteria items from the design spec (§14) are observable:

1. A new visitor can play title → 5 levels → boss → victory with any valid public GitHub repo URL.
2. 60 fps throughout on a 2020 MacBook Air.
3. `@osi/engine` compiles and `pnpm --filter @osi/engine test` passes in isolation.
4. Site is reachable at the GitHub Pages permalink.
5. A gameplay screenshot shows combos, hit-stop, particle explosions, and screen shake simultaneously.

If any criterion is not met, a follow-up task should be added to this file and the plan re-run.
