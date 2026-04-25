import { Scene } from '@osi/engine';
import type { Renderer, ParticleEmitter, AudioBus } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { loadIndex, type RepoIndex, type RepoIndexEntry } from '../data/repos-loader.js';
import { filterRepos, clampScroll } from '../ui/homepage-filter.js';
import { drawInvaderLogo } from '../ui/brand.js';
import { mountLeaderboard, unmountLeaderboard, isLeaderboardOpen } from '../ui/leaderboard-panel.js';

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 200;
const FOOTER_HEIGHT = 36;
const FILTER_INPUT_TOP = 168;
const FILTER_INPUT_HEIGHT = 26;
const VIEWPORT_TOP = HEADER_HEIGHT;
const VIEWPORT_HEIGHT = BALANCE.viewportHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
// Easter-egg trophy tucked in the bottom-right corner. No box, no label.
const TROPHY_BTN = { w: 32, h: 32, margin: 8 } as const;

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  'C++': '#f34b7d',
  Java: '#b07219',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
};

export class HomepageScene extends Scene {
  private index: RepoIndex | null = null;
  private filter = '';
  private scroll = 0;
  private avatars = new Map<string, HTMLImageElement>();
  private loadError: string | null = null;
  private focusIndex = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private elapsed = 0;

  constructor(
    private renderer: Renderer,
    private stars: ParticleEmitter,
    private onSelect: (repoFullName: string) => void,
    private audio: AudioBus,
    private touch: boolean,
  ) {
    super();
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      this.index = await loadIndex();
      const uniquePaths = new Set<string>();
      for (const repo of this.index.repos) {
        for (const entry of repo.top5) uniquePaths.add(entry.avatarPath);
      }
      const base = (path: string): string =>
        `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
      await Promise.all(
        Array.from(uniquePaths).map(
          (path) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                this.avatars.set(path, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = base(path);
            }),
        ),
      );
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'unknown error';
    }
  }

  override update(dt: number): void {
    this.stars.update(dt);
    this.elapsed += dt;
  }

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();

    const grad = ctx.createRadialGradient(W / 2, 60, 60, W / 2, 60, W * 0.7);
    grad.addColorStop(0, 'rgba(57, 211, 83, 0.10)');
    grad.addColorStop(1, 'rgba(13, 17, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.stars.render(ctx);

    const bob = Math.sin(this.elapsed * 1.6) * 4;
    drawInvaderLogo(ctx, W / 2, 40 + bob, 6);

    const titleY = 118;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const titlePulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2);
    ctx.fillStyle = `rgba(57, 211, 83, ${0.85 + 0.15 * titlePulse})`;
    ctx.font = 'bold 32px ui-monospace, Menlo, monospace';
    ctx.fillText('OPEN SOURCE INVADERS', W / 2, titleY);
    ctx.shadowColor = 'rgba(57, 211, 83, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText('OPEN SOURCE INVADERS', W / 2, titleY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillText('// pick your battle — any GitHub repo becomes an arcade fight', W / 2, titleY + 20);
    ctx.restore();

    // Easter-egg trophy in the bottom-right corner. Just the emoji, slightly faded.
    const tx = W - TROPHY_BTN.w - TROPHY_BTN.margin;
    const ty = H - TROPHY_BTN.h - TROPHY_BTN.margin;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px ui-monospace, Menlo, monospace';
    ctx.globalAlpha = 0.5;
    ctx.fillText('🏆', tx + TROPHY_BTN.w / 2, ty + TROPHY_BTN.h / 2);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const inputW = W - 240;
    const inputX = (W - inputW) / 2;
    ctx.fillStyle = 'rgba(13, 17, 23, 0.6)';
    ctx.fillRect(inputX, FILTER_INPUT_TOP, inputW, FILTER_INPUT_HEIGHT);
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2);
    ctx.strokeStyle = `rgba(57, 211, 83, ${0.45 + 0.25 * pulse})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(inputX + 0.5, FILTER_INPUT_TOP + 0.5, inputW - 1, FILTER_INPUT_HEIGHT - 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const filterText = this.filter.length > 0 ? this.filter : 'filter…';
    ctx.fillText(`>_ ${filterText}`, inputX + 10, FILTER_INPUT_TOP + 6);

    if (this.loadError) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No repos yet. Run scripts/fetch-repos.sh.', W / 2, H / 2 - 8);
      ctx.textAlign = 'left';
      this.renderer.endFrame();
      return;
    }
    if (!this.index) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('loading…', W / 2, H / 2);
      ctx.textAlign = 'left';
      this.renderer.endFrame();
      return;
    }

    const visibleRepos = filterRepos(this.index.repos, this.filter);
    const contentHeight = visibleRepos.length * ROW_HEIGHT;
    this.scroll = clampScroll(this.scroll, contentHeight, VIEWPORT_HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, VIEWPORT_TOP, W, VIEWPORT_HEIGHT);
    ctx.clip();
    for (let i = 0; i < visibleRepos.length; i++) {
      const repo = visibleRepos[i]!;
      const y = VIEWPORT_TOP + i * ROW_HEIGHT - this.scroll;
      if (y + ROW_HEIGHT < VIEWPORT_TOP) continue;
      if (y > VIEWPORT_TOP + VIEWPORT_HEIGHT) break;
      this.drawRow(repo, y, i === this.focusIndex);
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↑ ↓ scroll · ENTER launch · ESC clear filter', W / 2, H - 24);
    ctx.textAlign = 'left';

    this.renderer.endFrame();
  }

