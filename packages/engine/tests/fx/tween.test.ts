import { expect, test, vi } from 'vitest';
import { Tween, Easing } from '../../src/fx/tween.js';

test('linear tween interpolates and completes', () => {
  const obj = { x: 0 };
  const t = new Tween(obj, { x: 10 }, { duration: 1, easing: Easing.linear });
  t.update(0.5);
  expect(obj.x).toBe(5);
  t.update(0.5);
  expect(obj.x).toBe(10);
  expect(t.done).toBe(true);
});

test('onComplete fires once', () => {
  const obj = { x: 0 };
  const fn = vi.fn();
  const t = new Tween(obj, { x: 1 }, { duration: 0.1, easing: Easing.linear, onComplete: fn });
  t.update(1);
  t.update(1);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('loop resets progress and re-interpolates', () => {
  const obj = { x: 0 };
  const t = new Tween(obj, { x: 10 }, { duration: 1, easing: Easing.linear, loop: true });
  t.update(1.5);
  expect(obj.x).toBeCloseTo(5);
  expect(t.done).toBe(false);
});

test('easeOutQuad is monotonic', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 10; i++) {
    const v = Easing.easeOutQuad(i / 10);
    expect(v).toBeGreaterThanOrEqual(prev);
    prev = v;
  }
});
