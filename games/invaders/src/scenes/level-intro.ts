import { Scene } from '@osi/engine';
import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { ContributorProfile } from '../data/contributor-profile.js';

export class LevelIntroScene extends Scene {
  private elapsed = 0;
  private fired = false;

  constructor(
    private renderer: Renderer,
    private levelIndex: number,
    private rank: number,
    private profile: ContributorProfile,
    private isBossLevel: boolean,
    private onLaunch: () => void,
  ) {
    super();
  }

  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  override update(dt: number): void {
    this.elapsed += dt;
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.elapsed < 0.25 || this.fired) return;
    if (e.key === ' ' || e.key === 'Enter') {
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

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.isBossLevel ? '#f85149' : BALANCE.accentCyan;
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
    const heading = this.isBossLevel ? 'FINAL BOSS' : `LEVEL ${this.levelIndex + 1}`;
    ctx.fillText(heading, 40, 52);

    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(`rank #${this.rank} · git blame target`, 40, 72);

    const leftX = 40;
    const leftY = 96;
    const leftW = 360;
    const leftH = 416;

    ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
    ctx.fillRect(leftX, leftY, leftW, leftH);
    ctx.strokeStyle = '#30363d';
    ctx.strokeRect(leftX, leftY, leftW, leftH);

    drawBigAvatar(ctx, leftX + leftW / 2, leftY + 110, 72, this.profile.login, this.profile.avatarImage);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
    const login = truncate(ctx, `@${this.profile.login}`, leftW - 40);
    ctx.fillText(login, leftX + leftW / 2, leftY + 220);

    ctx.fillStyle = this.isBossLevel ? '#ffa657' : '#8b949e';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(
      this.isBossLevel ? 'the most active committer this year' : `rank #${this.rank} by recent commits`,
      leftX + leftW / 2,
      leftY + 240,
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    const bioLines = wrap(ctx, this.profile.bio || '—', leftW - 48, 3);
    for (let i = 0; i < bioLines.length; i++) {
      ctx.fillText(bioLines[i]!, leftX + 24, leftY + 280 + i * 18);
    }

    const metaY = leftY + 280 + bioLines.length * 18 + 20;
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    const locText = truncate(ctx, this.profile.location || 'unknown', leftW - 60);
    ctx.fillText(`📍 ${locText}`, leftX + 24, metaY);
    ctx.fillText(
      `📅 joined ${this.profile.joinedYear}  ·  ${this.profile.publicRepos} repos`,
      leftX + 24, metaY + 16,
    );
    ctx.fillText(
      `👥 ${this.profile.followers.toLocaleString()} followers  ·  ${this.profile.topLanguage}`,
      leftX + 24, metaY + 32,
    );

    const rightX = 420;
    const rightY = 96;
    const rightW = 500;
    const rightH = 416;
    const padX = 26;
    const contentW = rightW - padX * 2;

    ctx.fillStyle = BALANCE.bgAlt;
    ctx.fillRect(rightX, rightY, rightW, rightH);
    ctx.strokeStyle = '#30363d';
    ctx.strokeRect(rightX, rightY, rightW, rightH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6e7681';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText('DOSSIER  //  last 12 months', rightX + padX, rightY + 26);

    const statX = rightX + padX;
    let y = rightY + 56;

    drawBigStat(ctx, statX, y, 'total commits', this.profile.totalCommits.toLocaleString(), BALANCE.accentGreen);
    drawBigStat(ctx, statX + 240, y, 'active days', `${this.profile.activeDays} / 365`);
    y += 58;

    drawBigStat(ctx, statX, y, 'longest streak', `${this.profile.longestStreak} days`);
    drawBigStat(ctx, statX + 240, y, 'best day', `${this.profile.bestDay.count} commits`);
    y += 58;

    drawBigStat(ctx, statX, y, 'peak weekday', this.profile.mostActiveWeekday, '#58a6ff');
    drawBigStat(ctx, statX + 240, y, 'current streak',
      `${this.profile.currentStreak}d`,
      this.profile.currentStreak > 7 ? '#ffa657' : '#c9d1d9');
    y += 50;

    ctx.strokeStyle = '#21262d';
    ctx.beginPath();
    ctx.moveTo(statX, y);
    ctx.lineTo(rightX + rightW - padX, y);
    ctx.stroke();
    y += 18;

    const commit = this.profile.biggestContribution;
    ctx.fillStyle = '#6e7681';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(`BIGGEST COMMIT  ·  ${commit.date}`, statX, y);
    y += 18;

    ctx.fillStyle = '#c9d1d9';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    const msgLines = wrap(ctx, `"${commit.message}"`, contentW, 3);
    for (let i = 0; i < msgLines.length; i++) {
      ctx.fillText(msgLines[i]!, statX, y + i * 18);
    }
    y += msgLines.length * 18 + 6;

    ctx.fillStyle = '#6e7681';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(`${commit.sha}  ·  ${commit.commits} commits that day`, statX, y);

    const btnW = 300;
    const btnH = 48;
    const btnX = W / 2 - btnW / 2;
    const btnY = H - btnH - 20;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3);
    const bgColor = this.isBossLevel ? '#da3633' : '#238636';
    const borderColor = this.isBossLevel ? '#f85149' : '#2ea043';

    ctx.fillStyle = bgColor;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + 0.08 * pulse})`;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    const prompt = this.isBossLevel ? 'PRESS SPACE TO CONFRONT' : 'PRESS SPACE TO ENGAGE';
    ctx.fillText(prompt, W / 2, btnY + btnH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    this.renderer.endFrame();
  }
}

function drawBigStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  color = '#c9d1d9',
): void {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6e7681';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = color;
  ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
  ctx.fillText(value, x, y + 28);
}

function drawBigAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  login: string,
  image?: HTMLImageElement,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#30363d';
    ctx.stroke();
  } else {
    let h = 2166136261;
    for (let i = 0; i < login.length; i++) {
      h ^= login.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    ctx.fillStyle = `hsl(${h % 360}, 55%, 48%)`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#30363d';
    ctx.stroke();
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 64px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((login[0] ?? '?').toUpperCase(), cx, cy + 2);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW) {
      if (line) lines.push(line);
      if (lines.length === maxLines - 1) {
        let tail = words.slice(i).join(' ');
        while (tail.length > 0 && ctx.measureText(tail + '…').width > maxW) {
          tail = tail.slice(0, -1);
        }
        lines.push(tail + '…');
        return lines;
      }
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
