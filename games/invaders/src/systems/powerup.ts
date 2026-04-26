import type { GameContext } from '../scenes/gameplay-context.js';
import { Powerup, Player, Health, Position } from '../components/index.js';

export function applyPowerup(kind: string, playerEntity: number, ctx: GameContext, _now: number): void {
  const { world, sfx } = ctx;
  const p = world.get(playerEntity, Player);
  const hp = world.get(playerEntity, Health);
  const pos = world.get(playerEntity, Position);
  if (!p || !hp || !pos) return;
  ctx.stats.powerupsCollected += 1;
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
    case 'forcepush':
      // Stockpiles a bomb instead of auto-clearing the screen. Player
      // detonates it manually with X (see player-control.ts).
      p.bombsLeft += 1;
      break;
  }
  void Powerup;
}
