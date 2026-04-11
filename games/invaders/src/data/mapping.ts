import type { ContributorStats } from './contributor-stats.js';
import {
  computeContributorProfile,
  type ContributorProfile,
  type ProfileOverrides,
} from './contributor-profile.js';
import { BALANCE } from '../config/balance.js';

export interface EnemySpec {
  date: string;
  commits: number;
  hp: number;
  fireRate: number;
  color: string;
}

export interface Wave {
  weekStart: string;
  enemies: EnemySpec[];
}

export interface ContributorInfo {
  id: string;
  login: string;
  name: string;
}

export interface Level {
  contributor: ContributorInfo & { avatar?: string; totalCommits?: number };
  waves: Wave[];
  profile: ContributorProfile;
}

export function enemyFromCommits(commits: number, levelIndex: number): EnemySpec | null {
  if (commits <= 0) return null;
  const hpBase = commits <= 3 ? 1 : commits <= 6 ? 2 : commits <= 9 ? 3 : 4;
  const hpScaled = Math.ceil(hpBase * (1 + levelIndex * 0.25));
  const hp = Math.max(1, Math.min(6, hpScaled));
  const fireRate = (BALANCE.baseFireRate + commits * BALANCE.fireRatePerCommit) *
    (1 + levelIndex * BALANCE.levelDifficultyStep);
  return {
    date: '',
    commits,
    hp,
    fireRate,
    color: bucketColor(commits),
  };
}

function bucketColor(commits: number): string {
  if (commits <= 0) return '#161b22';
  if (commits <= 3) return '#0e4429';
  if (commits <= 6) return '#006d32';
  if (commits <= 9) return '#26a641';
  return '#39d353';
}

export function contributorToLevel(
  stats: ContributorStats,
  info: ContributorInfo,
  levelIndex: number,
  overrides: ProfileOverrides = {},
): Level {
  const waves: Wave[] = [];
  for (let w = 0; w < 52; w++) {
    const slice = stats.daily.slice(w * 7, w * 7 + 7);
    if (slice.length === 0) break;
    const enemies: EnemySpec[] = [];
    for (const day of slice) {
      const e = enemyFromCommits(day.count, levelIndex);
      if (e) enemies.push({ ...e, date: day.date });
    }
    if (enemies.length === 0) continue;
    waves.push({ weekStart: slice[0]!.date, enemies });
  }
  return {
    contributor: {
      ...info,
      avatar: overrides.user?.avatar_url ?? stats.avatarUrl,
      totalCommits: stats.totalCommits,
    },
    waves,
    profile: computeContributorProfile(stats, info.login, overrides),
  };
}
