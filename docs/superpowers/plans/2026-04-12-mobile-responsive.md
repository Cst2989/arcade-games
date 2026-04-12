# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Open Source Invaders playable on mobile with CSS canvas scaling, DOM touch controls, and touch-friendly menu scenes — zero changes to engine or game logic.

**Architecture:** The canvas stays at 960x600 internal resolution, scaled via CSS to fit any viewport. Touch controls are DOM buttons overlaid on the canvas that dispatch synthetic keyboard events. Scene text adapts between "PRESS ENTER" and "TAP" based on a touch detection flag.

**Tech Stack:** TypeScript, DOM APIs (pointer events, synthetic KeyboardEvent), CSS (flexbox, dvh, touch-action)

---

### Task 1: Touch Detection Utility

**Files:**
- Create: `games/invaders/src/ui/touch-detect.ts`

- [ ] **Step 1: Create touch-detect.ts**

```ts
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/ui/touch-detect.ts
git commit -m "feat(mobile): add touch detection utility"
```

---

### Task 2: Canvas Scaler

**Files:**
- Create: `games/invaders/src/ui/canvas-scaler.ts`

- [ ] **Step 1: Create canvas-scaler.ts**

```ts
const ASPECT = 960 / 600;

export class CanvasScaler {
  private rect = { left: 0, top: 0, width: 960, height: 600 };

  constructor(private canvas: HTMLCanvasElement) {
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    screen.orientation?.lock('landscape').catch(() => {});
  }

  getRect(): { left: number; top: number; width: number; height: number } {
    return this.rect;
  }

  private resize = (): void => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let cssW: number;
    let cssH: number;

    if (vw / vh > ASPECT) {
      cssH = vh;
      cssW = vh * ASPECT;
    } else {
      cssW = vw;
      cssH = vw / ASPECT;
    }

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const domRect = this.canvas.getBoundingClientRect();
    this.rect = {
      left: domRect.left,
      top: domRect.top,
      width: domRect.width,
      height: domRect.height,
    };
  };

  destroy(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/ui/canvas-scaler.ts
git commit -m "feat(mobile): add canvas scaler for responsive viewport"
```

---

### Task 3: Update index.html CSS for Responsive Layout

**Files:**
- Modify: `games/invaders/index.html:53-56` (body/canvas CSS rules)
- Modify: `games/invaders/index.html:92` (add touch controls CSS after the `body.osi-in-game` rule)
- Modify: `games/invaders/index.html:34-36` (meta tags area)

- [ ] **Step 1: Update body CSS rule**

In `games/invaders/index.html`, change the `html, body` CSS rule at line 54 from:

```css
html, body { margin: 0; padding: 0; background: #0d1117; overflow: hidden; font-family: ui-monospace, Menlo, monospace; color: #c9d1d9; }
```

to:

```css
html, body { margin: 0; padding: 0; background: #0d1117; overflow: hidden; font-family: ui-monospace, Menlo, monospace; color: #c9d1d9; display: flex; justify-content: center; align-items: center; min-height: 100vh; min-height: 100dvh; }
```

- [ ] **Step 2: Update canvas CSS rule**

Change the `canvas` rule at line 55 from:

```css
canvas { display: block; margin: 0 auto; image-rendering: pixelated; }
```

to:

```css
canvas { display: block; image-rendering: pixelated; max-width: 100vw; max-height: 100vh; max-height: 100dvh; }
```

- [ ] **Step 3: Add touch controls CSS**

After the existing `body.osi-in-game #cta-follow { display: none; }` rule at line 92, add:

```css
#touch-controls {
  display: none;
  position: absolute;
  pointer-events: none;
  z-index: 50;
  justify-content: space-between;
  align-items: flex-end;
  padding: 16px;
  box-sizing: border-box;
}
#touch-controls button {
  pointer-events: auto;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  background: rgba(201, 209, 217, 0.15);
  border: 2px solid #30363d;
  border-radius: 8px;
  color: #ffffff;
  font: bold 14px ui-monospace, Menlo, monospace;
  opacity: 0.45;
  user-select: none;
  padding: 0;
  outline: none;
}
body.osi-in-game #touch-controls { display: flex; }

.touch-menu-overlay {
  position: absolute;
  z-index: 51;
  pointer-events: auto;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 4: Add mobile-web-app meta tag**

After the existing `<meta name="apple-mobile-web-app-capable" content="yes" />` at line 36, add:

```html
<meta name="mobile-web-app-capable" content="yes" />
```

- [ ] **Step 5: Verify the page loads**

Run: `pnpm --filter @osi/invaders dev` and open http://localhost:5173 in a browser. The canvas should be centered in the viewport. On desktop, it should look the same as before (centered, dark background).

- [ ] **Step 6: Commit**

```bash
git add games/invaders/index.html
git commit -m "feat(mobile): responsive CSS for canvas scaling and touch controls"
```

---

### Task 4: Gameplay Touch Controls

**Files:**
- Create: `games/invaders/src/ui/touch-controls.ts`

- [ ] **Step 1: Create touch-controls.ts**

```ts
import type { CanvasScaler } from './canvas-scaler.js';

