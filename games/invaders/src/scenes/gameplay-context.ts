import type {
  World, InputMap, EventBus, GameLoop, ScreenShake, ParticleEmitter, Sfx, Tween,
} from '@osi/engine';
import type { Level } from '../data/mapping.js';

export type InvadersEvents = {
  enemyKilled: { entity: number; commits: number; hardSquare: boolean; x: number; y: number };
  playerHit: { damage: number };
  waveCleared: { waveIndex: number };
  levelCleared: Record<string, never>;
  bossPhase: { from: 1 | 2 | 3; to: 1 | 2 | 3 };
};

export interface CellSlot {
  commits: number;
  color: string;
  alive: boolean;
  entityId: number | null;
}

export interface RowState {
  weekIndex: number;
  y: number;
  cells: CellSlot[];
}

export interface HudPowerupChip {
  label: string;
  color: string;
  remaining: number;
}

export interface HudState {
  score: number;
  combo: number;
  waveIndex: number;
  totalWaves: number;
  playerHp: number;
  playerMaxHp: number;
  chaos: string | null;
  bombsLeft: number;
  activePowerups: HudPowerupChip[];
  repoName: string;
}

export interface GameStats {
  totalScore: number;
  shotsFired: number;
  shotsHit: number;
  enemiesKilled: number;
  bombsUsed: number;
  powerupsCollected: number;
  levelsCompleted: number;
}

export function createGameStats(): GameStats {
  return {
    totalScore: 0,
    shotsFired: 0,
    shotsHit: 0,
    enemiesKilled: 0,
    bombsUsed: 0,
    powerupsCollected: 0,
    levelsCompleted: 0,
  };
}

export interface GameContext {
  world: World;
  input: InputMap;
  events: EventBus<InvadersEvents>;
  gameLoop: GameLoop;
  screenShake: ScreenShake;
  particles: {
    sparks: ParticleEmitter;
    explosions: ParticleEmitter;
    bigExplosions: ParticleEmitter;
    stars: ParticleEmitter;
    powerupDust: ParticleEmitter;
  };
  tweens: Tween<Record<string, number>>[];
  sfx: Sfx;
  level: Level;
  levelIndex: number;
  rows: RowState[];
  hud: HudState;
  stats: GameStats;
  state: {
    waveIndex: number;
    score: number;
    combo: number;
    comboExpires: number;
    chaosActive: { kind: string; until: number } | null;
    forkSeconds: number;
    rebaseSeconds: number;
    squashReady: boolean;
  };
}

export function createHudState(): HudState {
  return {
    score: 0,
    combo: 0,
    waveIndex: 0,
    totalWaves: 0,
    playerHp: 0,
    playerMaxHp: 0,
    chaos: null,
    bombsLeft: 0,
    activePowerups: [],
    repoName: '',
  };
}
