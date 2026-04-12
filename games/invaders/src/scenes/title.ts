import { Scene, AmbientMusic } from '@osi/engine';
import type { Renderer, ParticleEmitter, AudioBus } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { drawBrandHeader } from '../ui/brand.js';

const FEATURED = ['facebook/react', 'vitejs/vite', 'nodejs/node', 'microsoft/typescript'];

export class TitleScene extends Scene {
  private inputValue = '';
  private blinkT = 0;
  private elapsed = 0;
  private selectedChip = 0;
  private music: AmbientMusic | null = null;
  private touchOverlay: HTMLDivElement | null = null;
  private domInput: HTMLInputElement | null = null;

  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onStart: (repo: string) => void,
    private audio?: AudioBus,
    private touch = false,
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
    if (this.audio) {
      const music = new AmbientMusic(this.audio);
      this.music = music;
      this.audio.onUnlocked(() => music.start('welcoming', { volume: 0.32 }));
    }
    if (this.touch) {
      this.mountTouchOverlay();
      window.addEventListener('resize', this.repositionTouchOverlay);
    }
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('paste', this.onPaste);
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
    if (this.touchOverlay) {
      window.removeEventListener('resize', this.repositionTouchOverlay);
      this.touchOverlay.remove();
      this.touchOverlay = null;
      this.domInput = null;
    }
  }

  private sanitizeRepoInput(raw: string): string {
    const trimmed = raw.trim();
    const urlMatch = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
    const core = urlMatch ? urlMatch[1]! : trimmed;
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

  private mountTouchOverlay(): void {
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:absolute;width:${W}px;height:${H}px;transform-origin:top left;pointer-events:none;z-index:10;`;
    document.body.appendChild(overlay);
    this.touchOverlay = overlay;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'owner/repo';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    const inputW = 460;
    const inputH = 52;
    const inputX = W / 2 - inputW / 2;
    const inputY = 314;
    input.style.cssText = `position:absolute;pointer-events:auto;touch-action:manipulation;left:${inputX}px;top:${inputY}px;width:${inputW}px;height:${inputH}px;padding:0 12px 0 30px;background:#0d1117;border:2px solid rgba(57,211,83,0.7);color:#c9d1d9;font:20px ui-monospace,Menlo,monospace;outline:none;box-sizing:border-box;-webkit-appearance:none;border-radius:0;`;
    input.addEventListener('input', () => {
      this.inputValue = this.sanitizeRepoInput(input.value);
    });
    overlay.appendChild(input);
    this.domInput = input;

    const chipY = 408;
    const chipSpacing = 175;
    const totalCW = chipSpacing * FEATURED.length;
    const chipStartX = W / 2 - totalCW / 2 + chipSpacing / 2;
    FEATURED.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      const cx = chipStartX + i * chipSpacing;
      const chipW = 160;
      const chipH = 28;
      btn.style.cssText = `position:absolute;pointer-events:auto;touch-action:manipulation;left:${cx - chipW / 2}px;top:${chipY - chipH / 2}px;width:${chipW}px;height:${chipH}px;background:rgba(22,27,34,0.85);border:1px solid #30363d;color:#8b949e;font:12px ui-monospace,Menlo,monospace;padding:0;-webkit-tap-highlight-color:transparent;`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onStart(name);
      });
      overlay.appendChild(btn);
    });

    const btnW = 300;
    const btnH = 48;
    const btnX = W / 2 - btnW / 2;
    const btnY = H - btnH - 38;
    const launch = document.createElement('button');
    launch.textContent = 'PRESS TO LAUNCH';
    launch.style.cssText = `position:absolute;pointer-events:auto;touch-action:manipulation;left:${btnX}px;top:${btnY}px;width:${btnW}px;height:${btnH}px;background:#238636;border:2px solid #2ea043;color:#fff;font:bold 16px ui-monospace,Menlo,monospace;padding:0;-webkit-tap-highlight-color:transparent;`;
    launch.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const val = this.inputValue.trim() || FEATURED[this.selectedChip]!;
      this.onStart(val);
    });
    overlay.appendChild(launch);

    this.repositionTouchOverlay();
  }

  private repositionTouchOverlay = (): void => {
    if (!this.touchOverlay) return;
    const canvas = this.renderer.main.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / BALANCE.viewportWidth;
    const sy = rect.height / BALANCE.viewportHeight;
    this.touchOverlay.style.left = `${rect.left}px`;
    this.touchOverlay.style.top = `${rect.top}px`;
    this.touchOverlay.style.transform = `scale(${sx},${sy})`;
  };

  override update(dt: number): void {
    this.blinkT += dt;
    this.elapsed += dt;
    this.stars.update(dt);
  }

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();

    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createRadialGradient(W / 2, H / 2 - 40, 60, W / 2, H / 2, W * 0.8);
    grad.addColorStop(0, 'rgba(57, 211, 83, 0.10)');
    grad.addColorStop(1, 'rgba(13, 17, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.stars.render(ctx);

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2);

    drawBrandHeader(ctx, {
      cx: W / 2,
      topY: 56,
      elapsed: this.elapsed,
      tagline: '// any GitHub repo becomes an arcade battle',
    });

    const card = { x: W / 2 - 380, y: 180, w: 760, h: 90 };
    ctx.fillStyle = 'rgba(22, 27, 34, 0.6)';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Top 5 contributors become 5 levels. The #1 committer is the final boss.',
      W / 2, card.y + 32,
    );
    ctx.fillStyle = '#8b949e';
    ctx.fillText(
      '← → move · SPACE fire · X bomb · ESC pause',
      W / 2, card.y + 56,
    );
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(
      'Share a battle with  ?repo=owner/name',
      W / 2, card.y + 76,
    );

    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER A REPO — owner/name', W / 2, 300);

    const inputW = 460;
    const inputH = 52;
    const inputX = W / 2 - inputW / 2;
    const inputY = 314;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(inputX, inputY, inputW, inputH);
    ctx.strokeStyle = `rgba(57, 211, 83, ${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(inputX + 1, inputY + 1, inputW - 2, inputH - 2);

    ctx.fillStyle = '#39d353';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('>', inputX + 12, inputY + 32);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '22px ui-monospace, Menlo, monospace';
    const cursor = Math.floor(this.blinkT * 2) % 2 === 0 ? '_' : ' ';
    const placeholder = this.inputValue === '';
    ctx.fillStyle = placeholder ? '#484f58' : '#c9d1d9';
    const displayText = placeholder ? 'facebook/react' : this.inputValue;
    ctx.fillText(displayText + (placeholder ? '' : cursor), inputX + 30, inputY + 34);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText('// or pick a featured repo with TAB', W / 2, 392);

    const chipY = 408;
    const chipSpacing = 175;
    const totalW = chipSpacing * FEATURED.length;
    const startX = W / 2 - totalW / 2 + chipSpacing / 2;
    FEATURED.forEach((name, i) => {
      const cx = startX + i * chipSpacing;
      const selected = i === this.selectedChip;
      const chipW = 160;
      const chipH = 28;
      const cy = chipY;
      ctx.fillStyle = selected ? 'rgba(35, 134, 54, 0.35)' : 'rgba(22, 27, 34, 0.7)';
      ctx.fillRect(cx - chipW / 2, cy - chipH / 2, chipW, chipH);
      ctx.strokeStyle = selected ? '#39d353' : '#30363d';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(cx - chipW / 2 + 0.5, cy - chipH / 2 + 0.5, chipW - 1, chipH - 1);
      ctx.fillStyle = selected ? '#39d353' : '#8b949e';
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillText(name, cx, cy + 4);
    });

    const btnW = 300;
    const btnH = 48;
    const btnX = W / 2 - btnW / 2;
    const btnY = H - btnH - 38;

    ctx.fillStyle = '#238636';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + 0.14 * pulse})`;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#2ea043';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    ctx.fillText('PRESS ENTER TO LAUNCH', W / 2, btnY + btnH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    this.renderer.endFrame();
  }
}
