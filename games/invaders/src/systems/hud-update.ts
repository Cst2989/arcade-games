import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Health } from '../components/index.js';

export function hudUpdateSystem(_dt: number, ctx: GameContext): void {
  const hud = ctx.hud;
  hud.score = ctx.state.score;
  hud.combo = ctx.state.combo;
  hud.waveIndex = ctx.state.waveIndex;
  hud.totalWaves = ctx.level.waves.length;
  hud.chaos = ctx.state.chaosActive?.kind ?? null;
  for (const [e] of ctx.world.query(Player)) {
    const h = ctx.world.get(e, Health);
    if (h) {
      hud.playerHp = h.hp;
      hud.playerMaxHp = h.maxHp;
    }
  }
}
