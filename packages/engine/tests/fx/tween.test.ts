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

test('loop tween never fires onComplete', () => {
  const obj = { x: 0 };
  const fn = vi.fn();
  const t = new Tween(obj, { x: 10 }, {
    duration: 1,
    easing: Easing.linear,
    loop: true,
    onComplete: fn,
  });
  t.update(5);
  expect(fn).not.toHaveBeenCalled();
  expect(t.done).toBe(false);
});

test('update is a no-op after done', () => {
  const obj = { x: 0 };
  const t = new Tween(obj, { x: 10 }, { duration: 1, easing: Easing.linear });
  t.update(2); // completes, snaps to 10
  obj.x = 99;
  t.update(1);
  expect(obj.x).toBe(99);
});

test('multi-key tween interpolates each field independently', () => {
  const obj = { x: 0, y: 100 };
  const t = new Tween(obj, { x: 10, y: 50 }, { duration: 1, easing: Easing.linear });
  t.update(0.5);
  expect(obj.x).toBeCloseTo(5);
  expect(obj.y).toBeCloseTo(75);
});
