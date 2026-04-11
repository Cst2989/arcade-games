import type { GameContext, HudPowerupChip } from '../scenes/gameplay-context.js';
import { Player, Health } from '../components/index.js';

export function hudUpdateSystem(_dt: number, ctx: GameContext): void {
  const hud = ctx.hud;
  hud.score = ctx.state.score;
  hud.combo = ctx.state.combo;
  hud.waveIndex = ctx.state.waveIndex;
  hud.totalWaves = ctx.level.waves.length;
  hud.chaos = ctx.state.chaosActive?.kind ?? null;
  hud.bombsLeft = 0;
  for (const [e, p] of ctx.world.query(Player)) {
    const h = ctx.world.get(e, Health);
    if (h) {
      hud.playerHp = h.hp;
      hud.playerMaxHp = h.maxHp;
    }
    hud.bombsLeft = p.bombsLeft;
  }
  const chips: HudPowerupChip[] = [];
  if (ctx.state.forkSeconds > 0) {
    chips.push({ label: `fork ${ctx.state.forkSeconds.toFixed(1)}s`, color: '#58a6ff', remaining: ctx.state.forkSeconds });
  }
  if (ctx.state.rebaseSeconds > 0) {
    chips.push({ label: `rebase ${ctx.state.rebaseSeconds.toFixed(1)}s`, color: '#d29922', remaining: ctx.state.rebaseSeconds });
  }
  if (ctx.state.squashReady) {
    chips.push({ label: 'squash READY', color: '#a371f7', remaining: 1 });
  }
  hud.activePowerups = chips;
}
