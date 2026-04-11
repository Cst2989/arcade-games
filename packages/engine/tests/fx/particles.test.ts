import { expect, test } from 'vitest';
import { ParticleEmitter } from '../../src/fx/particles.js';

test('pool respects capacity, spawns are rejected when full', () => {
  const p = new ParticleEmitter({ capacity: 4 });
  for (let i = 0; i < 10; i++) p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  expect(p.aliveCount()).toBe(4);
});

test('particles decrement life and recycle when dead', () => {
  const p = new ParticleEmitter({ capacity: 3 });
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 0.05 });
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  p.update(0.1);
  expect(p.aliveCount()).toBe(1);
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
  expect(p.aliveCount()).toBe(2);
});

test('update integrates velocity into position', () => {
  const p = new ParticleEmitter({ capacity: 1 });
  p.spawn({ x: 0, y: 0, vx: 10, vy: -5, life: 1 });
  p.update(0.5);
  const [x, y] = p.debugFirst();
  expect(x).toBeCloseTo(5);
  expect(y).toBeCloseTo(-2.5);
});

test('spawn returns false when pool is full', () => {
  const p = new ParticleEmitter({ capacity: 2 });
  expect(p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 })).toBe(true);
  expect(p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 })).toBe(true);
  expect(p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 })).toBe(false);
  expect(p.aliveCount()).toBe(2);
});

test('recycled slot holds the new particle, not the dead one', () => {
  const p = new ParticleEmitter({ capacity: 1 });
  p.spawn({ x: 99, y: 99, vx: 0, vy: 0, life: 0.05 });
  p.update(0.1); // kills the first particle
  expect(p.aliveCount()).toBe(0);
  p.spawn({ x: 7, y: 3, vx: 0, vy: 0, life: 1 });
  const [x, y] = p.debugFirst();
  expect(x).toBeCloseTo(7);
  expect(y).toBeCloseTo(3);
});

test('gravity accumulates into vy across steps (semi-implicit Euler)', () => {
  const p = new ParticleEmitter({ capacity: 1, gravity: 10 });
  p.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 10 });
  // Step 1: position uses vy=0, then vy becomes 10*1 = 10.
  p.update(1);
  let [, y] = p.debugFirst();
  expect(y).toBeCloseTo(0);
  // Step 2: position uses vy=10, so y = 0 + 10*1 = 10.
  p.update(1);
  [, y] = p.debugFirst();
  expect(y).toBeCloseTo(10);
});