interface ButtonDef {
  label: string;
  code: string;
  key: string;
  width: number;
  height: number;
}

const LEFT: ButtonDef  = { label: '\u2190', code: 'ArrowLeft',  key: 'ArrowLeft',  width: 64, height: 64 };
const RIGHT: ButtonDef = { label: '\u2192', code: 'ArrowRight', key: 'ArrowRight', width: 64, height: 64 };
const FIRE: ButtonDef  = { label: 'FIRE',   code: 'Space',      key: ' ',          width: 80, height: 64 };
const BOMB: ButtonDef  = { label: 'BOMB',   code: 'KeyX',       key: 'x',          width: 64, height: 48 };

export class TouchControls {
  private container: HTMLDivElement | null = null;
  private activePointers = new Map<HTMLElement, number>();

  constructor(private scaler: CanvasScaler) {}

  mount(): void {
    if (this.container) return;

    const container = document.createElement('div');
    container.id = 'touch-controls';
    document.body.appendChild(container);
    this.container = container;

    const leftGroup = document.createElement('div');
    leftGroup.style.cssText = 'display: flex; gap: 8px;';

    const rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px; align-items: flex-end;';

    leftGroup.appendChild(this.createButton(LEFT));
    leftGroup.appendChild(this.createButton(RIGHT));

    rightGroup.appendChild(this.createButton(FIRE));
    rightGroup.appendChild(this.createButton(BOMB));

    container.appendChild(leftGroup);
    container.appendChild(rightGroup);

    this.reposition();
  }

  unmount(): void {
    if (!this.container) return;
    this.container.remove();
    this.container = null;
    this.activePointers.clear();
  }

  reposition(): void {
    if (!this.container) return;
    const r = this.scaler.getRect();
    this.container.style.left = `${r.left}px`;
    this.container.style.top = `${r.top}px`;
    this.container.style.width = `${r.width}px`;
    this.container.style.height = `${r.height}px`;
  }

  private createButton(def: ButtonDef): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = def.label;
    btn.style.width = `${def.width}px`;
    btn.style.height = `${def.height}px`;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      this.activePointers.set(btn, e.pointerId);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: def.code, key: def.key, bubbles: true }));
    });

    const release = (e: PointerEvent) => {
      if (this.activePointers.get(btn) !== e.pointerId) return;
      this.activePointers.delete(btn);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: def.code, key: def.key, bubbles: true }));
    };

    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);

    return btn;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/ui/touch-controls.ts
git commit -m "feat(mobile): gameplay touch controls with synthetic key events"
```

---

### Task 5: Title Screen Touch Overlays

**Files:**
- Create: `games/invaders/src/ui/touch-menu.ts`

- [ ] **Step 1: Create touch-menu.ts**

The title scene renders its input box at canvas coords `(250, 314)` with size `460x52`, chips at y=408 with spacing=175, and the launch button at `(330, 514)` with size `300x48`. These canvas coordinates need to be mapped to screen coords using the scaler rect.

```ts
import type { CanvasScaler } from './canvas-scaler.js';

const FEATURED = ['facebook/react', 'vitejs/vite', 'nodejs/node', 'microsoft/typescript'];

interface TitleOverlayOpts {
  onStart: (repo: string) => void;
  getInput: () => string;
  setInput: (v: string) => void;
}

export class TouchMenuOverlays {
  private elements: HTMLElement[] = [];
  private opts: TitleOverlayOpts | null = null;

  constructor(private scaler: CanvasScaler) {}

