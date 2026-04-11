import { Scene } from '@osi/engine';
import type { Renderer, Keyboard } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { drawContributorCard } from '../ui/contributor-card.js';
import { tokenize, kindColor } from '../ui/syntax-highlight.js';
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
    const target = Math.floor(this.typewriterT * 40);
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
      ctx.fillStyle = kindColor(t.kind);
      ctx.fillText(t.text, cx, cy);
      cx += ctx.measureText(t.text).width;
    }
  }
}
