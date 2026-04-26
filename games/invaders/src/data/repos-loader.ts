const BASE = import.meta.env.BASE_URL;
const dataUrl = (p: string): string => `${BASE}data/${p.replace(/^\/+/, '')}`;

export interface RepoIndexTop5Entry {
  login: string;
  avatarPath: string;
  contributions: number;
  isBoss: boolean;
}

export interface RepoIndexEntry {
  owner: string;
  name: string;
  language: string;
  description: string;
  totalContributions: number;
  top5: RepoIndexTop5Entry[];
}

export interface RepoIndex {
  generatedAt: string;
  repos: RepoIndexEntry[];
}

export async function loadIndex(): Promise<RepoIndex> {
  const res = await fetch(dataUrl('repos.json'));
  if (!res.ok) {
    throw new Error(`failed to load repos.json: HTTP ${res.status}`);
  }
  return (await res.json()) as RepoIndex;
}

import type { ContributorStats, DailyCommitCount, RealCommit } from './contributor-stats.js';
import type { ContributorUserOverride } from './contributor-profile.js';
import { contributorToLevel, type Level } from './mapping.js';

export interface RepoFileContributor {
  login: string;
  avatarPath: string;
  totalCommits: number;
  daily: DailyCommitCount[];
  biggestCommit: RealCommit;
  profile: {
    location: string;
    followers: number;
    publicRepos: number;
    joinedYear: number;
    bio: string;
  };
}

export interface RepoFile {
  owner: string;
  name: string;
  language: string;
  contributors: RepoFileContributor[];
}

export async function loadRepo(owner: string, name: string): Promise<RepoFile> {
  const res = await fetch(dataUrl(`repos/${owner}__${name}.json`));
  if (!res.ok) {
    throw new Error(`failed to load repo data ${owner}/${name}: HTTP ${res.status}`);
  }
  return (await res.json()) as RepoFile;
}

function avatarUrl(avatarPath: string): string {
  return `${BASE}${avatarPath.replace(/^\/+/, '')}`;
}

// Counts non-empty 7-day windows in a daily-commits array. Used to order
// levels so the contributor with the fewest active weeks goes first
// (easier — fewer waves to fight).
function countWaves(daily: DailyCommitCount[]): number {
  let count = 0;
  for (let w = 0; w < 52; w++) {
    const slice = daily.slice(w * 7, w * 7 + 7);
    if (slice.length === 0) break;
    if (slice.some((d) => d.count > 0)) count += 1;
  }
  return count;
}

function loadAvatarImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function repoFileToLevels(
  repo: RepoFile,
): Promise<{ levels: Level[]; ranks: number[] }> {
  if (repo.contributors.length < 5) {
    throw new Error(`repo ${repo.owner}/${repo.name} has at least 5 contributors required, got ${repo.contributors.length}`);
  }
  // Order: ascending by number of waves (= weeks with at least one commit).
  // Tiebreak by ascending total commits. So levels[0] is the easiest fight
  // (fewest weeks of activity) and levels[N-1] = boss is the most prolific.
  const sorted = [...repo.contributors].sort((a, b) => {
    const wa = countWaves(a.daily);
    const wb = countWaves(b.daily);
    if (wa !== wb) return wa - wb;
    return a.totalCommits - b.totalCommits;
  });
  const five = sorted.slice(0, 5);

  // Pre-load avatar images so in-game scenes (LevelIntro, ContributorPanel,
  // LevelComplete) can draw real avatars instead of initial-letter fallbacks.
  const avatarImages = await Promise.all(
    five.map((c) => loadAvatarImage(avatarUrl(c.avatarPath))),
  );

  const levels: Level[] = five.map((c, idx) => {
    const stats: ContributorStats = {
      login: c.login,
      avatarUrl: avatarUrl(c.avatarPath),
      totalCommits: c.totalCommits,
      daily: c.daily,
      biggestCommit: c.biggestCommit,
    };
    const user: ContributorUserOverride = {
      avatar_url: avatarUrl(c.avatarPath),
      location: c.profile.location,
      followers: c.profile.followers,
      public_repos: c.profile.publicRepos,
      created_at: `${c.profile.joinedYear}-01-01T00:00:00Z`,
      bio: c.profile.bio,
    };
    const overrides = avatarImages[idx]
      ? { user, language: repo.language, avatarImage: avatarImages[idx]! }
      : { user, language: repo.language };
    return contributorToLevel(
      stats,
      { id: c.login, login: c.login, name: c.login },
      idx,
      overrides,
    );
  });
  const ranks = five.map((_, idx) => five.length - idx); // [5, 4, 3, 2, 1]
  return { levels, ranks };
}
