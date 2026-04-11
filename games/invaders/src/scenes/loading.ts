import { Scene } from '@osi/engine';
import type { Keyboard, ParticleEmitter, Renderer, SpriteAtlas } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class LoadingScene extends Scene {
  private shipX = BALANCE.viewportWidth / 2;
  private progress = 0;
  private label = 'fetching repo';

  constructor(
    private renderer: Renderer,
    private atlas: SpriteAtlas,
    private stars: ParticleEmitter,
    private kb: Keyboard,
  ) {
    super();
  }

  setProgress(p: number, label: string): void {
    this.progress = Math.max(0, Math.min(1, p));
    this.label = label;
  }

  override update(dt: number): void {
    this.stars.update(dt);
    const speed = BALANCE.playerSpeed * 0.6;
    if (this.kb.isDown('ArrowLeft')) this.shipX -= speed * dt;
    if (this.kb.isDown('ArrowRight')) this.shipX += speed * dt;
    this.shipX = Math.max(40, Math.min(BALANCE.viewportWidth - 40, this.shipX));
  }

  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    this.stars.render(ctx);
    if (this.atlas.has('playerShip1_blue.png')) {
      this.atlas.draw(ctx, 'playerShip1_blue.png', this.shipX, BALANCE.viewportHeight - 90, 0.7);
    } else {
      ctx.fillStyle = BALANCE.accentCyan;
      ctx.fillRect(this.shipX - 16, BALANCE.viewportHeight - 106, 32, 32);
    }
    const barW = 500;
    const barX = (BALANCE.viewportWidth - barW) / 2;
    const barY = BALANCE.viewportHeight - 40;
    ctx.fillStyle = BALANCE.bgAlt;
    ctx.fillRect(barX, barY, barW, 12);
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.fillRect(barX, barY, barW * this.progress, 12);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, BALANCE.viewportWidth / 2, barY - 10);
    this.renderer.endFrame();
  }
}
