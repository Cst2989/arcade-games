import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class GameOverScene extends Scene {
  constructor(
    private renderer: Renderer,
    private score: number,
    private waveReached: number,
    private onRestart: () => void,
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
    if (e.key === 'Enter' || e.key === ' ') this.onRestart();
  };

  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);

    ctx.fillStyle = 'rgba(248, 81, 73, 0.10)';
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);

    ctx.textAlign = 'center';
    ctx.fillStyle = BALANCE.accentRed;
    ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
    ctx.fillText('GAME OVER', BALANCE.viewportWidth / 2, 220);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '18px ui-monospace, Menlo, monospace';
    ctx.fillText(`final score  ${this.score}`, BALANCE.viewportWidth / 2, 270);
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`weeks defended  ${this.waveReached}`, BALANCE.viewportWidth / 2, 296);

    ctx.fillStyle = BALANCE.accentGreen;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillText('press ENTER to retry', BALANCE.viewportWidth / 2, 380);

    this.renderer.endFrame();
  }
}
