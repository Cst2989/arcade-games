import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export class VictoryScene extends Scene {
  constructor(
    private renderer: Renderer,
    private repoName: string,
    private finalScore: number,
    private onReplay: () => void,
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
    if (e.key === 'Enter' || e.key === ' ') this.onReplay();
  };
  override render(): void {
    const ctx = this.renderer.main;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.font = 'bold 48px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAIN BRANCH GREEN', BALANCE.viewportWidth / 2, 200);
    ctx.font = '20px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(`${this.repoName} — shipped`, BALANCE.viewportWidth / 2, 250);
    ctx.fillText(`final score ${this.finalScore}`, BALANCE.viewportWidth / 2, 290);
    ctx.fillStyle = '#8b949e';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillText('ENTER to play another repo', BALANCE.viewportWidth / 2, 400);
    this.renderer.endFrame();
  }
}
