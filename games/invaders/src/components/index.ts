import { defineComponent } from '@osi/engine';
import type { PowerupKind } from '../config/powerups.js';

export const Position = defineComponent<{ x: number; y: number }>('Position');
export const Velocity = defineComponent<{ vx: number; vy: number }>('Velocity');
export const SpriteRef = defineComponent<{ name: string; scale: number; tint?: string }>('SpriteRef');
export const Collider = defineComponent<{ w: number; h: number }>('Collider');
export const Health = defineComponent<{ hp: number; maxHp: number; flashUntil: number }>('Health');

export const Player = defineComponent<{
  tier: number;
  fireCooldown: number;
  invulnUntil: number;
  shotsMultiplier: 1 | 2 | 3;
  bombsLeft: number;
}>('Player');

export const Enemy = defineComponent<{
  commits: number;
  fireRate: number;
  fireAccumulator: number;
  color: string;
  hardSquare: boolean;
  row: number;
  col: number;
  worthYellow: boolean;
}>('Enemy');

export const Bullet = defineComponent<{
  fromPlayer: boolean;
  damage: number;
  pierce: boolean;
}>('Bullet');

export const Powerup = defineComponent<{ kind: PowerupKind }>('Powerup');

export const Lifetime = defineComponent<{ remaining: number }>('Lifetime');

export const HitFlash = defineComponent<{ until: number }>('HitFlash');

export const BossTag = defineComponent<{
  phase: 1 | 2 | 3;
  phaseTime: number;
  fireTimer: number;
}>('BossTag');

export const Drone = defineComponent<{ targetX: number; targetY: number }>('Drone');
