import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Position, Bullet, Velocity, Collider, SpriteRef } from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function playerControlSystem(dt: number, ctx: GameContext): void {
  const { world, input, sfx } = ctx;
  const fireBoost = ctx.state.chaosActive?.kind === 'MAIN_GREEN' ? 2 : 1;
  for (const [e, p] of world.query(Player)) {
    p.fireCooldown = Math.max(0, p.fireCooldown - dt * fireBoost);
    if (input.isDown('fire') && p.fireCooldown <= 0) {
      const pos = world.get(e, Position)!;
      const spread = p.shotsMultiplier;
      const pierceNext = (ctx as unknown as Record<string, unknown>)._osi_nextShotPierce === true;
      for (let i = 0; i < spread; i++) {
        const offset = (i - (spread - 1) / 2) * 14;
        const b = world.spawn();
        world.add(b, Position, { x: pos.x + offset, y: pos.y - 20 });
        world.add(b, Velocity, { vx: 0, vy: -BALANCE.playerBulletSpeed });
        world.add(b, Bullet, { fromPlayer: true, damage: pierceNext ? 3 : 1, pierce: pierceNext });
        world.add(b, Collider, { w: 6, h: 14 });
        world.add(b, SpriteRef, { name: 'laserBlue01.png', scale: 0.6 });
      }
      if (pierceNext) {
        (ctx as unknown as Record<string, unknown>)._osi_nextShotPierce = false;
      }
      p.fireCooldown = BALANCE.playerFireCooldown;
      sfx.play('shoot', { pitch: 0.95 + Math.random() * 0.1 });
    }
    if (input.wasPressed('bomb') && p.bombsLeft > 0) {
      p.bombsLeft -= 1;
    }
  }
}
