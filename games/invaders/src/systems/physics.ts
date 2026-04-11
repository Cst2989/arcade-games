import type { GameContext } from '../scenes/gameplay-context.js';
import { Position, Velocity, Bullet, Lifetime } from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function physicsSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  for (const [, pos, vel] of world.query(Position, Velocity)) {
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
  for (const [e, pos] of world.query(Position, Bullet)) {
    if (
      pos.y < -20 ||
      pos.y > BALANCE.viewportHeight + 20 ||
      pos.x < -20 ||
      pos.x > BALANCE.viewportWidth + 20
    ) {
      world.remove(e);
    }
  }
  for (const [e, l] of world.query(Lifetime)) {
    l.remaining -= dt;
    if (l.remaining <= 0) world.remove(e);
  }
}