  mountTitle(opts: TitleOverlayOpts): void {
    this.opts = opts;
    this.unmountTitle();

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'facebook/react';
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.className = 'touch-menu-overlay';
    input.style.cssText = 'background: transparent; border: none; color: transparent; caret-color: transparent; font: 22px ui-monospace, Menlo, monospace; outline: none; padding: 0 30px;';
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^\w\-/.]/g, '');
      input.value = cleaned;
      opts.setInput(cleaned);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = opts.getInput().trim() || FEATURED[0]!;
        opts.onStart(val);
      }
    });
    document.body.appendChild(input);
    this.elements.push(input);

    for (let i = 0; i < FEATURED.length; i++) {
      const chip = document.createElement('button');
      chip.className = 'touch-menu-overlay';
      chip.style.cssText = 'background: transparent; border: none; color: transparent;';
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        opts.onStart(FEATURED[i]!);
      });
      document.body.appendChild(chip);
      this.elements.push(chip);
    }

    const launch = document.createElement('button');
    launch.className = 'touch-menu-overlay';
    launch.style.cssText = 'background: transparent; border: none; color: transparent;';
    launch.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const val = opts.getInput().trim() || FEATURED[0]!;
      opts.onStart(val);
    });
    document.body.appendChild(launch);
    this.elements.push(launch);

    this.reposition();
  }

  unmountTitle(): void {
    for (const el of this.elements) el.remove();
    this.elements = [];
    this.opts = null;
  }

  reposition(): void {
    if (this.elements.length === 0) return;
    const r = this.scaler.getRect();
    const sx = r.width / 960;
    const sy = r.height / 600;

    const input = this.elements[0]!;
    const inputCanvasX = 250;
    const inputCanvasY = 314;
    const inputCanvasW = 460;
    const inputCanvasH = 52;
    input.style.left = `${r.left + inputCanvasX * sx}px`;
    input.style.top = `${r.top + inputCanvasY * sy}px`;
    input.style.width = `${inputCanvasW * sx}px`;
    input.style.height = `${inputCanvasH * sy}px`;

    const chipSpacing = 175;
    const totalW = chipSpacing * FEATURED.length;
    const chipStartX = 960 / 2 - totalW / 2 + chipSpacing / 2;
    const chipCanvasY = 408;
    const chipW = 160;
    const chipH = 28;
    for (let i = 0; i < FEATURED.length; i++) {
      const chip = this.elements[1 + i]!;
      const cx = chipStartX + i * chipSpacing;
      chip.style.left = `${r.left + (cx - chipW / 2) * sx}px`;
      chip.style.top = `${r.top + (chipCanvasY - chipH / 2) * sy}px`;
      chip.style.width = `${chipW * sx}px`;
      chip.style.height = `${chipH * sy}px`;
    }

    const launch = this.elements[1 + FEATURED.length]!;
    const btnCanvasW = 300;
    const btnCanvasH = 48;
    const btnCanvasX = 960 / 2 - btnCanvasW / 2;
    const btnCanvasY = 600 - btnCanvasH - 38;
    launch.style.left = `${r.left + btnCanvasX * sx}px`;
    launch.style.top = `${r.top + btnCanvasY * sy}px`;
    launch.style.width = `${btnCanvasW * sx}px`;
    launch.style.height = `${btnCanvasH * sy}px`;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add games/invaders/src/ui/touch-menu.ts
git commit -m "feat(mobile): title screen touch overlays for input and chips"
```

---

### Task 6: Scene Text Adaptation — DeepLinkIntroScene

**Files:**
- Modify: `games/invaders/src/scenes/deep-link-intro.ts`

- [ ] **Step 1: Add touch parameter and pointer listener**

In `games/invaders/src/scenes/deep-link-intro.ts`, modify the constructor to accept a `touch` parameter after `onLaunch`. Add a `pointerdown` listener in `onEnter` and remove it in `onExit`. Change the button text in `render`.

Change the constructor signature at line 11 from:

```ts
  constructor(
    private renderer: Renderer,
    private repoFullName: string,
    private stars: ParticleEmitter,
    private sfx: Sfx,
    private audio: AudioBus,
    private onLaunch: () => void,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private repoFullName: string,
    private stars: ParticleEmitter,
    private sfx: Sfx,
    private audio: AudioBus,
    private onLaunch: () => void,
    private touch = false,
  ) {
```

- [ ] **Step 2: Add pointer listener in onEnter/onExit**

In `onEnter()` at line 22, after `window.addEventListener('keydown', this.onKey);`, add:

```ts
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
```

In `onExit()` at line 33, after `window.removeEventListener('keydown', this.onKey);`, add:

```ts
    window.removeEventListener('pointerdown', this.onTap);
```

- [ ] **Step 3: Add onTap handler**

After the `onKey` handler (after line 63), add:

```ts
  private onTap = (e: PointerEvent) => {
    if (this.elapsed < 0.4 || this.fired) return;
    if ((e.target as HTMLElement)?.closest('#touch-controls')) return;
    e.preventDefault();
    this.fired = true;
    this.onLaunch();
  };
```

- [ ] **Step 4: Change button text**

In the `render()` method at line 133, change:

```ts
    ctx.fillText('PRESS ENTER TO START', W / 2, btnY + btnH / 2 + 1);
```

to:

```ts
    ctx.fillText(this.touch ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, btnY + btnH / 2 + 1);
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/scenes/deep-link-intro.ts
git commit -m "feat(mobile): touch support for deep link intro scene"
```

---

### Task 7: Scene Text Adaptation — LevelIntroScene

**Files:**
- Modify: `games/invaders/src/scenes/level-intro.ts`

- [ ] **Step 1: Add touch parameter**

In `games/invaders/src/scenes/level-intro.ts`, change the constructor at line 10 from:

```ts
  constructor(
    private renderer: Renderer,
    private levelIndex: number,
    private rank: number,
    private profile: ContributorProfile,
    private isBossLevel: boolean,
    private onLaunch: () => void,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private levelIndex: number,
    private rank: number,
    private profile: ContributorProfile,
    private isBossLevel: boolean,
    private onLaunch: () => void,
    private touch = false,
  ) {
```

- [ ] **Step 2: Add pointer listener in onEnter/onExit**

In `onEnter()` at line 22, after `window.addEventListener('keydown', this.onKey);`, add:

```ts
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
```

In `onExit()` at line 26, after `window.removeEventListener('keydown', this.onKey);`, add:

```ts
    window.removeEventListener('pointerdown', this.onTap);
```

- [ ] **Step 3: Add onTap handler**

After the `onKey` handler (after line 39), add:

```ts
  private onTap = (e: PointerEvent) => {
    if (this.elapsed < 0.25 || this.fired) return;
    if ((e.target as HTMLElement)?.closest('#touch-controls')) return;
    e.preventDefault();
    this.fired = true;
    this.onLaunch();
  };
```

- [ ] **Step 4: Change button text**

At line 188, change:

```ts
    const prompt = this.isBossLevel ? 'PRESS SPACE TO CONFRONT' : 'PRESS SPACE TO ENGAGE';
```

to:

```ts
    const prompt = this.touch
      ? (this.isBossLevel ? 'TAP TO CONFRONT' : 'TAP TO ENGAGE')
      : (this.isBossLevel ? 'PRESS SPACE TO CONFRONT' : 'PRESS SPACE TO ENGAGE');
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/scenes/level-intro.ts
git commit -m "feat(mobile): touch support for level intro scene"
```

---

### Task 8: Scene Text Adaptation — GameOverScene

**Files:**
- Modify: `games/invaders/src/scenes/game-over.ts`

- [ ] **Step 1: Add touch parameter**

In `games/invaders/src/scenes/game-over.ts`, change the constructor at line 9 from:

```ts
  constructor(
    private renderer: Renderer,
    private score: number,
    private waveReached: number,
    private sfx: Sfx,
    private onRestart: () => void,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private score: number,
    private waveReached: number,
    private sfx: Sfx,
    private onRestart: () => void,
    private touch = false,
  ) {
```

- [ ] **Step 2: Add pointer listener in onEnter/onExit**

In `onEnter()` at line 19, after `window.addEventListener('keydown', this.onKey);`, add:

```ts
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
```

In `onExit()` at line 25, after `window.removeEventListener('keydown', this.onKey);`, add:

```ts
    window.removeEventListener('pointerdown', this.onTap);
```

- [ ] **Step 3: Add onTap handler**

After the `onKey` handler (after line 35), add:

```ts
  private onTap = (_e: PointerEvent) => {
    this.onRestart();
  };
```

- [ ] **Step 4: Change button text**

At line 62, change:

```ts
    ctx.fillText('press ENTER to retry', W / 2, 380);
```

to:

```ts
    ctx.fillText(this.touch ? 'TAP TO RETRY' : 'press ENTER to retry', W / 2, 380);
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/scenes/game-over.ts
git commit -m "feat(mobile): touch support for game over scene"
```

---

### Task 9: Scene Text Adaptation — PauseScene

**Files:**
- Modify: `games/invaders/src/scenes/pause.ts`

- [ ] **Step 1: Add touch parameter**

In `games/invaders/src/scenes/pause.ts`, change the constructor at line 8 from:

```ts
  constructor(
    private renderer: Renderer,
    private gameLoop: GameLoop,
    private resumeCb: () => void,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private gameLoop: GameLoop,
    private resumeCb: () => void,
    private touch = false,
  ) {
```

- [ ] **Step 2: Add pointer listener in onEnter/onExit**

In `onEnter()` at line 14, after `window.addEventListener('keydown', this.onKey);`, add:

```ts
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
```

In `onExit()` at line 20, after `window.removeEventListener('keydown', this.onKey);`, add:

```ts
    window.removeEventListener('pointerdown', this.onTap);
```

- [ ] **Step 3: Add onTap handler**

After the `onKey` handler (after line 26), add:

```ts
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest('#touch-controls')) return;
    this.resumeCb();
  };
```

- [ ] **Step 4: Change resume text**

At line 38, change:

```ts
    ctx.fillText('ESC to resume', BALANCE.viewportWidth / 2, BALANCE.viewportHeight / 2 + 30);
```

to:

```ts
    ctx.fillText(this.touch ? 'TAP TO RESUME' : 'ESC to resume', BALANCE.viewportWidth / 2, BALANCE.viewportHeight / 2 + 30);
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/scenes/pause.ts
git commit -m "feat(mobile): touch support for pause scene"
```

---

### Task 10: Scene Text Adaptation — VictoryScene

**Files:**
- Modify: `games/invaders/src/scenes/victory.ts`

- [ ] **Step 1: Add touch parameter**

In `games/invaders/src/scenes/victory.ts`, change the constructor at line 29 from:

```ts
  constructor(
    private renderer: Renderer,
    private repoName: string,
    private stats: GameStats,
    private levels: Level[],
    private onReplay: () => void,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private repoName: string,
    private stats: GameStats,
    private levels: Level[],
    private onReplay: () => void,
    private touch = false,
  ) {
```

- [ ] **Step 2: Add pointer listener in onEnter/onExit**

In `onEnter()` at line 39, after `window.addEventListener('keydown', this.onKey);`, add:

```ts
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
```

In `onExit()` at line 63, after `window.removeEventListener('keydown', this.onKey);`, add:

```ts
    window.removeEventListener('pointerdown', this.onTap);
```

- [ ] **Step 3: Add onTap handler**

After the `onKey` handler (after line 71), add:

```ts
  private onTap = (e: PointerEvent) => {
    if (this.elapsed < 0.6) return;
    if ((e.target as HTMLElement)?.closest('.osi-share-panel, #touch-controls')) return;
    this.onReplay();
  };
```

- [ ] **Step 4: Change text**

At line 186, change:

```ts
    ctx.fillText('ENTER to play another repo', W / 2, H - 24);
```

to:

```ts
    ctx.fillText(this.touch ? 'TAP TO PLAY ANOTHER REPO' : 'ENTER to play another repo', W / 2, H - 24);
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add games/invaders/src/scenes/victory.ts
git commit -m "feat(mobile): touch support for victory scene"
```

---

### Task 11: Wire Everything in main.ts

**Files:**
- Modify: `games/invaders/src/main.ts`

- [ ] **Step 1: Add imports**

At the top of `games/invaders/src/main.ts`, after the existing scene imports (line 29), add:

```ts
import { CanvasScaler } from './ui/canvas-scaler.js';
import { TouchControls } from './ui/touch-controls.js';
import { TouchMenuOverlays } from './ui/touch-menu.js';
import { isTouchDevice } from './ui/touch-detect.js';
```

- [ ] **Step 2: Create scaler and touch controls after canvas/renderer init**

After line 45 (`const renderer = new Renderer(canvas);`), add:

```ts
const scaler = new CanvasScaler(canvas);
const touch = isTouchDevice();
const touchControls = touch ? new TouchControls(scaler) : null;
const touchMenu = touch ? new TouchMenuOverlays(scaler) : null;
if (touchControls) touchControls.mount();
```

- [ ] **Step 3: Hook up resize to reposition touch controls**

After the touch controls creation (the lines just added), add:

```ts
window.addEventListener('resize', () => {
  touchControls?.reposition();
  touchMenu?.reposition();
});
window.addEventListener('orientationchange', () => {
  touchControls?.reposition();
  touchMenu?.reposition();
});
```

- [ ] **Step 4: Pass touch flag to DeepLinkIntroScene**

At line 141, change:

```ts
    const intro = new DeepLinkIntroScene(
      renderer,
      deepLink,
      particles.stars,
      sfx,
      audio,
      () => startGame(deepLink),
    );
```

to:

```ts
    const intro = new DeepLinkIntroScene(
      renderer,
      deepLink,
      particles.stars,
      sfx,
      audio,
      () => startGame(deepLink),
      touch,
    );
```

- [ ] **Step 5: Pass touch flag and mount overlays for TitleScene**

At line 151, change:

```ts
    const title = new TitleScene(renderer, particles.stars, (repo) => startGame(repo), audio);
```

to:

```ts
    const title = new TitleScene(renderer, particles.stars, (repo) => startGame(repo), audio, touch, touchMenu);
```

Also update the other TitleScene construction at lines 312-313 (inside VictoryScene's onReplay callback):

```ts
sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r), audio, touch, touchMenu));
```

- [ ] **Step 6: Pass touch flag to LevelIntroScene**

At line 290, change:

```ts
  const intro = new LevelIntroScene(
    renderer,
    levelIndex,
    rank,
    level.profile,
    isBossLevel,
    () => {
```

to:

```ts
  const intro = new LevelIntroScene(
    renderer,
    levelIndex,
    rank,
    level.profile,
    isBossLevel,
    () => {
```

Wait — the `onLaunch` callback is the last param before `touch`. Since `touch` defaults to `false`, we need to pass it after the callback. At the `launchLevel` function, after the closing `)` of the LevelIntroScene constructor at line 352 (before `sceneManager.replace(intro)`), this requires changing the constructor call. The `onLaunch` is a long inline callback. Pass `touch` after it:

Find the closing of the LevelIntroScene constructor. At line 290-352, the pattern is:

```ts
  const intro = new LevelIntroScene(
    renderer,
    levelIndex,
    rank,
    level.profile,
    isBossLevel,
    () => {
      // ... long callback ...
    },
  );
```

Change the trailing `,` + `);` to add `touch`:

```ts
  const intro = new LevelIntroScene(
    renderer,
    levelIndex,
    rank,
    level.profile,
    isBossLevel,
    () => {
      // ... long callback unchanged ...
    },
    touch,
  );
```

- [ ] **Step 7: Pass touch flag to GameOverScene**

There are two `GameOverScene` constructions in main.ts. Find both and add `touch` as the last parameter.

First one (inside boss level, around line 318):

```ts
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
          });
```

Change to:

```ts
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
          }, touch);
