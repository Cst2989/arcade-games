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
