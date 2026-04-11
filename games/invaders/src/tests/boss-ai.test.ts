import { expect, test } from 'vitest';
import { advanceBossPhase } from '../systems/boss-ai.js';

test('phase 1 → 2 when hp drops below threshold', () => {
  expect(advanceBossPhase({ phase: 1, hp: 250 })).toBe(1);
  expect(advanceBossPhase({ phase: 1, hp: 199 })).toBe(2);
  expect(advanceBossPhase({ phase: 1, hp: 150 })).toBe(2);
});

test('phase 2 → 3 only when drones=0', () => {
  expect(advanceBossPhase({ phase: 2, dronesAlive: 2 })).toBe(2);
  expect(advanceBossPhase({ phase: 2, dronesAlive: 0 })).toBe(3);
});

test('phase 3 persists until hp<=0', () => {
  expect(advanceBossPhase({ phase: 3, hp: 50 })).toBe(3);
  expect(advanceBossPhase({ phase: 3, hp: 0 })).toBe(3);
});
