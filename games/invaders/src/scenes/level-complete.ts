import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { ContributorProfile } from '../data/contributor-profile.js';

export class LevelCompleteScene extends Scene {
  private shareState: 'idle' | 'copied' | 'failed' = 'idle';
  private nextPressed = false;

  constructor(
    private renderer: Renderer,
    private profile: ContributorProfile,
    private score: number,
    private nextLabel: string,
    private onNext: () => void,
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
    if (e.key === 'Enter' || e.key === ' ') {
      if (this.nextPressed) return;
      this.nextPressed = true;
      this.onNext();
    } else if (e.key === 's' || e.key === 'S') {
      this.handleShare();
    }
  };

  private handleShare(): void {
    const text =
      `I defeated @${this.profile.login} in Open Source Invaders — score ${this.score}. ` +
      `Their biggest contribution: "${this.profile.biggestContribution.message}"`;
    const clip = (navigator as { clipboard?: { writeText?: (s: string) => Promise<void> } }).clipboard;
    if (clip && typeof clip.writeText === 'function') {
      clip.writeText(text).then(
        () => { this.shareState = 'copied'; },
        () => { this.shareState = 'failed'; },
      );
    } else {
      this.shareState = 'failed';
    }
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

    ctx.textAlign = 'center';
    ctx.fillStyle = BALANCE.accentGreen;
    ctx.font = 'bold 46px ui-monospace, Menlo, monospace';
    ctx.fillText('LEVEL COMPLETE', W / 2, 90);

    const card = { x: W / 2 - 300, y: 120, w: 600, h: 360 };
    ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    drawAvatar(ctx, W / 2, card.y + 58, 36, this.profile.login);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b949e';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillText('YOU HAVE DEFEATED', W / 2, card.y + 114);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 24px ui-monospace, Menlo, monospace';
    ctx.fillText(`@${this.profile.login}`, W / 2, card.y + 142);

    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(
      `score ${this.score.toLocaleString()}  ·  ${this.profile.totalCommits.toLocaleString()} commits defeated`,
      W / 2, card.y + 160,
    );

    const commit = this.profile.biggestContribution;
    const commitY = card.y + 192;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText('THEIR BIGGEST CONTRIBUTION', card.x + 32, commitY);

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillText(`"${commit.message}"`, card.x + 32, commitY + 22);

    ctx.fillStyle = '#8b949e';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(
      `${commit.sha}  ${commit.date}`,
      card.x + 32, commitY + 44,
    );

    ctx.fillStyle = BALANCE.accentGreen;
    ctx.fillText(`+${commit.additions.toLocaleString()}`, card.x + 32, commitY + 64);
    ctx.fillStyle = BALANCE.accentRed;
    ctx.fillText(`-${commit.deletions.toLocaleString()}`, card.x + 100, commitY + 64);
    ctx.fillStyle = '#6e7681';
    ctx.fillText(`${commit.commits} commits that day`, card.x + 170, commitY + 64);

    const btnY = card.y + card.h - 56;
    drawButton(ctx, W / 2 - 170, btnY, 150, 36, 'SHARE  [S]', '#8b949e');
    drawButton(ctx, W / 2 + 20, btnY, 150, 36, `${this.nextLabel}  [ENTER]`, BALANCE.accentGreen);

    if (this.shareState === 'copied') {
      ctx.textAlign = 'center';
      ctx.fillStyle = BALANCE.accentGreen;
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillText('copied to clipboard', W / 2 - 95, btnY + 52);
    } else if (this.shareState === 'failed') {
      ctx.textAlign = 'center';
      ctx.fillStyle = BALANCE.accentRed;
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillText('clipboard unavailable', W / 2 - 95, btnY + 52);
    }

    this.renderer.endFrame();
  }
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, accent: string,
): void {
  ctx.fillStyle = 'rgba(13, 17, 23, 0.80)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = accent;
  ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function avatarColor(login: string): string {
  let h = 2166136261;
  for (let i = 0; i < login.length; i++) {
    h ^= login.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `hsl(${h % 360}, 55%, 48%)`;
}

function drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, login: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = avatarColor(login);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#30363d';
  ctx.stroke();
  ctx.fillStyle = '#0d1117';
  ctx.font = 'bold 36px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((login[0] ?? '?').toUpperCase(), cx, cy + 1);
  ctx.restore();
}
