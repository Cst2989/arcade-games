export interface DailyCommitCount {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface ContributorStats {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  daily: DailyCommitCount[]; // 365 entries, oldest first
}
