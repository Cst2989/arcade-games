# Mobile Responsive Design

> **For agentic workers:** This spec defines what to build. Use `superpowers:writing-plans` to create the implementation plan.

**Goal:** Make Open Source Invaders fully playable on mobile devices in landscape orientation, with touch controls and a responsive canvas, while changing zero game logic or engine code.

**Approach:** Pure DOM overlay. The canvas keeps its 960x600 internal resolution, scaled via CSS to fit any viewport. Touch controls are HTML elements layered on top, injecting synthetic keyboard events into the existing input system.

---

## 1. Canvas Scaling

### Requirements

- The canvas internal resolution stays fixed at 960x600 (BALANCE.viewportWidth / viewportHeight).
- On load and on every `resize` / `orientationchange` event, compute the largest rectangle that fits the viewport while preserving the 960:600 (16:10) aspect ratio.
- Apply the computed `width` and `height` as CSS properties on the `<canvas>` element. Do NOT change the `width`/`height` HTML attributes (those are the internal resolution).
- Center the canvas in the viewport using flexbox on `<body>`.
- Store the current canvas bounding rect (`{ left, top, width, height }`) in a shared observable so the touch overlay can position itself.
- Call `screen.orientation.lock('landscape').catch(() => {})` as a best-effort orientation hint on mobile.

### Scaling formula

```
if (viewportW / viewportH > 960 / 600) {
  // viewport is wider than 16:10 — fit to height
  cssHeight = viewportH
  cssWidth  = viewportH * (960 / 600)
} else {
  // viewport is taller — fit to width
  cssWidth  = viewportW
  cssHeight = viewportW * (600 / 960)
}
```

### HTML / CSS changes

- Keep `width="960" height="600"` on the `<canvas>` tag in `index.html` (these set the internal drawing resolution and must stay). The canvas scaler applies **CSS** `width`/`height` (via `style.width` and `style.height`) to visually scale the element — these are independent of the HTML attributes.
- `<body>`: add `display: flex; justify-content: center; align-items: center; height: 100dvh;` (use `dvh` for mobile address-bar-aware height, fallback to `100vh`).
- `<canvas>`: remove `margin: 0 auto`, add `max-width: 100vw; max-height: 100dvh;`.
- Add `<meta name="screen-orientation" content="landscape">` for PWA hint.

### File

- **New:** `games/invaders/src/ui/canvas-scaler.ts`
  - Exports `CanvasScaler` class
  - Constructor takes canvas element
  - `getRect(): { left: number; top: number; width: number; height: number }` returns current canvas CSS rect
  - Attaches `resize` and `orientationchange` listeners
  - Calls `screen.orientation.lock('landscape').catch(() => {})` on init
  - `destroy()` removes listeners

---

## 2. Touch Detection

### Requirements

- Detect touch capability without user-agent sniffing:
  ```ts
  function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
  ```
- Evaluated once at startup in `main.ts`. Result passed as a boolean flag to components that need it.
- Touch detection controls:
  - Whether gameplay touch buttons are created
  - Whether title screen DOM overlays are created
  - Whether scene button text says "PRESS ENTER" vs "TAP TO START"

### File

- **New:** `games/invaders/src/ui/touch-detect.ts`
  - Exports `isTouchDevice(): boolean`

---

## 3. Gameplay Touch Controls

### Requirements

- A DOM container `#touch-controls` positioned absolutely over the canvas, matching the canvas rect exactly (updated on resize).
- Only created if `isTouchDevice()` is true.
- Contains four buttons in landscape two-handed layout:

```
┌─────────────────────────────────────────────────┐
│                   GAME CANVAS                   │
│                                                 │
│                                                 │
│  ┌───┐ ┌───┐                      ┌──────┐     │
│  │ ← │ │ → │                      │ FIRE │     │
│  └───┘ └───┘                      ├──────┤     │
│                                   │ BOMB │     │
│                                   └──────┘     │
└─────────────────────────────────────────────────┘
```

- **Left arrow (←):** bottom-left, ~64x64px
- **Right arrow (→):** adjacent to left arrow, ~64x64px, ~8px gap
- **Fire:** bottom-right, ~80x64px
- **Bomb:** above or below Fire, ~64x48px

### Button behavior

- `pointerdown` on a button dispatches a synthetic `KeyboardEvent('keydown', { code: <mapped-code> })` on `window`. The mapped codes are:
  - Left arrow → `'ArrowLeft'`
  - Right arrow → `'ArrowRight'`
  - Fire → `'Space'`
  - Bomb → `'KeyX'`
- `pointerup` / `pointercancel` / `pointerleave` dispatches the corresponding `keyup`.
- Each button tracks its active `pointerId` for multi-touch support (player can hold left while tapping fire).
- Buttons use `touch-action: none` to prevent browser scroll/zoom.

### Styling

- Background: `rgba(201, 209, 217, 0.15)`
- Border: 2px solid `#30363d`
- Labels/icons: white, monospace font, ~14px
- Fixed opacity: ~45% (`opacity: 0.45`)
- Border-radius: 8px
- No hover states (touch only)

### Visibility

- Shown when `setInGame(true)` is called (gameplay active)
- Hidden when `setInGame(false)` is called (menus, pause, game over)
- Uses the existing `body.osi-in-game` CSS class: `body.osi-in-game #touch-controls { display: flex; }`

### File

