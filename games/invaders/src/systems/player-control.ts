import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Position, Bullet, Velocity, Collider, SpriteRef, Enemy, Health } from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function playerControlSystem(dt: number, ctx: GameContext): void {
  const { world, input, sfx, particles, screenShake } = ctx;
  const fireBoost = ctx.state.chaosActive?.kind === 'MAIN_GREEN' ? 2 : 1;

  ctx.state.forkSeconds = Math.max(0, ctx.state.forkSeconds - dt);
  ctx.state.rebaseSeconds = Math.max(0, ctx.state.rebaseSeconds - dt);

  for (const [e, p] of world.query(Player)) {
    p.fireCooldown = Math.max(0, p.fireCooldown - dt * fireBoost);
    if (input.isDown('fire') && p.fireCooldown <= 0) {
      const pos = world.get(e, Position)!;
      const spread = ctx.state.forkSeconds > 0 ? 3 : p.shotsMultiplier;
      const pierceNext = ctx.state.squashReady;
      for (let i = 0; i < spread; i++) {
        const offset = (i - (spread - 1) / 2) * 14;
        const b = world.spawn();
        world.add(b, Position, { x: pos.x + offset, y: pos.y - 20 });
        world.add(b, Velocity, { vx: 0, vy: -BALANCE.playerBulletSpeed });
        world.add(b, Bullet, { fromPlayer: true, damage: pierceNext ? 3 : 1, pierce: pierceNext });
        world.add(b, Collider, { w: 6, h: 14 });
        world.add(b, SpriteRef, { name: 'laserBlue01.png', scale: 0.6 });
      }
      if (pierceNext) ctx.state.squashReady = false;
      p.fireCooldown = BALANCE.playerFireCooldown;
      sfx.play('shoot', { pitch: 0.95 + Math.random() * 0.1 });
    }
    if (input.wasPressed('bomb') && p.bombsLeft > 0) {
      p.bombsLeft -= 1;
      sfx.play('explode_big');
      screenShake.add({ amplitude: 14, duration: 0.45 });
      const enemiesToKill: number[] = [];
      for (const [eid, epos] of world.query(Position, Enemy)) {
        enemiesToKill.push(eid);
        for (let i = 0; i < 8; i++) {
          particles.bigExplosions.spawn({
            x: epos.x,
            y: epos.y,
            vx: (Math.random() - 0.5) * 360,
            vy: (Math.random() - 0.5) * 360,
            life: 0.7,
          });
        }
      }
      for (const eid of enemiesToKill) {
        const h = world.get(eid, Health);
        if (h) h.hp = 0;
      }
      const bulletsToKill: number[] = [];
      for (const [bid, b] of world.query(Bullet)) {
        if (!b.fromPlayer) bulletsToKill.push(bid);
      }
      for (const bid of bulletsToKill) world.remove(bid);
    }
  }
}
