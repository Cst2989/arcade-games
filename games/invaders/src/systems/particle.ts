import type { GameContext } from '../scenes/gameplay-context.js';

export function particleSystem(dt: number, ctx: GameContext): void {
  ctx.particles.sparks.update(dt);
  ctx.particles.explosions.update(dt);
  ctx.particles.bigExplosions.update(dt);
  ctx.particles.stars.update(dt);
  ctx.particles.powerupDust.update(dt);
}
