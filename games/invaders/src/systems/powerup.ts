import type { GameContext } from '../scenes/gameplay-context.js';
import { Powerup, Player, Health, Position, Enemy } from '../components/index.js';

export function applyPowerup(kind: string, playerEntity: number, ctx: GameContext, _now: number): void {
  const { world, sfx, particles } = ctx;
  const p = world.get(playerEntity, Player);
  const hp = world.get(playerEntity, Health);
  const pos = world.get(playerEntity, Position);
  if (!p || !hp || !pos) return;
  sfx.play('powerup_get');

  switch (kind) {
    case 'revert':
      hp.hp = Math.min(hp.maxHp, hp.hp + 1);
      break;
    case 'fork':
      ctx.state.forkSeconds = 8;
      break;
    case 'rebase':
      ctx.state.rebaseSeconds = 5;
      break;
    case 'squash':
      ctx.state.squashReady = true;
      break;
    case 'forcepush': {
      const toClear: number[] = [];
      for (const [e, epos] of world.query(Position, Enemy)) {
        toClear.push(e);
        for (let i = 0; i < 12; i++) {
          particles.bigExplosions.spawn({
            x: epos.x,
            y: epos.y,
            vx: (Math.random() - 0.5) * 400,
            vy: (Math.random() - 0.5) * 400,
            life: 0.8,
          });
        }
      }
      for (const e of toClear) world.remove(e);
      break;
    }
  }
  void Powerup;
}
