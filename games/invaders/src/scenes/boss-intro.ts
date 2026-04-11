import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class BossIntroScene extends Scene {
  private t = 0;
  constructor(
    private renderer: Renderer,
    private contributorLogin: string,
    private onDone: () => void,
  ) {
    super();
  }
  override update(dt: number): void {
    this.t += dt;
    if (this.t > 2.2) this.onDone();
  }
  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    const alpha = Math.min(1, this.t / 0.3);
    ctx.fillStyle = `rgba(248, 81, 73, ${0.25 * alpha})`;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = BALANCE.accentRed;
    ctx.font = 'bold 52px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINAL COMMIT', BALANCE.viewportWidth / 2, 260);
    ctx.font = '22px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(`vs @${this.contributorLogin}`, BALANCE.viewportWidth / 2, 310);
    this.renderer.endFrame();
  }
}
