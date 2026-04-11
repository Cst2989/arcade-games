import type { ContributorStats } from './contributor-stats.js';

export interface BiggestContribution {
  date: string;
  message: string;
  sha: string;
  additions: number;
  deletions: number;
  commits: number;
}

export interface ContributorProfile {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  longestStreak: number;
  currentStreak: number;
  bestDay: { date: string; count: number };
  mostActiveWeekday: string;
  activeDays: number;
  weekdayCounts: number[];
  location: string;
  followers: number;
  publicRepos: number;
  topLanguage: string;
  joinedYear: number;
  bio: string;
  biggestContribution: BiggestContribution;
}

const LOCATIONS = [
  'San Francisco, CA',
  'Brooklyn, NY',
  'Berlin, DE',
  'Tokyo, JP',
  'London, UK',
  'Lisbon, PT',
  'Remote',
  'Vancouver, CA',
];

const LANGUAGES = [
  'TypeScript', 'Go', 'Rust', 'Python', 'Ruby', 'C++', 'Elixir', 'Haskell', 'Swift',
];

const BIOS = [
  'ships it · breaks it · fixes it',
  'static types enthusiast · former rubyist',
  'compiler nerd · distributed systems',
  'write code, drink coffee, repeat',
  'ex-monolith · current microservices skeptic',
  '10x engineer (10x more bugs)',
  'author of three libraries you have never heard of',
  'CI red? i was just about to fix that',
];

const COMMIT_POOL = [
  'rewrite the parser again, this time for real',
  'feat: add streaming mode (closes #1923)',
  'refactor: extract 4000 lines into its own package',
  'fix: off-by-one in the Y2038 countdown',
  'perf: stop allocating on the hot path',
  'docs: finally explain how any of this works',
  'chore: delete 6 years of dead code',
  'feat: zero-copy codec for the binary format',
  'fix: race condition that only happens on Tuesdays',
  'refactor: move from events to streams, sorry',
  "revert 'revert revert of the revert'",
  'feat: make it 3x faster (no benchmarks yet)',
  'fix: handle unicode in repo names properly',
  'chore: bump minimum node to something sane',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function computeContributorProfile(
  stats: ContributorStats,
  login: string,
): ContributorProfile {
  const daily = stats.daily;

  let longest = 0;
  let running = 0;
  let currentStreak = 0;
  let currentStreakActive = true;
  let activeDays = 0;
  let best = { date: daily[0]?.date ?? '', count: 0 };
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < daily.length; i++) {
    const d = daily[i]!;
    if (d.count > 0) {
      running += 1;
      activeDays += 1;
      if (running > longest) longest = running;
      if (d.count > best.count) best = { date: d.date, count: d.count };
    } else {
      running = 0;
    }
    const dt = new Date(d.date);
    const wd = dt.getUTCDay();
    weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + d.count;
  }

  // Current streak = trailing run from the most recent day.
  for (let i = daily.length - 1; i >= 0; i--) {
    if (!currentStreakActive) break;
    if ((daily[i]?.count ?? 0) > 0) currentStreak += 1;
    else currentStreakActive = false;
  }

  let mostActiveIdx = 0;
  for (let i = 1; i < weekdayCounts.length; i++) {
    if ((weekdayCounts[i] ?? 0) > (weekdayCounts[mostActiveIdx] ?? 0)) mostActiveIdx = i;
  }

  const seed = hashString(login);
  const pick = <T,>(arr: readonly T[], offset: number): T =>
    arr[(seed + offset) % arr.length]!;

  const shaChars = '0123456789abcdef';
  let sha = '';
  for (let i = 0; i < 7; i++) {
    sha += shaChars[(seed >>> (i * 4)) % 16]!;
  }
  const bestCount = Math.max(1, best.count);
  const biggestContribution: BiggestContribution = {
    date: best.date,
    message: pick(COMMIT_POOL, 37),
    sha,
    additions: bestCount * (40 + ((seed >>> 5) % 160)),
    deletions: bestCount * (10 + ((seed >>> 9) % 70)),
    commits: best.count,
  };

  return {
    login,
    avatarUrl: stats.avatarUrl,
    totalCommits: stats.totalCommits,
    longestStreak: longest,
    currentStreak,
    bestDay: best,
    mostActiveWeekday: WEEKDAYS[mostActiveIdx]!,
    activeDays,
    weekdayCounts,
    location: pick(LOCATIONS, 0),
    followers: 120 + ((seed >>> 3) % 9000),
    publicRepos: 12 + ((seed >>> 7) % 180),
    topLanguage: pick(LANGUAGES, 11),
    joinedYear: 2008 + ((seed >>> 11) % 13),
    bio: pick(BIOS, 23),
    biggestContribution,
  };
}
