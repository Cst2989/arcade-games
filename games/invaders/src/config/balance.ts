export const BALANCE = {
  // World
  viewportWidth: 960,
  viewportHeight: 600,
  fixedDt: 1 / 60,

  // Difficulty
  levelDifficultyStep: 0.4,
  baseFireRate: 0.2,
  fireRatePerCommit: 0.05,

  // Player
  playerSpeed: 260,
  playerFireCooldown: 0.18,
  playerInvulnSeconds: 1.2,
  playerBulletSpeed: 520,

  // Enemies
  enemyMarchSpeed: 18,
  enemyDropDistance: 14,
  enemyBulletSpeed: 240,
  enemyBulletJitter: 0.3,

  // Powerups
  powerupDropChance: 0.22,
  powerupFallSpeed: 80,
  powerupRebaseSlow: 0.5,
  powerupRebaseDuration: 5,
  powerupBombRadiusPx: 9999,
  maxBombsPerLevel: 1,

  // Hit-stop
  hitStopNonFatalMs: 30,
  hitStopFatalMs: 50,
  hitStopBossPhaseMs: 600,

  // Screen shake
  shakeHitNonFatal: { amplitude: 2, duration: 0.08 },
  shakeHitFatal: { amplitude: 4, duration: 0.15 },
  shakePlayerHit: { amplitude: 8, duration: 0.3 },
  shakeBossPhase: { amplitude: 12, duration: 0.5 },
  shakeMaxAmplitude: 18,

  // Boss
  bossPhase1Hp: 300,
  bossPhase1End: 200,
  bossPhase2DroneHp: 60,
  bossPhase3Hp: 100,

  // Chaos
  chaosWindowStart: 0.3,
  chaosWindowEnd: 0.7,

  // Particles
  particleCapacities: {
    sparks: 500,
    explosions: 300,
    bigExplosions: 150,
    stars: 200,
    powerupDust: 100,
  },

  // Colors (GitHub dark)
  bg: '#0d1117',
  bgAlt: '#161b22',
  accentCyan: '#58a6ff',
  accentGreen: '#3fb950',
  accentRed: '#f85149',
  accentYellow: '#d29922',
} as const;
