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

export function repoFileToLevels(repo: RepoFile): { levels: Level[]; ranks: number[] } {
  if (repo.contributors.length < 5) {
    throw new Error(`repo ${repo.owner}/${repo.name} has at least 5 contributors required, got ${repo.contributors.length}`);
  }
  // The per-repo JSON stores contributors weakest-first (rank #5 → rank #1).
  // Levels[0] = weakest, levels[N-1] = boss; this matches what main.ts expected
  // from the old loadRealRepo path.
  const five = repo.contributors.slice(0, 5);
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
    return contributorToLevel(
      stats,
      { id: c.login, login: c.login, name: c.login },
      idx,
      { user, language: repo.language },
    );
  });
  const ranks = five.map((_, idx) => five.length - idx); // [5, 4, 3, 2, 1]
  return { levels, ranks };
}
