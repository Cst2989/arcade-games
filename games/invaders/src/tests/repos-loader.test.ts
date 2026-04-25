import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadIndex, type RepoIndex } from '../data/repos-loader.js';
import { loadRepo, repoFileToLevels, type RepoFile } from '../data/repos-loader.js';

const FIXTURE: RepoIndex = {
  generatedAt: '2026-04-25T10:30:00Z',
  repos: [
    {
      owner: 'facebook',
      name: 'react',
      language: 'JavaScript',
      description: 'A library.',
      totalContributions: 12345,
      top5: [
        { login: 'gaearon', avatarPath: 'avatars/gaearon.png', contributions: 4000, isBoss: true },
      ],
    },
  ],
};

describe('loadIndex', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns the index JSON on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => FIXTURE,
    } as Response);
    const result = await loadIndex();
    expect(result.repos[0]?.owner).toBe('facebook');
    expect(result.repos[0]?.top5[0]?.isBoss).toBe(true);
  });

  it('throws a descriptive error when fetch returns non-OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    await expect(loadIndex()).rejects.toThrow(/404/);
  });

  it('throws when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(loadIndex()).rejects.toThrow(/network down/);
  });
});

const REPO_FIXTURE: RepoFile = {
  owner: 'facebook',
  name: 'react',
  language: 'JavaScript',
  contributors: [
    {
      login: 'kassens',
      avatarPath: 'avatars/kassens.png',
      totalCommits: 100,
      daily: Array.from({ length: 365 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        count: i % 5,
      })),
      biggestCommit: { sha: 'abc1234', date: '2025-04-01', message: 'big change', commitsThatDay: 4 },
      profile: { location: 'Berlin', followers: 100, publicRepos: 20, joinedYear: 2014, bio: 'hi' },
    },
    {
      login: 'gaearon',
      avatarPath: 'avatars/gaearon.png',
      totalCommits: 500,
      daily: Array.from({ length: 365 }, (_, i) => ({
        date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        count: (i % 4) + 1,
      })),
      biggestCommit: { sha: 'def5678', date: '2025-05-15', message: 'huge refactor', commitsThatDay: 12 },
      profile: { location: 'SF', followers: 9000, publicRepos: 50, joinedYear: 2010, bio: 'react' },
    },
  ],
};

describe('loadRepo', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('fetches the per-repo JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => REPO_FIXTURE,
    } as Response);
    const result = await loadRepo('facebook', 'react');
    expect(result.contributors).toHaveLength(2);
    expect(result.contributors[1]?.login).toBe('gaearon');
  });

  it('builds the URL with owner__name format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPO_FIXTURE } as Response);
    globalThis.fetch = fetchMock;
    await loadRepo('facebook', 'react');
    const url = fetchMock.mock.calls[0]?.[0];
    expect(String(url)).toMatch(/data\/repos\/facebook__react\.json$/);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadRepo('foo', 'bar')).rejects.toThrow(/404/);
  });
});

describe('repoFileToLevels', () => {
  it('returns 5 levels worst-first when given a repo with multiple contributors', () => {
    const big: RepoFile = {
      ...REPO_FIXTURE,
      contributors: Array.from({ length: 5 }, (_, i) => ({
        ...REPO_FIXTURE.contributors[0]!,
        login: `user${i + 1}`,
      })),
    };
    const { levels, ranks } = repoFileToLevels(big);
    expect(levels).toHaveLength(5);
    expect(ranks).toEqual([5, 4, 3, 2, 1]);
    expect(levels[0]?.contributor.login).toBe('user1');
    expect(levels[4]?.contributor.login).toBe('user5');
  });

  it('preserves daily commit data on the level profile', () => {
    const big: RepoFile = {
      ...REPO_FIXTURE,
      contributors: Array.from({ length: 5 }, (_, i) => ({
        ...REPO_FIXTURE.contributors[0]!,
        login: `user${i + 1}`,
      })),
    };
    const { levels } = repoFileToLevels(big);
    expect(levels[0]?.profile.totalCommits).toBe(100);
    expect(levels[0]?.profile.location).toBe('Berlin');
  });

  it('throws if the repo has fewer than 5 contributors', () => {
    expect(() => repoFileToLevels(REPO_FIXTURE)).toThrow(/at least 5/);
  });
});
