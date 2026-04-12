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
