import { Scene } from '@osi/engine';
import type { Renderer, Sfx } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { setInGame } from '../ui/chrome.js';

export class GameOverScene extends Scene {
  private elapsed = 0;

  constructor(
    private renderer: Renderer,
    private score: number,
    private waveReached: number,
    private sfx: Sfx,
    private onRestart: () => void,
    private touch = false,
  ) {
    super();
  }

  override onEnter(): void {
    setInGame(false);
    window.addEventListener('keydown', this.onKey);
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
    this.sfx.play('game_over', { volume: 0.8 });
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onTap);
  }

  override update(dt: number): void {
    this.elapsed += dt;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') this.onRestart();
  };

  private onTap = (_e: PointerEvent) => {
    this.onRestart();
  };

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(248, 81, 73, 0.10)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = BALANCE.accentRed;
    ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
    ctx.fillText('GAME OVER', W / 2, 220);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '18px ui-monospace, Menlo, monospace';
    ctx.fillText(`final score  ${this.score}`, W / 2, 270);
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`weeks defended  ${this.waveReached}`, W / 2, 296);

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4);
    ctx.fillStyle = `rgba(57, 211, 83, ${0.75 + 0.25 * pulse})`;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillText(this.touch ? 'TAP TO RETRY' : 'press ENTER to retry', W / 2, 380);

    this.renderer.endFrame();
  }
}
