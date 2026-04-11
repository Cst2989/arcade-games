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
    window.addEventListener('paste', this.onPaste);
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
    window.removeEventListener('paste', this.onPaste);
  }

  private sanitizeRepoInput(raw: string): string {
    const trimmed = raw.trim();
    // Accept full GitHub URLs by extracting owner/name
    const urlMatch = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
    const core = urlMatch ? urlMatch[1]! : trimmed;
    // Strip trailing .git, query strings, hashes, trailing slashes
    return core
      .replace(/\.git$/i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .replace(/[^\w\-/.]/g, '');
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
    } else if (
      !e.metaKey && !e.ctrlKey && !e.altKey &&
      e.key.length === 1 && /[\w\-/.]/.test(e.key)
    ) {
      this.inputValue += e.key;
    }
  };

  private onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();
    const cleaned = this.sanitizeRepoInput(text);
    if (!cleaned) return;
    this.inputValue = (this.inputValue + cleaned).slice(0, 80);
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
    ctx.fillText('TAB cycles · ENTER launches · (try typing your own repo)', BALANCE.viewportWidth / 2, 480);
    this.renderer.endFrame();
  }
}
