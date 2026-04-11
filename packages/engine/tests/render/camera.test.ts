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
