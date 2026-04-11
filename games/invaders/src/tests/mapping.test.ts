import { expect, test } from 'vitest';
import { contributorToLevel, enemyFromCommits } from '../data/mapping.js';
import type { ContributorStats } from '../data/contributor-stats.js';

test('0 commits produces no enemy', () => {
  expect(enemyFromCommits(0, 0)).toBeNull();
});

test('enemy hp scales with level index', () => {
  const e1 = enemyFromCommits(4, 0)!;
  const e2 = enemyFromCommits(4, 4)!;
  expect(e2.hp).toBeGreaterThan(e1.hp);
  expect(e1.hp).toBeGreaterThanOrEqual(1);
});

test('enemy color buckets match contribution graph scale', () => {
  expect(enemyFromCommits(0, 0)).toBeNull();
  expect(enemyFromCommits(1, 0)!.color).toBe('#0e4429');
  expect(enemyFromCommits(5, 0)!.color).toBe('#006d32');
  expect(enemyFromCommits(8, 0)!.color).toBe('#26a641');
  expect(enemyFromCommits(25, 0)!.color).toBe('#39d353');
});

test('contributorToLevel produces 52 weeks of waves', () => {
  const stats: ContributorStats = {
    login: 'octocat',
    avatarUrl: 'https://example/avatar.png',
    totalCommits: 100,
    daily: Array.from({ length: 365 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      count: i % 5,
    })),
  };
  const level = contributorToLevel(stats, { id: 'octocat', login: 'octocat', name: 'octocat' }, 2);
  expect(level.waves.length).toBe(52);
  for (const w of level.waves) expect(w.enemies.length).toBeLessThanOrEqual(7);
});
