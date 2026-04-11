import type { GameContext } from '../scenes/gameplay-context.js';
import { Enemy, Position, Velocity, Bullet, Collider, SpriteRef } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { randRange } from '@osi/engine';

export function enemyAiSystem(dt: number, ctx: GameContext): void {
  const { world, sfx } = ctx;
  const chaosFireBoost = ctx.state.chaosActive?.kind === 'CI_FAILED' ? 1.2 : 1;
  const chaosSlow = ctx.state.chaosActive?.kind === 'REBASE' ? BALANCE.powerupRebaseSlow : 1;

  for (const [e, pos, en] of world.query(Position, Enemy)) {
    const vel = world.get(e, Velocity);
    if (vel) {
      vel.vx = 0;
      vel.vy = 0;
    }

    en.fireAccumulator += dt * chaosSlow * chaosFireBoost;
    const period = 1 / en.fireRate;
    if (en.fireAccumulator >= period) {
      en.fireAccumulator = 0;
      if (Math.random() < 0.08) {
        const b = world.spawn();
        const jitter = randRange(-BALANCE.enemyBulletJitter, BALANCE.enemyBulletJitter);
        world.add(b, Position, { x: pos.x, y: pos.y + 10 });
        world.add(b, Velocity, { vx: jitter * 60, vy: BALANCE.enemyBulletSpeed });
        world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
        world.add(b, Collider, { w: 6, h: 16 });
        world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 0.6 });
        sfx.play('enemy_shoot', { volume: 0.4, pitch: 0.9 + Math.random() * 0.2 });
      }
    }
  }
}
