import type { GameContext } from '../scenes/gameplay-context.js';
import type { HitEvent } from './collision.js';
import { Bullet, Health, Player, Position } from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export function damageSystem(hits: HitEvent[], now: number, ctx: GameContext): void {
  const { world, events, sfx, particles, screenShake, gameLoop } = ctx;

  for (const h of hits) {
    if (h.targetKind === 'enemy' || h.targetKind === 'boss' || h.targetKind === 'drone') {
      const hp = world.get(h.target, Health);
      const bullet = world.get(h.bullet, Bullet);
      if (!hp || !bullet) continue;
      if (bullet.fromPlayer) ctx.stats.shotsHit += 1;
      hp.hp -= bullet.damage;
      hp.flashUntil = now + 0.08;
      const pos = world.get(h.target, Position);
      if (pos) {
        for (let i = 0; i < 6; i++) {
          particles.sparks.spawn({
            x: pos.x,
            y: pos.y,
            vx: (Math.random() - 0.5) * 180,
            vy: (Math.random() - 0.5) * 180,
            life: 0.35,
          });
        }
      }
      if (!bullet.pierce) world.remove(h.bullet);
      if (hp.hp > 0) {
        gameLoop.timeScale = 0;
        setTimeout(() => (gameLoop.timeScale = 1), BALANCE.hitStopNonFatalMs);
        screenShake.add(BALANCE.shakeHitNonFatal);
        sfx.play('hit_soft');
      } else {
        gameLoop.timeScale = 0;
        setTimeout(() => (gameLoop.timeScale = 1), BALANCE.hitStopFatalMs);
        screenShake.add(BALANCE.shakeHitFatal);
        sfx.play('hit_hard');
      }
    } else if (h.targetKind === 'player') {
      const p = world.get(h.target, Player);
      const hp = world.get(h.target, Health);
      if (!p || !hp) continue;
      if (now < p.invulnUntil) {
        world.remove(h.bullet);
        continue;
      }
      hp.hp -= 1;
      p.invulnUntil = now + BALANCE.playerInvulnSeconds;
      screenShake.add(BALANCE.shakePlayerHit);
      sfx.play('hit_hard');
      events.emit('playerHit', { damage: 1 });
      world.remove(h.bullet);
    }
  }
}
