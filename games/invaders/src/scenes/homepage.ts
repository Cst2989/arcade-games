import { Scene } from '@osi/engine';
import type { Renderer, ParticleEmitter, AudioBus } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import { loadIndex, type RepoIndex, type RepoIndexEntry } from '../data/repos-loader.js';
import { filterRepos, clampScroll } from '../ui/homepage-filter.js';

const ROW_HEIGHT = 80;
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 40;
const VIEWPORT_TOP = HEADER_HEIGHT;
const VIEWPORT_HEIGHT = BALANCE.viewportHeight - HEADER_HEIGHT - FOOTER_HEIGHT;

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
  }

  override render(): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
    const H = BALANCE.viewportHeight;
    this.renderer.beginFrame();
    this.stars.render(ctx);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('// pick your battle', 24, 24);

    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 50, W - 48, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px ui-monospace, Menlo, monospace';
    const filterText = this.filter.length > 0 ? this.filter : 'filter…';
    ctx.fillText(`>_ ${filterText}`, 32, 54);

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
      this.drawRow(repo, y);
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↑ ↓ scroll · ENTER launch · ESC clear filter', W / 2, H - 24);
    ctx.textAlign = 'left';

    this.renderer.endFrame();
  }

  private drawRow(repo: RepoIndexEntry, y: number): void {
    const ctx = this.renderer.main;
    const W = BALANCE.viewportWidth;
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

  override onEnter(): void {
    // Task 6 will attach keyboard/wheel listeners here.
  }

  override onExit(): void {
    // Task 6 will detach the listeners attached in onEnter.
  }
}
