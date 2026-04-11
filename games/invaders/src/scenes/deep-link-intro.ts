import { Scene, AmbientMusic } from '@osi/engine';
import type { Renderer, Sfx, ParticleEmitter, AudioBus } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { drawBrandHeader } from '../ui/brand.js';

export class DeepLinkIntroScene extends Scene {
  private elapsed = 0;
  private fired = false;
  private music: AmbientMusic | null = null;

  constructor(
    private renderer: Renderer,
    private repoFullName: string,
    private stars: ParticleEmitter,
    private sfx: Sfx,
    private audio: AudioBus,
    private onLaunch: () => void,
  ) {
    super();
  }

  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
    const music = new AmbientMusic(this.audio);
    this.music = music;
    this.audio.onUnlocked(() => {
      if (this.fired) return;
      this.sfx.play('boss_roar', { volume: 0.5 });
      music.start('foreboding', { volume: 0.4 });
    });
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
  }

  override update(dt: number): void {
    this.elapsed += dt;
    const W = BALANCE.viewportWidth;
    if (Math.random() < 0.6) {
      this.stars.spawn({
        x: Math.random() * W,
        y: -4,
        vx: 0,
        vy: 40 + Math.random() * 90,
        life: 8,
      });
    }
    this.stars.update(dt);
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.elapsed < 0.4 || this.fired) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.fired = true;
      this.onLaunch();
    }
  };

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();

    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
    vignette.addColorStop(0, 'rgba(248, 81, 73, 0.18)');
    vignette.addColorStop(1, 'rgba(13, 17, 23, 0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    this.stars.render(ctx);

    drawBrandHeader(ctx, {
      cx: W / 2,
      topY: 22,
      elapsed: this.elapsed,
      compact: true,
    });

    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4);

    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(248, 81, 73, ${0.55 + 0.25 * pulse})`;
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    ctx.fillText('// INCOMING TRANSMISSION', W / 2, 142);

    ctx.fillStyle = '#f85149';
    ctx.font = 'bold 38px ui-monospace, Menlo, monospace';
    ctx.fillText('GET READY TO FACE', W / 2, 196);

    ctx.fillStyle = '#ffa657';
    ctx.font = 'bold 50px ui-monospace, Menlo, monospace';
    ctx.fillText('THE 5 BOSSES', W / 2, 256);

    ctx.fillStyle = '#8b949e';
    ctx.font = '18px ui-monospace, Menlo, monospace';
    ctx.fillText('OF', W / 2, 290);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 32px ui-monospace, Menlo, monospace';
    const repo = fitRepoText(ctx, this.repoFullName, W - 120);
    ctx.fillText(repo, W / 2, 334);

    ctx.fillStyle = `rgba(201, 209, 217, ${0.4 + 0.5 * pulse})`;
    ctx.font = 'italic 20px ui-monospace, Menlo, monospace';
    ctx.fillText('are you ready?', W / 2, 396);

    const btnW = 340;
    const btnH = 54;
    const btnX = W / 2 - btnW / 2;
    const btnY = H - btnH - 40;

    ctx.fillStyle = '#da3633';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + 0.12 * pulse})`;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillText('PRESS ENTER TO START', W / 2, btnY + btnH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    this.renderer.endFrame();
  }
}

function fitRepoText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
