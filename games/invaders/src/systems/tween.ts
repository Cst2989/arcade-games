import type { GameContext } from '../scenes/gameplay-context.js';

export function tweenSystem(dt: number, ctx: GameContext): void {
  for (let i = ctx.tweens.length - 1; i >= 0; i--) {
    ctx.tweens[i]!.update(dt);
    if (ctx.tweens[i]!.done) ctx.tweens.splice(i, 1);
  }
}
