import type { GitHubCommit } from './github-client.js';

export interface DailyCommitCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface RealCommit {
  sha: string;
  date: string;
  message: string;
  commitsThatDay: number;
}

export interface ContributorStats {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  daily: DailyCommitCount[]; // 365 entries, oldest first
  biggestCommit?: RealCommit;
}

export function pickBiggestCommit(commits: GitHubCommit[]): RealCommit | undefined {
  if (commits.length === 0) return undefined;
  const perDay = new Map<string, GitHubCommit[]>();
  for (const c of commits) {
    const iso = c.commit.author?.date;
    if (!iso) continue;
    const day = iso.slice(0, 10);
    const bucket = perDay.get(day);
    if (bucket) bucket.push(c);
    else perDay.set(day, [c]);
  }
  let bestDay: { date: string; list: GitHubCommit[] } | null = null;
  for (const [date, list] of perDay) {
    if (!bestDay || list.length > bestDay.list.length) bestDay = { date, list };
  }
  if (!bestDay) return undefined;
  const chosen = [...bestDay.list].sort(
    (a, b) => (b.commit.message?.length ?? 0) - (a.commit.message?.length ?? 0),
  )[0]!;
  const firstLine = (chosen.commit.message ?? '').split('\n')[0]!.trim();
  return {
    sha: chosen.sha.slice(0, 7),
    date: bestDay.date,
    message: firstLine || '(no message)',
    commitsThatDay: bestDay.list.length,
  };
}

export function aggregateDaily(commits: GitHubCommit[]): DailyCommitCount[] {
  const map = new Map<string, number>();
  for (const c of commits) {
    const iso = c.commit.author?.date;
    if (!iso) continue;
    const day = iso.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  const out: DailyCommitCount[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, count: map.get(iso) ?? 0 });
  }
  return out;
}
