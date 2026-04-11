import { expect, test } from 'vitest';
import { Camera } from '../../src/render/camera.js';

test('worldToScreen respects pan', () => {
  const cam = new Camera();
  cam.x = 100;
  cam.y = 50;
  const s = cam.worldToScreen(150, 80);
  expect(s).toEqual({ x: 50, y: 30 });
});

test('shakeOffset applies to output', () => {
  const cam = new Camera();
  cam.shakeOffsetX = 4;
  cam.shakeOffsetY = -2;
  const s = cam.worldToScreen(0, 0);
  expect(s).toEqual({ x: 4, y: -2 });
});

test('pan and shake compose additively with negatives', () => {
  const cam = new Camera();
  cam.x = -20;
  cam.y = 30;
  cam.shakeOffsetX = 5;
  cam.shakeOffsetY = -7;
  const s = cam.worldToScreen(10, 10);
  expect(s).toEqual({ x: 10 - -20 + 5, y: 10 - 30 + -7 });
});

test('apply translates ctx and restore unwinds the save', () => {
  const calls: Array<[string, ...unknown[]]> = [];
  const ctx = {
    save: () => calls.push(['save']),
    translate: (x: number, y: number) => calls.push(['translate', x, y]),
    restore: () => calls.push(['restore']),
  } as unknown as CanvasRenderingContext2D;
  const cam = new Camera();
  cam.x = 10;
  cam.y = 20;
  cam.shakeOffsetX = 3;
  cam.shakeOffsetY = -4;
  cam.apply(ctx);
  cam.restore(ctx);
  expect(calls).toEqual([
    ['save'],
    ['translate', -10 + 3, -20 + -4],
    ['restore'],
  ]);
});
