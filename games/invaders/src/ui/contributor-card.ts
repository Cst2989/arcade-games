import { BALANCE } from '../config/balance.js';

export interface ContributorCardData {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  rank: number;
}

export function drawContributorCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  data: ContributorCardData,
  avatarImg: HTMLImageElement | null,
): void {
  const w = 340;
  const h = 380;
  ctx.save();
  ctx.fillStyle = BALANCE.bgAlt;
  ctx.strokeStyle = BALANCE.accentCyan;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 110, 70, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, x + w / 2 - 70, y + 40, 140, 140);
    ctx.restore();
  } else {
    ctx.fillStyle = '#30363d';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 110, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = BALANCE.accentCyan;
  ctx.font = 'bold 24px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`@${data.login}`, x + w / 2, y + 220);
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`rank #${data.rank}`, x + w / 2, y + 244);
  ctx.fillStyle = BALANCE.accentGreen;
  ctx.font = '18px ui-monospace, Menlo, monospace';
  ctx.fillText(`${data.totalCommits} commits`, x + w / 2, y + 278);
  ctx.restore();
}
