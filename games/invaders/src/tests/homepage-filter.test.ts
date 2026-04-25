import { describe, it, expect } from 'vitest';
import { filterRepos, clampScroll, type FilterableRepo } from '../ui/homepage-filter.js';

const REPOS: FilterableRepo[] = [
  { owner: 'facebook', name: 'react' },
  { owner: 'vitejs', name: 'vite' },
  { owner: 'microsoft', name: 'TypeScript' },
  { owner: 'nodejs', name: 'node' },
  { owner: 'tanstack', name: 'query' },
];

describe('filterRepos', () => {
  it('returns all repos when query is empty', () => {
    expect(filterRepos(REPOS, '')).toEqual(REPOS);
  });

  it('returns all repos when query is whitespace only', () => {
    expect(filterRepos(REPOS, '   ')).toEqual(REPOS);
  });

  it('matches substring on owner', () => {
    const result = filterRepos(REPOS, 'face');
    expect(result.map((r) => r.name)).toEqual(['react']);
  });

  it('matches substring on name', () => {
    const result = filterRepos(REPOS, 'vit');
    expect(result.map((r) => r.owner)).toEqual(['vitejs']);
  });

  it('matches across the slash (owner/name)', () => {
    const result = filterRepos(REPOS, 'js/v');
    expect(result.map((r) => r.name)).toEqual(['vite']);
  });

  it('is case insensitive', () => {
    const result = filterRepos(REPOS, 'TYPESCRIPT');
    expect(result.map((r) => r.name)).toEqual(['TypeScript']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterRepos(REPOS, 'zzz')).toEqual([]);
  });
});

describe('clampScroll', () => {
  it('returns 0 when scroll is negative', () => {
    expect(clampScroll(-50, 1000, 600)).toBe(0);
  });

  it('returns the requested value when within bounds', () => {
    expect(clampScroll(120, 1000, 600)).toBe(120);
  });

  it('clamps to the maximum scroll position', () => {
    expect(clampScroll(900, 1000, 600)).toBe(400);
  });

  it('returns 0 when content fits in viewport', () => {
    expect(clampScroll(50, 400, 600)).toBe(0);
  });
});
