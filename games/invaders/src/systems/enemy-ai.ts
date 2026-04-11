import type { GameContext } from '../scenes/gameplay-context.js';
import { Enemy, Position, Velocity, Bullet, SpriteRef, Collider } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { randRange } from '@osi/engine';

export function enemyAiSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  const chaosFireBoost = ctx.state.chaosActive?.kind === 'CI_FAILED' ? 1.2 : 1;
  const chaosSlow = ctx.state.chaosActive?.kind === 'REBASE' ? BALANCE.powerupRebaseSlow : 1;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const [, pos] of world.query(Position, Enemy)) {
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
  }
  const marchKey = '_osi_marchDir';
  const anyCtx = ctx as unknown as Record<string, unknown>;
  let direction: 1 | -1 = 1;
  if (typeof anyCtx[marchKey] === 'number') {
    direction = anyCtx[marchKey] as 1 | -1;
  } else {
    anyCtx[marchKey] = 1;
  }
  let flip = false;
  if (direction === 1 && maxX > BALANCE.viewportWidth - 40) flip = true;
  if (direction === -1 && minX < 40) flip = true;
  if (flip) {
    direction = (direction === 1 ? -1 : 1) as 1 | -1;
    anyCtx[marchKey] = direction;
  }

  for (const [e, pos, en] of world.query(Position, Enemy)) {
    const vel = world.get(e, Velocity) ?? { vx: 0, vy: 0 };
    vel.vx = direction * BALANCE.enemyMarchSpeed * chaosSlow;
    vel.vy = flip ? BALANCE.enemyDropDistance / dt : 0;
    world.add(e, Velocity, vel);

    en.fireAccumulator += dt * chaosSlow * chaosFireBoost;
    const period = 1 / en.fireRate;
    if (en.fireAccumulator >= period) {
      en.fireAccumulator = 0;
      if (Math.random() < 0.1) {
        const b = world.spawn();
        const jitter = randRange(-BALANCE.enemyBulletJitter, BALANCE.enemyBulletJitter);
        world.add(b, Position, { x: pos.x, y: pos.y + 10 });
        world.add(b, Velocity, { vx: jitter * 60, vy: BALANCE.enemyBulletSpeed });
        world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
        world.add(b, Collider, { w: 6, h: 14 });
        world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 0.6 });
      }
    }
  }
}
