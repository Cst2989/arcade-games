import { expect, test } from 'vitest';
import { clamp, lerp, randRange } from '../../src/util/math.js';
import { Vec2 } from '../../src/util/vec2.js';
import { Rect } from '../../src/util/rect.js';

test('clamp bounds value', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(11, 0, 10)).toBe(10);
});

test('lerp interpolates', () => {
  expect(lerp(0, 10, 0)).toBe(0);
  expect(lerp(0, 10, 1)).toBe(10);
  expect(lerp(0, 10, 0.5)).toBe(5);
});

test('randRange stays in bounds', () => {
  for (let i = 0; i < 100; i++) {
    const v = randRange(5, 10);
    expect(v).toBeGreaterThanOrEqual(5);
    expect(v).toBeLessThan(10);
  }
});

test('Vec2 add/scale', () => {
  const a = new Vec2(1, 2);
  const b = new Vec2(3, 4);
  a.add(b);
  expect(a.x).toBe(4);
  expect(a.y).toBe(6);
  a.scale(2);
  expect(a.x).toBe(8);
  expect(a.y).toBe(12);
});

test('Rect AABB intersect', () => {
  const a = new Rect(0, 0, 10, 10);
  const b = new Rect(5, 5, 10, 10);
  const c = new Rect(100, 100, 1, 1);
  expect(a.intersects(b)).toBe(true);
  expect(a.intersects(c)).toBe(false);
});
