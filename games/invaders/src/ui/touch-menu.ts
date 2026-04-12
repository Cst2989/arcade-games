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
