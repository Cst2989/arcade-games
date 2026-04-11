import { Scene } from '@osi/engine';
import type { Renderer, GameLoop } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class PauseScene extends Scene {
  constructor(
    private renderer: Renderer,
    private gameLoop: GameLoop,
    private resumeCb: () => void,
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
    if (e.key === 'Escape') this.resumeCb();
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
