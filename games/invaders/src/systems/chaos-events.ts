import type { GameContext } from '../scenes/gameplay-context.js';
import { BALANCE } from '../config/balance.js';

type ChaosKind = 'CI_FAILED' | 'PR_APPROVED' | 'MERGE_CONFLICT' | 'DEPENDABOT' | 'MAIN_GREEN';
const DURATIONS: Record<ChaosKind, number> = {
  CI_FAILED: 8,
  PR_APPROVED: 8,
  MERGE_CONFLICT: 6,
  DEPENDABOT: 10,
  MAIN_GREEN: 5,
};
const ALL: ChaosKind[] = ['CI_FAILED', 'PR_APPROVED', 'MERGE_CONFLICT', 'DEPENDABOT', 'MAIN_GREEN'];

export function chaosEventSystem(_dt: number, now: number, ctx: GameContext): void {
  if (ctx.state.chaosActive) {
    if (now > ctx.state.chaosActive.until) ctx.state.chaosActive = null;
    return;
  }
  const progress = ctx.state.waveIndex / Math.max(1, ctx.level.waves.length);
  if (progress < BALANCE.chaosWindowStart || progress > BALANCE.chaosWindowEnd) return;
  if (Math.random() < 0.005) {
    const kind = ALL[Math.floor(Math.random() * ALL.length)]!;
    ctx.state.chaosActive = { kind, until: now + DURATIONS[kind] };
    ctx.sfx.play('boss_phase');
  }
}
