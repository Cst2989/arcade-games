import type { RepoIndexEntry } from '../data/repos-loader.js';

const PANEL_ID = 'osi-leaderboard';
const STYLE_ID = 'osi-leaderboard-style';

interface LeaderboardEntry {
  login: string;
  avatarPath: string;
  repoCount: number;
  totalCommits: number;
  bossCount: number;
}

const STYLE_CSS = `
#osi-leaderboard {
  position: fixed;
  inset: 0;
  z-index: 130;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(13, 17, 23, 0.85);
  backdrop-filter: blur(4px);
  font-family: ui-monospace, Menlo, monospace;
  color: #ffffff;
  animation: osi-lb-fade 0.2s ease-out;
}
@keyframes osi-lb-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
#osi-leaderboard .osi-lb-card {
  background: #161b22;
  border: 2px solid #d29922;
  box-shadow: 0 0 40px rgba(210, 153, 34, 0.30), 0 20px 60px rgba(0, 0, 0, 0.7);
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
#osi-leaderboard .osi-lb-header {
  padding: 14px 20px;
  background: linear-gradient(90deg, rgba(210, 153, 34, 0.18), rgba(210, 153, 34, 0));
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#osi-leaderboard h2 {
  margin: 0;
  font-size: 16px;
  color: #ffd24a;
  letter-spacing: 0.4px;
}
#osi-leaderboard .osi-lb-subtitle {
  margin-top: 4px;
  font-size: 11px;
  color: #ffffff;
  letter-spacing: 0.2px;
}
#osi-leaderboard .osi-lb-close {
  background: transparent;
  color: #ffffff;
  border: 1px solid #30363d;
  padding: 4px 10px;
  font: bold 11px ui-monospace, Menlo, monospace;
  cursor: pointer;
}
#osi-leaderboard .osi-lb-close:hover { border-color: #58a6ff; }
#osi-leaderboard .osi-lb-list {
  overflow-y: auto;
  padding: 4px 8px 12px;
}
#osi-leaderboard .osi-lb-row {
  display: grid;
  grid-template-columns: 38px 44px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #21262d;
}
#osi-leaderboard .osi-lb-row:last-child { border-bottom: none; }
#osi-leaderboard .osi-lb-row:hover { background: #1c2129; }
#osi-leaderboard .osi-lb-rank {
  font: bold 14px ui-monospace, Menlo, monospace;
  color: #ffffff;
  text-align: right;
}
#osi-leaderboard .osi-lb-row.gold .osi-lb-rank { color: #ffd24a; }
#osi-leaderboard .osi-lb-row.silver .osi-lb-rank { color: #c9d1d9; }
#osi-leaderboard .osi-lb-row.bronze .osi-lb-rank { color: #cd7f32; }
#osi-leaderboard .osi-lb-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #21262d;
  border: 1px solid #30363d;
  object-fit: cover;
  display: block;
}
#osi-leaderboard .osi-lb-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
#osi-leaderboard .osi-lb-login {
  font: bold 13px ui-monospace, Menlo, monospace;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#osi-leaderboard .osi-lb-meta {
  font-size: 11px;
  color: #ffffff;
}
#osi-leaderboard .osi-lb-bossbadge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 9px;
  color: #0d1117;
  background: #d29922;
  vertical-align: middle;
}
#osi-leaderboard .osi-lb-stats {
  font: 11px ui-monospace, Menlo, monospace;
  color: #ffffff;
  text-align: right;
  white-space: nowrap;
}
#osi-leaderboard .osi-lb-stats strong {
  color: #39d353;
  font-weight: bold;
}
#osi-leaderboard .osi-lb-link {
  font: bold 10px ui-monospace, Menlo, monospace;
  text-decoration: none;
  padding: 6px 10px;
  border: 1px solid #30363d;
  background: #21262d;
  color: #ffffff;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
#osi-leaderboard .osi-lb-link:hover {
  background: #30363d;
  border-color: #58a6ff;
}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = STYLE_CSS;
  document.head.append(s);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

export function buildLeaderboard(repos: RepoIndexEntry[], limit = 100): LeaderboardEntry[] {
  interface Acc {
    login: string;
    avatarPath: string;
    repos: Set<string>;
    totalCommits: number;
    bossCount: number;
  }
  const acc = new Map<string, Acc>();
  for (const repo of repos) {
    const key = `${repo.owner}/${repo.name}`;
    for (const c of repo.top5) {
      const existing = acc.get(c.login) ?? {
        login: c.login,
        avatarPath: c.avatarPath,
        repos: new Set<string>(),
        totalCommits: 0,
        bossCount: 0,
      };
      existing.repos.add(key);
      existing.totalCommits += c.contributions;
      if (c.isBoss) existing.bossCount += 1;
      acc.set(c.login, existing);
    }
  }
  return Array.from(acc.values())
    .map((a) => ({
      login: a.login,
      avatarPath: a.avatarPath,
      repoCount: a.repos.size,
      totalCommits: a.totalCommits,
      bossCount: a.bossCount,
    }))
    .sort((x, y) => y.repoCount - x.repoCount || y.totalCommits - x.totalCommits)
    .slice(0, limit);
}

export function mountLeaderboard(repos: RepoIndexEntry[]): void {
  ensureStyle();
  document.getElementById(PANEL_ID)?.remove();

  const entries = buildLeaderboard(repos, 100);
  const totalRepos = repos.length;

  const closeBtn = el('button', {
    type: 'button',
    className: 'osi-lb-close',
    textContent: '✕ CLOSE',
  });

  const headerTitle = el('div', {}, [
    el('h2', { textContent: '🏆 LEADERBOARD — TOP CONTRIBUTORS' }),
    el('div', {
      className: 'osi-lb-subtitle',
      textContent: `Across ${totalRepos} curated repos · ranked by repos active in`,
    }),
  ]);
  const header = el('div', { className: 'osi-lb-header' }, [headerTitle, closeBtn]);

  const list = el('div', { className: 'osi-lb-list' });
  const base = (path: string): string =>
    `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const rank = i + 1;
    const rankClass =
      rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
    const row = el('div', { className: `osi-lb-row${rankClass}` });

    const rankCell = el('div', { className: 'osi-lb-rank', textContent: `#${rank}` });
    const avatar = el('img', {
      className: 'osi-lb-avatar',
      alt: `${entry.login} avatar`,
    }) as HTMLImageElement;
    avatar.src = base(entry.avatarPath);
    avatar.onerror = () => {
      avatar.src = `https://github.com/${encodeURIComponent(entry.login)}.png?size=80`;
    };

    const info = el('div', { className: 'osi-lb-info' });
    const loginEl = el('div', { className: 'osi-lb-login' });
    loginEl.append(entry.login);
    if (entry.bossCount > 0) {
      const badge = el('span', {
        className: 'osi-lb-bossbadge',
        textContent: entry.bossCount > 1 ? `BOSS ×${entry.bossCount}` : 'BOSS',
      });
      loginEl.append(badge);
    }
    const meta = el('div', {
      className: 'osi-lb-meta',
      textContent: `${entry.totalCommits.toLocaleString()} commits across ${entry.repoCount} repo${entry.repoCount > 1 ? 's' : ''}`,
    });
    info.append(loginEl, meta);

    const stats = el('div', { className: 'osi-lb-stats' });
    const repoCountEl = el('strong', { textContent: String(entry.repoCount) });
    stats.append(repoCountEl, ` repo${entry.repoCount > 1 ? 's' : ''}`);

    const link = el('a', {
      className: 'osi-lb-link',
      href: `https://github.com/${encodeURIComponent(entry.login)}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: 'GITHUB →',
    });

    row.append(rankCell, avatar, info, stats, link);
    list.append(row);
  }

  const card = el('div', { className: 'osi-lb-card' }, [header, list]);
  const root = el('div', { id: PANEL_ID }, [card]);

  const close = (): void => {
    root.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      close();
    }
  };

  closeBtn.onclick = close;
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  window.addEventListener('keydown', onKey, true);

  document.body.append(root);
}

export function unmountLeaderboard(): void {
  document.getElementById(PANEL_ID)?.remove();
}

export function isLeaderboardOpen(): boolean {
  return document.getElementById(PANEL_ID) !== null;
}
