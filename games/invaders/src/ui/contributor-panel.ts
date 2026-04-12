import type { ContributorProfile } from '../data/contributor-profile.js';
import { isTouchDevice } from './touch-detect.js';

export interface KillStats {
  defeated: number;
  total: number;
}

const PANEL_X = 20;
const PANEL_Y = 96;
const PANEL_W = 360;
const PANEL_H = 472;
const PAD_X = 22;
const PAD_Y = 20;
const CONTENT_X = PANEL_X + PAD_X;
const CONTENT_W = PANEL_W - PAD_X * 2;

const M_PANEL_W = 200;
const M_PANEL_H = 180;
const M_PAD_X = 12;
const M_CONTENT_X = PANEL_X + M_PAD_X;
const M_CONTENT_W = M_PANEL_W - M_PAD_X * 2;

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

function avatarColor(login: string): string {
  let h = 2166136261;
  for (let i = 0; i < login.length; i++) {
    h ^= login.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = h % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function drawAvatar(
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
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#30363d';
    ctx.stroke();
  } else {
    ctx.fillStyle = avatarColor(login);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#30363d';
    ctx.stroke();
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((login[0] ?? '?').toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
}

function drawStatRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  accent = '#c9d1d9',
): void {
  ctx.textAlign = 'left';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#6e7681';
  ctx.fillText(label, x, y);
  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.fillStyle = accent;
  ctx.fillText(value, x, y + 15);
}

function drawWeekdayBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  weekdayCounts: number[],
): void {
  ctx.save();
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const max = Math.max(1, ...weekdayCounts);
  const gap = 4;
  const barW = (width - gap * 6) / 7;
  for (let i = 0; i < 7; i++) {
    const v = weekdayCounts[i] ?? 0;
    const h = Math.round((v / max) * height);
    const bx = x + i * (barW + gap);
    const by = y + (height - h);
    ctx.fillStyle = '#21262d';
    ctx.fillRect(bx, y, barW, height);
    ctx.fillStyle = v > 0 ? '#26a641' : '#30363d';
    ctx.fillRect(bx, by, barW, h);
    ctx.fillStyle = '#6e7681';
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i]!, bx + barW / 2, y + height + 11);
  }
  ctx.restore();
}

export function drawContributorPanel(
  ctx: CanvasRenderingContext2D,
  profile: ContributorProfile,
  kills: KillStats,
): void {
  if (isTouchDevice()) {
    drawContributorPanelMobile(ctx, profile, kills);
    return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(22, 27, 34, 0.70)';
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

  let y = PANEL_Y + PAD_Y + 4;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('TARGET  // git blame', CONTENT_X, y);

  drawAvatar(ctx, CONTENT_X + 22, y + 36, 22, profile.login, profile.avatarImage);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9d1d9';
  ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
  const loginLabel = truncate(ctx, `@${profile.login}`, CONTENT_W - 56);
  ctx.fillText(loginLabel, CONTENT_X + 56, y + 34);
  ctx.fillStyle = '#8b949e';
  ctx.font = '11px ui-monospace, Menlo, monospace';
  const bioLines = wrap(ctx, profile.bio, CONTENT_W - 56, 2);
  for (let i = 0; i < bioLines.length; i++) {
    ctx.fillText(bioLines[i]!, CONTENT_X + 56, y + 52 + i * 14);
  }

  y += 86;
  ctx.fillStyle = '#8b949e';
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.fillText(truncate(ctx, profile.location, CONTENT_W), CONTENT_X, y);
  y += 16;
  ctx.fillStyle = '#6e7681';
  ctx.fillText(
    `joined ${profile.joinedYear}  ·  ${profile.publicRepos} repos  ·  ${profile.followers.toLocaleString()} followers`,
    CONTENT_X, y,
  );

  const col1 = CONTENT_X;
  const col2 = CONTENT_X + Math.floor(CONTENT_W / 2);
  y += 24;

  drawStatRow(ctx, col1, y, 'TOTAL COMMITS',
    profile.totalCommits.toLocaleString(), '#39d353');
  drawStatRow(ctx, col2, y, 'ACTIVE DAYS',
    `${profile.activeDays} / 365`);
  y += 36;
  drawStatRow(ctx, col1, y, 'LONGEST STREAK',
    `${profile.longestStreak}d`);
  drawStatRow(ctx, col2, y, 'CURRENT STREAK',
    `${profile.currentStreak}d`, profile.currentStreak > 7 ? '#ffa657' : '#c9d1d9');
  y += 36;
  drawStatRow(ctx, col1, y, 'BEST DAY',
    `${profile.bestDay.count} commits`);
  drawStatRow(ctx, col2, y, 'PEAK WEEKDAY',
    profile.mostActiveWeekday);
  y += 36;
  drawStatRow(ctx, col1, y, 'TOP LANGUAGE', profile.topLanguage, '#58a6ff');

  y += 34;
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('COMMITS BY WEEKDAY', col1, y);
  drawWeekdayBars(ctx, col1, y + 6, CONTENT_W, 36, profile.weekdayCounts);

  y += 64;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('KILL COUNT', col1, y);

  const pct = kills.total > 0 ? kills.defeated / kills.total : 0;
  const barW = CONTENT_W;
  const barY = y + 8;
  ctx.fillStyle = '#21262d';
  ctx.fillRect(col1, barY, barW, 8);
  ctx.fillStyle = '#f85149';
  ctx.fillRect(col1, barY, Math.round(barW * pct), 8);

  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'left';
  ctx.fillText(`${kills.defeated} / ${kills.total} defeated`, col1, barY + 22);
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(pct * 100)}%`, col1 + CONTENT_W, barY + 22);

  ctx.restore();
}

function drawContributorPanelMobile(
  ctx: CanvasRenderingContext2D,
  profile: ContributorProfile,
  kills: KillStats,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(22, 27, 34, 0.70)';
  ctx.fillRect(PANEL_X, PANEL_Y, M_PANEL_W, M_PANEL_H);
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X, PANEL_Y, M_PANEL_W, M_PANEL_H);

  let y = PANEL_Y + 14;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  drawAvatar(ctx, M_CONTENT_X + 14, y + 18, 14, profile.login, profile.avatarImage);

  ctx.fillStyle = '#c9d1d9';
  ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
  ctx.fillText(truncate(ctx, `@${profile.login}`, M_CONTENT_W - 38), M_CONTENT_X + 36, y + 16);
  ctx.fillStyle = '#6e7681';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(truncate(ctx, profile.bio, M_CONTENT_W - 38), M_CONTENT_X + 36, y + 30);

  y += 50;
  drawStatRow(ctx, M_CONTENT_X, y, 'COMMITS', profile.totalCommits.toLocaleString(), '#39d353');
  drawStatRow(ctx, M_CONTENT_X + Math.floor(M_CONTENT_W / 2), y, 'STREAK', `${profile.longestStreak}d`);

  y += 42;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('KILL COUNT', M_CONTENT_X, y);

  const pct = kills.total > 0 ? kills.defeated / kills.total : 0;
  const barY = y + 8;
  ctx.fillStyle = '#21262d';
  ctx.fillRect(M_CONTENT_X, barY, M_CONTENT_W, 6);
  ctx.fillStyle = '#f85149';
  ctx.fillRect(M_CONTENT_X, barY, Math.round(M_CONTENT_W * pct), 6);

  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'left';
  ctx.fillText(`${kills.defeated}/${kills.total}`, M_CONTENT_X, barY + 18);
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(pct * 100)}%`, M_CONTENT_X + M_CONTENT_W, barY + 18);

  ctx.restore();
}