```

Second one (inside normal level, around line 343):

```ts
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
          });
```

Change to:

```ts
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
          }, touch);
```

- [ ] **Step 8: Pass touch flag to VictoryScene**

Around line 310:

```ts
              const victory = new VictoryScene(renderer, repoFullName, stats, levels, () => {
                sceneManager.clear();
                sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r), audio));
              });
```

Change to:

```ts
              const victory = new VictoryScene(renderer, repoFullName, stats, levels, () => {
                sceneManager.clear();
                sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r), audio, touch, touchMenu));
              }, touch);
```

- [ ] **Step 9: Pass touch flag to PauseScene**

At line 390:

```ts
      sceneManager.push(new PauseScene(renderer, gameLoop, () => sceneManager.pop()));
```

Change to:

```ts
      sceneManager.push(new PauseScene(renderer, gameLoop, () => sceneManager.pop(), touch));
```

- [ ] **Step 10: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add games/invaders/src/main.ts
git commit -m "feat(mobile): wire canvas scaler, touch controls, and touch flag to all scenes"
```

---

### Task 12: Update TitleScene to Accept Touch Overlays

**Files:**
- Modify: `games/invaders/src/scenes/title.ts`

- [ ] **Step 1: Add imports and parameters**

In `games/invaders/src/scenes/title.ts`, add import at the top:

