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
