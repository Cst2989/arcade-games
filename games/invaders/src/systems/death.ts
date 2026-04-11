import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Enemy, Health, Position, Powerup, Collider, SpriteRef, Velocity, BossTag, Drone,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { POWERUPS } from '../config/powerups.js';

export function deathSystem(_dt: number, now: number, ctx: GameContext): void {
  const { world, events, particles, screenShake, sfx } = ctx;

  for (const [e, hp] of world.query(Health)) {
    if (hp.hp > 0) continue;
    const pos = world.get(e, Position);
    const en = world.get(e, Enemy);
    const boss = world.get(e, BossTag);
    const drone = world.get(e, Drone);

    if (pos) {
      for (let i = 0; i < 20; i++) {
        particles.explosions.spawn({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 300,
          vy: (Math.random() - 0.5) * 300,
          life: 0.6 + Math.random() * 0.3,
        });
      }
      screenShake.add({ amplitude: 4, duration: 0.15 });
      sfx.play('explode_small');
    }

    if (en) {
      ctx.stats.enemiesKilled += 1;
      events.emit('enemyKilled', {
        entity: e,
        commits: en.commits,
        hardSquare: en.hardSquare,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
      });
      if (pos) {
        const dense = en.commits >= 15;
        const hard = en.hardSquare;
        const base = dense ? 0.7 : hard ? 0.4 : 0.14;
        const dropMul = Math.max(0.15, 1 - ctx.levelIndex * 0.18);
        const dropChance = base * dropMul;
        if (Math.random() < dropChance) {
          let def = POWERUPS[Math.floor(Math.random() * POWERUPS.length)]!;
          if (dense && Math.random() < 0.6) {
            def = POWERUPS.find((p) => p.kind === 'forcepush') ?? def;
          }
          const p = world.spawn();
          world.add(p, Position, { x: pos.x, y: pos.y });
          world.add(p, Velocity, { vx: 0, vy: BALANCE.powerupFallSpeed });
          world.add(p, Powerup, { kind: def.kind });
          world.add(p, Collider, { w: 28, h: 28 });
          world.add(p, SpriteRef, { name: def.sprite, scale: 1 });
        }
      }
      ctx.state.score += en.commits * 10;
      ctx.state.combo += 1;
      ctx.state.comboExpires = now + 1.2;
    }
    if (boss) {
      events.emit('bossPhase', { from: boss.phase, to: boss.phase });
    }
    if (drone) {
      // handled by boss phase advance in boss-ai system
    }
    world.remove(e);
  }

  if (ctx.state.combo > 0 && now > ctx.state.comboExpires) {
    ctx.state.combo = 0;
  }
}