```ts
import type { TouchMenuOverlays } from '../ui/touch-menu.js';
```

Change the constructor at line 15 from:

```ts
  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onStart: (repo: string) => void,
    private audio?: AudioBus,
  ) {
```

to:

```ts
  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onStart: (repo: string) => void,
    private audio?: AudioBus,
    private touch = false,
    private touchMenu?: TouchMenuOverlays | null,
  ) {
```

- [ ] **Step 2: Mount/unmount touch overlays in onEnter/onExit**

In `onEnter()`, after the music setup (after line 39), add:

```ts
    this.touchMenu?.mountTitle({
      onStart: (repo) => this.onStart(repo),
      getInput: () => this.inputValue,
      setInput: (v) => { this.inputValue = v; },
    });
```

In `onExit()`, after the music cleanup (after line 49), add:

```ts
    this.touchMenu?.unmountTitle();
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add games/invaders/src/scenes/title.ts
git commit -m "feat(mobile): wire touch menu overlays to title scene"
```

---

### Task 13: LevelComplete Scene — Verify Touch Works

**Files:**
- Modify: `games/invaders/src/scenes/level-complete.ts`

- [ ] **Step 1: Verify existing pointer support**

The `LevelCompleteScene` already uses mouse events (`mousemove`, `mousedown`, `mouseleave`) on the canvas for button hit-testing (lines 55-57). These translate to pointer events on touch devices, but `mouse*` events fire on touch with a delay. Switch to `pointer*` events for better touch responsiveness.

