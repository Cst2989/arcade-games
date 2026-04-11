import type { GameContext } from '../scenes/gameplay-context.js';
import { Player, Velocity } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { SHIP_TIERS } from '../config/ships.js';

export function inputSystem(_dt: number, ctx: GameContext): void {
  const { input, world } = ctx;
  const chaosInvert = ctx.state.chaosActive?.kind === 'MERGE_CONFLICT';
  for (const [e, p] of world.query(Player)) {
    const vel = world.get(e, Velocity) ?? { vx: 0, vy: 0 };
    const tier = SHIP_TIERS[p.tier - 1]!;
    const speed = BALANCE.playerSpeed * tier.speedMultiplier;
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    if (chaosInvert) dir = -dir;
    vel.vx = dir * speed;
    vel.vy = 0;
    world.add(e, Velocity, vel);
  }
}
