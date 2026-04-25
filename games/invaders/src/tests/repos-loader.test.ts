import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadIndex, type RepoIndex } from '../data/repos-loader.js';

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
