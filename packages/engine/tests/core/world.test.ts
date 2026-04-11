import { expect, test } from 'vitest';
import { World, defineComponent } from '../../src/core/world.js';

const Position = defineComponent<{ x: number; y: number }>('Position');
const Velocity = defineComponent<{ vx: number; vy: number }>('Velocity');

test('spawn returns unique ids', () => {
  const w = new World();
  const a = w.spawn();
  const b = w.spawn();
  expect(a).not.toBe(b);
});

test('add + get component', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 1, y: 2 });
  const p = w.get(e, Position);
  expect(p).toEqual({ x: 1, y: 2 });
});

test('query yields only entities with all listed components', () => {
  const w = new World();
  const e1 = w.spawn();
  const e2 = w.spawn();
  const e3 = w.spawn();
  w.add(e1, Position, { x: 0, y: 0 });
  w.add(e1, Velocity, { vx: 1, vy: 1 });
  w.add(e2, Position, { x: 5, y: 5 });
  w.add(e3, Velocity, { vx: 2, vy: 2 });

  const results: number[] = [];
  for (const [id] of w.query(Position, Velocity)) results.push(id);
  expect(results).toEqual([e1]);
});

test('remove deletes entity and its components', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 0, y: 0 });
  w.remove(e);
  expect(w.get(e, Position)).toBeUndefined();
  const ids: number[] = [];
  for (const [id] of w.query(Position)) ids.push(id);
  expect(ids).not.toContain(e);
});

test('removeComponent removes single component only', () => {
  const w = new World();
  const e = w.spawn();
  w.add(e, Position, { x: 0, y: 0 });
  w.add(e, Velocity, { vx: 1, vy: 0 });
  w.removeComponent(e, Velocity);
  expect(w.get(e, Position)).toBeDefined();
  expect(w.get(e, Velocity)).toBeUndefined();
});
