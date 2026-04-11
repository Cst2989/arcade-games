export interface ShipTier {
  level: number;
  sprite: string;
  maxHp: number;
  speedMultiplier: number;
  shots: number;
  idleRegen: boolean;
}

export const SHIP_TIERS: ShipTier[] = [
  { level: 1, sprite: 'playerShip1_blue.png',   maxHp: 3, speedMultiplier: 1.00, shots: 1, idleRegen: false },
  { level: 2, sprite: 'playerShip2_blue.png',   maxHp: 4, speedMultiplier: 1.00, shots: 1, idleRegen: false },
  { level: 3, sprite: 'playerShip3_blue.png',   maxHp: 4, speedMultiplier: 1.00, shots: 2, idleRegen: false },
  { level: 4, sprite: 'playerShip2_orange.png', maxHp: 5, speedMultiplier: 1.15, shots: 2, idleRegen: false },
  { level: 5, sprite: 'playerShip3_red.png',    maxHp: 5, speedMultiplier: 1.15, shots: 3, idleRegen: true  },
];
