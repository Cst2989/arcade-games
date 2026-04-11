import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';

export function drawFadeOverlay(r: Renderer, alpha: number): void {
  if (alpha <= 0) return;
  const ctx = r.main;
  ctx.save();
  ctx.fillStyle = `rgba(13, 17, 23, ${Math.min(1, alpha)})`;
  ctx.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
  ctx.restore();
}