In `onEnter()` at lines 55-57, change:

```ts
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
```

to:

```ts
    canvas.addEventListener('pointermove', this.onMouseMove as EventListener);
    canvas.addEventListener('pointerdown', this.onMouseDown as EventListener);
    canvas.addEventListener('pointerleave', this.onMouseLeave as EventListener);
```

In `onExit()` at lines 64-66, change:

```ts
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mouseleave', this.onMouseLeave);
```

to:

```ts
    canvas.removeEventListener('pointermove', this.onMouseMove as EventListener);
    canvas.removeEventListener('pointerdown', this.onMouseDown as EventListener);
    canvas.removeEventListener('pointerleave', this.onMouseLeave as EventListener);
```

- [ ] **Step 2: Update the mouse event handler types**

At line 138, change:

```ts
  private onMouseMove = (e: MouseEvent) => {
```

to:

```ts
  private onMouseMove = (e: MouseEvent | PointerEvent) => {
```

At line 149, change:

```ts
  private onMouseLeave = () => {
```

(No change needed — no event parameter used.)

At line 156, change:

```ts
  private onMouseDown = (e: MouseEvent) => {
```

to:

```ts
  private onMouseDown = (e: MouseEvent | PointerEvent) => {
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @osi/invaders exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add games/invaders/src/scenes/level-complete.ts
git commit -m "feat(mobile): switch level-complete to pointer events for touch"
```

