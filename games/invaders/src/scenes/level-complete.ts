import { Scene } from '@osi/engine';
import type { Renderer, Sfx } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { ContributorProfile } from '../data/contributor-profile.js';

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

const CONFETTI_COLORS = ['#39d353', '#26a641', '#006d32', '#58a6ff', '#d29922', '#a371f7', '#f85149', '#ffa657'];

type BtnKey = 'x' | 'bsky' | 'next';
type Rect = { x: number; y: number; w: number; h: number };
type ShareState = 'idle' | 'shared-x' | 'shared-bsky' | 'failed';

const X_BG = '#000000';
const BSKY_BG = '#0085FF';
const NEXT_BG = '#238636';

export class LevelCompleteScene extends Scene {
  private shareState: ShareState = 'idle';
  private nextPressed = false;
  private confetti: Confetto[] = [];
  private spawnTimer = 0;
  private elapsed = 0;
  private hover: BtnKey | null = null;
  private mouseX = -1;
  private mouseY = -1;

  constructor(
    private renderer: Renderer,
    private profile: ContributorProfile,
    private score: number,
    private nextLabel: string,
    private sfx: Sfx,
    private levelIndex: number,
    private repoFullName: string,
    private onNext: () => void,
  ) {
    super();
  }

  override onEnter(): void {
    window.addEventListener('keydown', this.onKey);
    const canvas = this.renderer.main.canvas;
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.sfx.play('level_complete', { volume: 0.9 });
    this.spawnBurst(60);
  }

  override onExit(): void {
    window.removeEventListener('keydown', this.onKey);
    const canvas = this.renderer.main.canvas;
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mouseleave', this.onMouseLeave);
    canvas.style.cursor = '';
  }