  private drawRow(repo: RepoIndexEntry, y: number, focused: boolean): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    if (focused) {
      ctx.fillStyle = 'rgba(57, 211, 83, 0.10)';
      ctx.fillRect(8, y + 4, W - 16, ROW_HEIGHT - 8);
      ctx.strokeStyle = '#39d353';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, y + 4, W - 16, ROW_HEIGHT - 8);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    ctx.fillText(`${repo.owner}/${repo.name}`, 24, y + 16);
    const langColor = LANGUAGE_COLORS[repo.language] ?? '#aaaaaa';
    const nameWidth = ctx.measureText(`${repo.owner}/${repo.name}`).width;
    ctx.fillStyle = langColor;
    ctx.beginPath();
    ctx.arc(24 + nameWidth + 16, y + 22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.fillText(repo.language, 24 + nameWidth + 28, y + 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillText(`${repo.totalContributions.toLocaleString()} commits last year`, 24, y + 44);

    const REGULAR = 32;
    const BOSS = 52;
    const GAP = 8;
    const totalWidth = REGULAR * 4 + BOSS + GAP * 4;
    const startX = W - 24 - totalWidth;
    const sortedTop5 = [...repo.top5].sort((a, b) => Number(a.isBoss) - Number(b.isBoss));
    let x = startX;
    for (const entry of sortedTop5) {
      const size = entry.isBoss ? BOSS : REGULAR;
      const cy = y + ROW_HEIGHT / 2;
      const img = this.avatars.get(entry.avatarPath);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, x, cy - size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = '#21262d';
        ctx.beginPath();
        ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(size * 0.5)}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((entry.login[0] ?? '?').toUpperCase(), x + size / 2, cy + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
      x += size + GAP;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.index) return;
    if (isLeaderboardOpen()) return;
    const visible = filterRepos(this.index.repos, this.filter);
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = visible[this.focusIndex];
      if (target) this.onSelect(`${target.owner}/${target.name}`);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.filter = '';
      this.focusIndex = 0;
      this.scroll = 0;
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (this.filter.length > 0) {
        this.filter = this.filter.slice(0, -1);
        this.focusIndex = 0;
        this.scroll = 0;
      }
      return;
    }
    if (e.key.length === 1 && /[\w./-]/.test(e.key) && this.filter.length < 40) {
      e.preventDefault();
      this.filter += e.key.toLowerCase();
      this.focusIndex = 0;
      this.scroll = 0;
      return;
    }
    if (visible.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      const step = e.key === 'PageDown' ? Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT) : 1;
      this.focusIndex = Math.min(visible.length - 1, this.focusIndex + step);
      this.ensureFocusVisible(visible.length);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      const step = e.key === 'PageUp' ? Math.floor(VIEWPORT_HEIGHT / ROW_HEIGHT) : 1;
      this.focusIndex = Math.max(0, this.focusIndex - step);
      this.ensureFocusVisible(visible.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.focusIndex = 0;
      this.scroll = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      this.focusIndex = visible.length - 1;
      this.scroll = clampScroll(visible.length * ROW_HEIGHT, visible.length * ROW_HEIGHT, VIEWPORT_HEIGHT);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.index) return;
    const visible = filterRepos(this.index.repos, this.filter);
    this.scroll = clampScroll(this.scroll + e.deltaY, visible.length * ROW_HEIGHT, VIEWPORT_HEIGHT);
  }

  private ensureFocusVisible(visibleCount: number): void {
    const focusY = this.focusIndex * ROW_HEIGHT;
    if (focusY < this.scroll) {
      this.scroll = focusY;
    } else if (focusY + ROW_HEIGHT > this.scroll + VIEWPORT_HEIGHT) {
      this.scroll = focusY + ROW_HEIGHT - VIEWPORT_HEIGHT;
    }
    this.scroll = clampScroll(this.scroll, visibleCount * ROW_HEIGHT, VIEWPORT_HEIGHT);
  }

  private onClick(e: MouseEvent): void {
    if (!this.index) return;
    const canvas = this.renderer.main.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = parseFloat(canvas.dataset.osiDpr ?? '') || (window.devicePixelRatio || 1);
    const scaleX = canvas.width / dpr / rect.width;
    const scaleY = canvas.height / dpr / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    // Trophy easter-egg hit-test (bottom-right).
    const tx = BALANCE.viewportWidth - TROPHY_BTN.w - TROPHY_BTN.margin;
    const ty = BALANCE.viewportHeight - TROPHY_BTN.h - TROPHY_BTN.margin;
    if (
      cx >= tx && cx <= tx + TROPHY_BTN.w &&
      cy >= ty && cy <= ty + TROPHY_BTN.h
    ) {
      mountLeaderboard(this.index.repos);
      return;
    }

    if (cy < VIEWPORT_TOP || cy > VIEWPORT_TOP + VIEWPORT_HEIGHT) return;
    if (cx < 0 || cx > BALANCE.viewportWidth) return;
    const visible = filterRepos(this.index.repos, this.filter);
    const i = Math.floor((cy - VIEWPORT_TOP + this.scroll) / ROW_HEIGHT);
    const target = visible[i];
    if (target) this.onSelect(`${target.owner}/${target.name}`);
  }

  override onEnter(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    this.wheelHandler = (e: WheelEvent) => this.onWheel(e);
    this.clickHandler = (e: MouseEvent) => this.onClick(e);
    window.addEventListener('keydown', this.keydownHandler);
    this.renderer.main.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    this.renderer.main.canvas.addEventListener('click', this.clickHandler);
  }

  override onExit(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.wheelHandler) {
      this.renderer.main.canvas.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    if (this.clickHandler) {
      this.renderer.main.canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    unmountLeaderboard();
  }
}