- **New:** `games/invaders/src/ui/touch-controls.ts`
  - Exports `TouchControls` class
  - Constructor takes `CanvasScaler` instance for positioning
  - `mount(): void` — creates DOM elements, attaches pointer listeners
  - `unmount(): void` — removes DOM elements and listeners
  - `reposition(): void` — called by canvas scaler on resize, updates container position/size to match canvas rect

---

## 4. Title Screen Mobile Overlays

### Requirements

On touch devices, three DOM elements are overlaid on the canvas title screen:

1. **Text input** — Positioned over the canvas-rendered input box (center of screen, ~460x52px in canvas coords). Styled to be transparent (the canvas renders the visual). Receives native mobile keyboard input. `input` event syncs value back to `TitleScene.inputValue`. `keydown` Enter triggers `onStart()`.

2. **Featured repo chips** — Four tappable DOM buttons positioned over the canvas-rendered chip positions. Each calls `onStart(repoName)` on tap. Transparent background — canvas renders the visual, DOM provides the tap target.

3. **Launch button** — Tappable DOM element over the canvas "PRESS ENTER TO LAUNCH" button area. Fires `onStart()` on tap. Transparent — canvas renders the visual.

### Positioning

All positions are computed by mapping canvas coordinates to screen coordinates using the canvas scaler rect:

```ts
function canvasToScreen(canvasX: number, canvasY: number, rect: DOMRect): { x: number; y: number } {
  const scaleX = rect.width / 960;
  const scaleY = rect.height / 600;
  return {
    x: rect.left + canvasX * scaleX,
    y: rect.top + canvasY * scaleY,
  };
}
```

### Lifecycle

- `TitleScene.onEnter()` → if touch, mount overlays
- `TitleScene.onExit()` → unmount overlays
- Overlays reposition on canvas resize

### File

- **New:** `games/invaders/src/ui/touch-menu.ts`
  - Exports `TouchMenuOverlays` class
  - Constructor takes `CanvasScaler`
  - `mountTitle(opts: { onStart: (repo: string) => void, getInput: () => string, setInput: (v: string) => void }): void`
  - `unmountTitle(): void`
  - `reposition(): void`

---

## 5. Scene Text Adaptation

### Requirements

Scenes that display "PRESS ENTER TO ..." change their text based on the touch flag:

| Scene | Desktop text | Mobile text |
|-------|-------------|-------------|
| `deep-link-intro.ts` | "PRESS ENTER TO START" | "TAP TO START" |
| `level-intro.ts` | "PRESS SPACE TO BEGIN" | "TAP TO BEGIN" |
| `game-over.ts` | "press ENTER to retry" | "TAP TO RETRY" |
| `pause.ts` | "PRESS ESC TO RESUME" | "TAP TO RESUME" |
| `victory.ts` | "press ENTER to continue" | "TAP TO CONTINUE" |

Each of these scenes also adds a `pointerdown` listener on the canvas (in addition to the existing `keydown` listener) when touch is detected. The pointer listener fires the same action as the keyboard handler.

### Implementation

- Each scene constructor accepts a `touch: boolean` parameter.
- In `onEnter()`: if touch, add `pointerdown` listener on the canvas.
- In `onExit()`: remove the listener.
- In `render()`: use the touch flag to select button text.

---

## 6. Wiring in main.ts

### Boot sequence changes

```
1. Get canvas element
2. Set canvas.width = 960, canvas.height = 600 (internal resolution)
3. Create CanvasScaler(canvas) — starts resize listener, applies CSS sizing
4. Detect touch: const touch = isTouchDevice()
5. If touch: create TouchControls(scaler), mount it
6. If touch: create TouchMenuOverlays(scaler)
7. Pass touch flag when constructing scenes
8. Existing code continues unchanged
```

### setInGame integration

`chrome.ts` `setInGame()` already toggles `body.osi-in-game`. Touch controls visibility is handled purely via CSS:

```css
#touch-controls { display: none; }
body.osi-in-game #touch-controls { display: flex; }
```

No code changes to `chrome.ts` needed.

---

## 7. index.html Changes

### Meta tags

- Add: `<meta name="mobile-web-app-capable" content="yes">`
- Existing `apple-mobile-web-app-capable` already present.

### CSS additions

```css
body {
  /* add to existing rule */
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100dvh;
  min-height: 100vh; /* fallback */
}

canvas {
  /* replace margin: 0 auto */
  max-width: 100vw;
  max-height: 100dvh;
  max-height: 100vh; /* fallback */
}

#touch-controls {
  display: none;
  position: absolute;
  pointer-events: none;
  z-index: 50;
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
}
body.osi-in-game #touch-controls {
  display: flex;
}

.touch-menu-overlay {
  position: absolute;
  z-index: 51;
  pointer-events: auto;
  touch-action: none;
}
```

---

## 8. What Does NOT Change

- **Engine package** — `Keyboard`, `InputMap`, `Pointer`, `Renderer`, `Camera`, `GameLoop` remain untouched.
- **Game systems** — `inputSystem`, `playerControlSystem`, collision, spawning, all unchanged.
- **Canvas rendering** — All scenes render at 960x600 exactly as before. No coordinate changes.
- **Balance config** — `viewportWidth: 960`, `viewportHeight: 600` stays fixed.
- **Desktop experience** — Touch elements are not created on non-touch devices. Zero impact on desktop play.
- **Share panel** — Already DOM-based and responsive.
