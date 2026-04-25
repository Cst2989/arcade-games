import { Scene } from '@osi/engine';
import type { Renderer, GameLoop } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { setInGame } from '../ui/chrome.js';

export class PauseScene extends Scene {
  constructor(
    private renderer: Renderer,
    private gameLoop: GameLoop,
    private resumeCb: () => void,
    private touch = false,
  ) {
    super();
  }
  override onEnter(): void {
    this.gameLoop.timeScale = 0;
    setInGame(false);
    window.addEventListener('keydown', this.onKey);
    if (this.touch) window.addEventListener('pointerdown', this.onTap);
  }
  override onExit(): void {
    this.gameLoop.timeScale = 1;
    setInGame(true);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerdown', this.onTap);
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.resumeCb();
  };
  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest('#touch-controls')) return;
    this.resumeCb();
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
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.touch ? 'TAP TO RESUME' : 'ESC to resume', BALANCE.viewportWidth / 2, BALANCE.viewportHeight / 2 + 30);
    ctx.restore();
  }
}