---

### Task 14: Build Verification and Manual Testing

**Files:**
- No file changes

- [ ] **Step 1: Run full build**

Run: `pnpm --filter @osi/invaders build`
Expected: build succeeds with no errors

- [ ] **Step 2: Start dev server and test on desktop**

Run: `pnpm --filter @osi/invaders dev`
Open http://localhost:5173 in a desktop browser.

Verify:
- Canvas is centered in the viewport
- Canvas scales when browser window is resized (maintains 16:10 aspect ratio)
- No touch controls visible on desktop
- Title screen input works via keyboard
- Game plays normally — all existing functionality intact

- [ ] **Step 3: Test on mobile (or mobile emulation)**

Open Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M).
Select a mobile device (e.g., iPhone 14 Pro, landscape mode).

Verify:
- Canvas fills the viewport in landscape
- Touch controls appear during gameplay (left/right arrows, fire, bomb)
- Touch controls are semi-transparent at ~45% opacity
- Pressing left/right moves the ship
- Pressing fire shoots
- Pressing bomb drops a bomb
- Multi-touch works (hold left while tapping fire)
- Touch controls disappear on pause/game-over/victory screens
- Title screen: tapping the input area brings up keyboard
- Title screen: tapping a featured repo chip launches that repo
- Title screen: tapping the launch button starts the game
- All "PRESS ENTER" text shows as "TAP TO..." on mobile
- Level intro, game over, victory, pause all respond to tap

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(mobile): fixes from manual testing"
```
