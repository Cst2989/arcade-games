import type { GameContext } from '../scenes/gameplay-context.js';

export function screenShakeSystem(dt: number, ctx: GameContext): void {
  ctx.screenShake.update(dt);
}
