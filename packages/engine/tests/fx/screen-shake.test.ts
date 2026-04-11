import { expect, test } from 'vitest';
import { ScreenShake } from '../../src/fx/screen-shake.js';

test('single shake decays to zero', () => {
  const s = new ScreenShake({ maxAmplitude: 20 });
  s.add({ amplitude: 10, duration: 0.1 });
  for (let i = 0; i < 20; i++) s.update(0.01);
  expect(Math.abs(s.offsetX)).toBeLessThan(0.0001);
  expect(Math.abs(s.offsetY)).toBeLessThan(0.0001);
});

test('stacked shakes add offsets but cap at maxAmplitude', () => {
  const s = new ScreenShake({ maxAmplitude: 5 });
  for (let i = 0; i < 10; i++) s.add({ amplitude: 10, duration: 1 });
  s.update(0.016);
  expect(Math.abs(s.offsetX)).toBeLessThanOrEqual(5 + 1e-6);
  expect(Math.abs(s.offsetY)).toBeLessThanOrEqual(5 + 1e-6);
});

test('zero duration removes shake immediately', () => {
  const s = new ScreenShake({ maxAmplitude: 20 });
  s.add({ amplitude: 5, duration: 0 });
  s.update(0.016);
  expect(s.activeCount()).toBe(0);
});

test('quadratic decay shrinks amplitude well below peak before expiry', () => {
  // At 95% of duration, decay² = 0.0025, so offset must stay under 1% of amp.
  const s = new ScreenShake({ maxAmplitude: 100 });
  s.add({ amplitude: 50, duration: 1 });
  for (let i = 0; i < 95; i++) s.update(0.01);
  expect(s.activeCount()).toBe(1);
  expect(Math.abs(s.offsetX)).toBeLessThan(0.5);
  expect(Math.abs(s.offsetY)).toBeLessThan(0.5);
});
