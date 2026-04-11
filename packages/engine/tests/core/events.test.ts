import { expect, test, vi } from 'vitest';
import { EventBus } from '../../src/core/events.js';

type Events = {
  hit: { dmg: number };
  death: { id: number };
};

test('subscribe, emit, unsubscribe', () => {
  const bus = new EventBus<Events>();
  const fn = vi.fn();
  const off = bus.on('hit', fn);
  bus.emit('hit', { dmg: 5 });
  expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  off();
  bus.emit('hit', { dmg: 99 });
  expect(fn).toHaveBeenCalledTimes(1);
});

test('multiple listeners fire in registration order', () => {
  const bus = new EventBus<Events>();
  const calls: number[] = [];
  bus.on('death', () => calls.push(1));
  bus.on('death', () => calls.push(2));
  bus.on('death', () => calls.push(3));
  bus.emit('death', { id: 7 });
  expect(calls).toEqual([1, 2, 3]);
});

test('clear removes all listeners', () => {
  const bus = new EventBus<Events>();
  const fn = vi.fn();
  bus.on('hit', fn);
  bus.clear();
  bus.emit('hit', { dmg: 1 });
  expect(fn).not.toHaveBeenCalled();
});