  override update(dt: number): void {
    this.elapsed += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer >= 0.35 && this.elapsed < 4) {
      this.spawnTimer = 0;
      this.spawnBurst(24);
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
      const vx = (fromLeft ? 1 : -1) * (120 + Math.random() * 160);
      const vy = -40 - Math.random() * 120;
      this.confetti.push({
        x, y, vx, vy,
        size: 4 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        life: 2.4 + Math.random() * 1.2,
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

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      this.triggerNext();
    } else if (e.key === 't' || e.key === 'T') {
      this.shareOn('x');
    } else if (e.key === 'b' || e.key === 'B') {
      this.shareOn('bsky');
    }
  };

  private triggerNext(): void {
    if (this.nextPressed) return;
    this.nextPressed = true;
    this.onNext();
  }

  private onMouseMove = (e: MouseEvent) => {
    const canvas = this.renderer.main.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
    this.hover = this.hitTest(this.mouseX, this.mouseY);
    canvas.style.cursor = this.hover ? 'pointer' : '';
  };

  private onMouseLeave = () => {
    this.hover = null;
    this.mouseX = -1;
    this.mouseY = -1;
    this.renderer.main.canvas.style.cursor = '';
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const key = this.hitTest(this.mouseX, this.mouseY);
    if (!key) return;
    if (key === 'x') this.shareOn('x');
    else if (key === 'bsky') this.shareOn('bsky');
    else this.triggerNext();
  };

  private hitTest(x: number, y: number): BtnKey | null {
    const rects = this.buttonRects();
    for (const k of ['x', 'bsky', 'next'] as const) {
      const r = rects[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
    }
    return null;
  }

  private buttonRects(): Record<BtnKey, Rect> {
    const W = BALANCE.viewportWidth;
    const btnY = 120 + 360 - 56;
    const btnW = 140;
    const btnH = 36;
    const gap = 14;
    const totalW = btnW * 3 + gap * 2;
    const startX = W / 2 - totalW / 2;
    return {
      x:    { x: startX + 0 * (btnW + gap), y: btnY, w: btnW, h: btnH },
      bsky: { x: startX + 1 * (btnW + gap), y: btnY, w: btnW, h: btnH },
      next: { x: startX + 2 * (btnW + gap), y: btnY, w: btnW, h: btnH },
    };
  }

  private buildShareText(): { text: string; url: string } {
    const rank = this.levelIndex + 1;
    const login = this.profile.login;
    const repo = this.repoFullName;
    const flavors: string[] = [
      `Just took down @${login}, the #1 committer of ${repo}, in Open Source Invaders 💥`,
      `Dropped @${login} (#2 committer of ${repo}) in Open Source Invaders 🔥`,
      `Halfway there — @${login} (#3 of ${repo}) eliminated in Open Source Invaders ⚔️`,
      `@${login} (#4 of ${repo}) cleared. One wave left before the boss in Open Source Invaders!`,
      `Five levels down — @${login} (#5 of ${repo}) defeated. Boss fight incoming 🚀`,
    ];
    const flavor = flavors[this.levelIndex] ?? flavors[flavors.length - 1]!;
    const cta = rank < flavors.length
      ? 'Can you do better and reach the final boss?'
      : 'Think you can beat the final boss?';
    const text = `${flavor} ${cta}`;
    const url = `https://neciudan.dev/?repo=${encodeURIComponent(repo)}`;
    return { text, url };
  }

  private shareOn(platform: 'x' | 'bsky'): void {
    const { text, url } = this.buildShareText();
    let intent: string;
    if (platform === 'x') {
      intent =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` +
        `&url=${encodeURIComponent(url)}`;
    } else {
      const combined = `${text} ${url}`;
      intent = `https://bsky.app/intent/compose?text=${encodeURIComponent(combined)}`;
    }
    const win = window.open(intent, '_blank', 'noopener,noreferrer');
    if (win) {
      this.shareState = platform === 'x' ? 'shared-x' : 'shared-bsky';
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

    this.renderConfetti(ctx);

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

    const rects = this.buttonRects();
    drawBrandButton(ctx, rects.x, 'TWEET  [T]', X_BG, '#ffffff', 'x', this.hover === 'x');
    drawBrandButton(ctx, rects.bsky, 'POST  [B]', BSKY_BG, '#ffffff', 'bsky', this.hover === 'bsky');
    drawBrandButton(ctx, rects.next, `${this.nextLabel}  [↵]`, NEXT_BG, '#ffffff', null, this.hover === 'next');

    const toastY = rects.x.y + rects.x.h + 20;
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    if (this.shareState === 'shared-x') {
      ctx.fillStyle = '#c9d1d9';
      ctx.fillText('opened X in a new tab — go post it!', W / 2, toastY);
    } else if (this.shareState === 'shared-bsky') {
      ctx.fillStyle = BSKY_BG;
      ctx.fillText('opened Bluesky in a new tab — go post it!', W / 2, toastY);
    } else if (this.shareState === 'failed') {
      ctx.fillStyle = BALANCE.accentRed;
      ctx.fillText('popup blocked — allow popups for this site', W / 2, toastY);
    }

    this.renderer.endFrame();
  }
}

function drawBrandButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  bg: string,
  fg: string,
  icon: 'x' | 'bsky' | null,
  hovered: boolean,
): void {
  const { x, y, w, h } = rect;
  ctx.save();

  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  if (hovered) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  const iconCx = x + 22;
  const iconCy = y + h / 2;
  if (icon === 'x') drawXLogo(ctx, iconCx, iconCy, 8, fg);
  else if (icon === 'bsky') drawBlueskyLogo(ctx, iconCx, iconCy, 10, fg);

  ctx.fillStyle = fg;
  ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelCx = icon ? x + w / 2 + 12 : x + w / 2;
  ctx.fillText(label, labelCx, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';

  ctx.restore();
}

function drawXLogo(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r);
  ctx.lineTo(cx + r, cy + r);
  ctx.moveTo(cx + r, cy - r);
  ctx.lineTo(cx - r, cy + r);
  ctx.stroke();
  ctx.restore();
}

function drawBlueskyLogo(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.15);
  ctx.bezierCurveTo(
    cx - r * 1.35, cy - r * 1.05,
    cx - r * 1.35, cy + r * 0.55,
    cx - r * 0.05, cy + r * 0.25,
  );
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.15);
  ctx.bezierCurveTo(
    cx + r * 1.35, cy - r * 1.05,
    cx + r * 1.35, cy + r * 0.55,
    cx + r * 0.05, cy + r * 0.25,
  );
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.18, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
