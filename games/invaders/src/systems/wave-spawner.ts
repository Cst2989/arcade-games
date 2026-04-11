import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Enemy, Health, Position, Collider, SpriteRef, Velocity,
} from '../components/index.js';
import type { Wave } from '../data/mapping.js';
import { BALANCE } from '../config/balance.js';

function pickEnemySprite(commits: number): string {
  if (commits <= 3) return 'enemyBlack1.png';
  if (commits <= 6) return 'enemyBlack2.png';
  if (commits <= 9) return 'enemyBlack3.png';
  return 'enemyBlack4.png';
}

export function spawnWave(wave: Wave, ctx: GameContext): void {
  const { world } = ctx;
  const cols = Math.max(1, wave.enemies.length);
  const spacing = (BALANCE.viewportWidth - 120) / cols;
  wave.enemies.forEach((spec, i) => {
    const e = world.spawn();
    world.add(e, Position, { x: 60 + i * spacing, y: 80 });
    world.add(e, Velocity, { vx: 0, vy: 0 });
    world.add(e, Collider, { w: 44, h: 36 });
    world.add(e, Health, { hp: spec.hp, maxHp: spec.hp, flashUntil: 0 });
    world.add(e, SpriteRef, {
      name: pickEnemySprite(spec.commits),
      scale: 0.6,
      tint: spec.color,
    });
    world.add(e, Enemy, {
      commits: spec.commits,
      fireRate: spec.fireRate,
      fireAccumulator: Math.random() * (1 / spec.fireRate),
      color: spec.color,
      hardSquare: spec.commits >= 10,
      row: 0,
      col: i,
      worthYellow: false,
    });
  });
}

export function waveSpawnerSystem(_dt: number, ctx: GameContext): void {
  const { world } = ctx;
  let alive = 0;
  for (const _ of world.query(Enemy)) {
    alive++;
    break;
  }
  if (alive > 0) return;

  ctx.state.waveIndex += 1;
  if (ctx.state.waveIndex >= ctx.level.waves.length) {
    ctx.events.emit('levelCleared', {});
    return;
  }
  const wave = ctx.level.waves[ctx.state.waveIndex]!;
  if (wave.enemies.length === 0) {
    return waveSpawnerSystem(_dt, ctx);
  }
  spawnWave(wave, ctx);
  ctx.events.emit('waveCleared', { waveIndex: ctx.state.waveIndex - 1 });
}
