import type { GameContext, RowState, CellSlot } from '../scenes/gameplay-context.js';
import {
  Enemy, Health, Position, Collider, SpriteRef, Velocity, Player,
} from '../components/index.js';
import type { Wave } from '../data/mapping.js';
import { BALANCE } from '../config/balance.js';

export const CELL = 20;
export const CELL_GAP = 3;
export const ROW_PITCH = CELL + CELL_GAP;
export const COLS_PER_ROW = 7;
export const GRID_WIDTH = COLS_PER_ROW * CELL + (COLS_PER_ROW - 1) * CELL_GAP;
export const GRID_LEFT = (BALANCE.viewportWidth - GRID_WIDTH) / 2;
export const ROW_TOP_Y = 80;
export const EMPTY_CELL_COLOR = '#161b22';

const BASE_SPAWN_INTERVAL = 1.5;
const LEVEL_SPEED_STEP = 0.18;

function levelSpeedMul(levelIndex: number): number {
  return 1 + levelIndex * LEVEL_SPEED_STEP;
}

export function cellCenterX(col: number): number {
  return GRID_LEFT + col * ROW_PITCH + CELL / 2;
}

function buildRow(wave: Wave, ctx: GameContext, y: number): RowState {
  const { world } = ctx;
  const cells: CellSlot[] = [];
  for (let col = 0; col < COLS_PER_ROW; col++) {
    cells.push({ commits: 0, color: EMPTY_CELL_COLOR, alive: false, entityId: null });
  }
  for (const spec of wave.enemies) {
    if (spec.commits <= 0) continue;
    const day = new Date(spec.date);
    const col = (day.getUTCDay() + 6) % COLS_PER_ROW;
    const slot = cells[col];
    if (!slot) continue;
    const e = world.spawn();
    world.add(e, Position, { x: cellCenterX(col), y });
    world.add(e, Velocity, { vx: 0, vy: 0 });
    world.add(e, Collider, { w: CELL, h: CELL });
    world.add(e, Health, { hp: spec.hp, maxHp: spec.hp, flashUntil: 0 });
    world.add(e, SpriteRef, { name: 'github-cell', scale: 1, tint: spec.color });
    world.add(e, Enemy, {
      commits: spec.commits,
      fireRate: spec.fireRate,
      fireAccumulator: Math.random() * (1 / spec.fireRate),
      color: spec.color,
      hardSquare: spec.commits >= 10,
      row: 0,
      col,
      worthYellow: false,
    });
    slot.commits = spec.commits;
    slot.color = spec.color;
    slot.alive = true;
    slot.entityId = e;
  }
  return { weekIndex: ctx.state.waveIndex, y, cells };
}

interface SpawnerState {
  initialized: boolean;
  spawnTimer: number;
  gameOverFired: boolean;
  levelClearedFired: boolean;
}

function getSpawnerState(ctx: GameContext): SpawnerState {
  const key = '_osi_spawnerState';
  const any = ctx as unknown as Record<string, SpawnerState | undefined>;
  let s = any[key];
  if (!s) {
    s = { initialized: false, spawnTimer: 0, gameOverFired: false, levelClearedFired: false };
    any[key] = s;
  }
  return s;
}

function reapDeadEntities(ctx: GameContext): void {
  for (const row of ctx.rows) {
    for (const slot of row.cells) {
      if (!slot.alive) continue;
      if (slot.entityId === null) continue;
      const pos = ctx.world.get(slot.entityId, Position);
      if (!pos) {
        slot.alive = false;
        slot.entityId = null;
      }
    }
  }
}

function spawnNext(ctx: GameContext): void {
  const totalWaves = ctx.level.waves.length;
  if (ctx.state.waveIndex >= totalWaves) return;
  const wave = ctx.level.waves[ctx.state.waveIndex]!;
  const row = buildRow(wave, ctx, ROW_TOP_Y);
  ctx.rows.push(row);
  ctx.state.waveIndex++;
}

export function waveSpawnerSystem(dt: number, ctx: GameContext): void {
  const state = getSpawnerState(ctx);
  const totalWaves = ctx.level.waves.length;
  const speedMul = levelSpeedMul(ctx.levelIndex);
  const spawnInterval = BASE_SPAWN_INTERVAL / speedMul;
  const descentSpeed = ROW_PITCH / spawnInterval;

  if (!state.initialized) {
    state.initialized = true;
    spawnNext(ctx);
    state.spawnTimer = 0;
    return;
  }

  state.spawnTimer += dt;

  const descent = descentSpeed * dt;
  for (const row of ctx.rows) {
    row.y += descent;
    for (const slot of row.cells) {
      if (slot.alive && slot.entityId !== null) {
        const p = ctx.world.get(slot.entityId, Position);
        if (p) p.y = row.y;
      }
    }
  }

  if (state.spawnTimer >= spawnInterval) {
    state.spawnTimer -= spawnInterval;
    spawnNext(ctx);
  }

  reapDeadEntities(ctx);

  let lowestAliveY = -Infinity;
  for (const row of ctx.rows) {
    if (!row.cells.some((c) => c.alive)) continue;
    if (row.y > lowestAliveY) lowestAliveY = row.y;
  }

  let playerY: number = BALANCE.viewportHeight;
  for (const [, pos] of ctx.world.query(Position, Player)) playerY = pos.y;

  if (!state.gameOverFired && lowestAliveY > playerY - CELL) {
    state.gameOverFired = true;
    for (const [pid, hp] of ctx.world.query(Health, Player)) {
      hp.hp = 0;
      void pid;
    }
  }

  const anyAlive = ctx.rows.some((r) => r.cells.some((c) => c.alive));
  if (!state.levelClearedFired && ctx.state.waveIndex >= totalWaves && !anyAlive) {
    state.levelClearedFired = true;
    ctx.events.emit('levelCleared', {});
  }
}
