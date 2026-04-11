import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { GameStats } from './gameplay-context.js';

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
}

const CONFETTI_COLORS = [
  '#39d353', '#26a641', '#006d32', '#58a6ff', '#d29922', '#a371f7', '#f85149', '#ffa657',
];

export class VictoryScene extends Scene {
  private confetti: Confetto[] = [];
  private elapsed = 0;
  private spawnTimer = 0;

  constructor(
    private renderer: Renderer,
    private repoName: string,
    private stats: GameStats,
    private onReplay: () => void,
  ) {
    super();
  }

  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
    this.spawnBurst(80);
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.elapsed < 0.6) return;
    if (e.key === 'Enter') this.onReplay();
  };

  override update(dt: number): void {
    this.elapsed += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer >= 0.4 && this.elapsed < 5) {
      this.spawnTimer = 0;
      this.spawnBurst(30);
    }
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 140 * dt;
      c.vx *= 0.995;
      c.rot += c.vrot * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < BALANCE.viewportHeight + 40);
  }

  private spawnBurst(n: number): void {
    const H = BALANCE.viewportHeight;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      const x = fromLeft ? -10 : BALANCE.viewportWidth + 10;
      const y = 40 + Math.random() * (H * 0.35);
      const vx = (fromLeft ? 1 : -1) * (140 + Math.random() * 180);
      const vy = -60 - Math.random() * 140;
      this.confetti.push({
        x, y, vx, vy,
        size: 4 + Math.random() * 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        life: 2.6 + Math.random() * 1.4,
      });
    }
  }

  private renderConfetti(ctx: CanvasRenderingContext2D): void {
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.globalAlpha = Math.min(1, c.life / 1.2);
      ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();
    ctx.fillStyle = BALANCE.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(63, 185, 80, 0.08)';
    ctx.fillRect(0, 0, W, H);

    this.renderConfetti(ctx);

    ctx.fillStyle = BALANCE.accentGreen;
    ctx.font = 'bold 44px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAIN BRANCH GREEN', W / 2, 90);
    ctx.font = '16px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`${this.repoName} — shipped`, W / 2, 118);

    const card = { x: W / 2 - 320, y: 150, w: 640, h: 380 };
    ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText('FINAL SCORE', W / 2, card.y + 36);
    ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.fillText(this.stats.totalScore.toLocaleString(), W / 2, card.y + 90);

    ctx.strokeStyle = '#21262d';
    ctx.beginPath();
    ctx.moveTo(card.x + 40, card.y + 118);
    ctx.lineTo(card.x + card.w - 40, card.y + 118);
    ctx.stroke();

    const { shotsFired, shotsHit, enemiesKilled, bombsUsed, powerupsCollected, levelsCompleted } = this.stats;
    const accuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;

    const col1X = card.x + 80;
    const col2X = card.x + 360;
    let row = card.y + 156;
    const rowH = 56;

    drawStat(ctx, col1X, row, 'ENEMIES KILLED', enemiesKilled.toLocaleString(), '#c9d1d9');
    drawStat(ctx, col2X, row, 'LEVELS CLEARED', `${levelsCompleted} / 5`, '#c9d1d9');
    row += rowH;

    drawStat(ctx, col1X, row, 'SHOTS FIRED', shotsFired.toLocaleString(), '#c9d1d9');
    drawStat(ctx, col2X, row, 'ACCURACY', `${accuracy}%`, accuracy >= 50 ? BALANCE.accentGreen : '#ffa657');
    row += rowH;

    drawStat(ctx, col1X, row, 'POWER-UPS USED', powerupsCollected.toLocaleString(), '#a371f7');
    drawStat(ctx, col2X, row, 'BOMBS DETONATED', bombsUsed.toLocaleString(), '#f85149');

    ctx.fillStyle = '#8b949e';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER to play another repo', W / 2, H - 28);
    this.renderer.endFrame();
  }
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string,
): void {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6e7681';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(label, x, y);
  ctx.fillStyle = color;
  ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
  ctx.fillText(value, x, y + 30);
}
