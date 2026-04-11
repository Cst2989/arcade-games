const BASE = 'https://api.github.com';
const TOKEN_KEY = 'osi:gh-token';
const CACHE_PREFIX = 'osi:cache:';

export class GitHubRateLimitError extends Error {
  constructor() {
    super('GitHub API rate limit exceeded');
    this.name = 'GitHubRateLimitError';
  }
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  topics?: string[];
  language: string | null;
  stargazers_count: number;
  default_branch: string;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  contributions: number;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  bio: string | null;
  location: string | null;
  followers: number;
  public_repos: number;
  created_at: string;
  company: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: { date: string } | null;
    message: string;
  };
  author: { login: string } | null;
}

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  html_url: string;
  prerelease: boolean;
}

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') throw new GitHubRateLimitError();
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}

export async function getRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return gh(`/repos/${owner}/${repo}`);
}

export async function getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
  return gh(`/repos/${owner}/${repo}/contributors?per_page=30`);
}

export async function getUser(login: string): Promise<GitHubUser> {
  return gh(`/users/${login}`);
}

export async function getCommitsForAuthor(
  owner: string,
  repo: string,
  login: string,
  sinceIso: string,
): Promise<GitHubCommit[]> {
  const out: GitHubCommit[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<GitHubCommit[]>(
      `/repos/${owner}/${repo}/commits?author=${encodeURIComponent(login)}&since=${sinceIso}&per_page=100&page=${page}`,
    );
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

function decodeBase64Content(content: string): string {
  const clean = content.replace(/\n/g, '');
  const binary = atob(clean);
  try {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return binary;
  }
}

export async function getReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
  return gh(`/repos/${owner}/${repo}/releases?per_page=30`);
}

export async function getReadme(owner: string, repo: string): Promise<string> {
  const data = await gh<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`);
  return data.encoding === 'base64' ? decodeBase64Content(data.content) : data.content;
}

export async function tryGetFile(
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const data = await gh<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}`,
    );
    return data.encoding === 'base64' ? decodeBase64Content(data.content) : data.content;
  } catch {
    return null;
  }
}

// --- session cache ---

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full — ignore
  }
}

export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await fetcher();
  cacheSet(key, value);
  return value;
}
