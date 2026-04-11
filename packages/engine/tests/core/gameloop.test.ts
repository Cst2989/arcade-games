import { expect, test, vi } from 'vitest';
import { GameLoop } from '../../src/core/gameloop.js';

test('fixed step accumulates and fires update at fixed dt', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  const updates: number[] = [];
  loop.onUpdate = (dt) => updates.push(dt);
  loop.tick(0);
  loop.tick(16.67);
  loop.tick(33.34);
  expect(updates.length).toBeGreaterThanOrEqual(2);
  for (const dt of updates) expect(dt).toBeCloseTo(1 / 60, 5);
});

test('timeScale scales update dt', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  loop.timeScale = 0;
  const updates: number[] = [];
  loop.onUpdate = (dt) => updates.push(dt);
  loop.tick(0);
  loop.tick(100);
  for (const dt of updates) expect(dt).toBe(0);
});

test('maxStepsPerFrame caps catch-up', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 3 });
  const fn = vi.fn();
  loop.onUpdate = fn;
  loop.tick(0);
  loop.tick(10_000); // huge gap
  expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
});

test('render fires once per tick with interpolation alpha in [0,1]', () => {
  const loop = new GameLoop({ fixedDt: 1 / 60, maxStepsPerFrame: 5 });
  const alphas: number[] = [];
  loop.onRender = (a) => alphas.push(a);
  loop.tick(0);
  loop.tick(10);
  loop.tick(25);
  for (const a of alphas) {
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  }
});
