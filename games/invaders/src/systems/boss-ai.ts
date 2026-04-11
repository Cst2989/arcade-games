import type { GameContext } from '../scenes/gameplay-context.js';
import {
  BossTag, Drone, Health, Position, Collider, SpriteRef, Bullet, Velocity,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';

export type BossPhaseInput =
  | { phase: 1; hp: number }
  | { phase: 2; dronesAlive: number }
  | { phase: 3; hp: number };

export function advanceBossPhase(s: BossPhaseInput): 1 | 2 | 3 {
  if (s.phase === 1) return s.hp <= BALANCE.bossPhase1End ? 2 : 1;
  if (s.phase === 2) return s.dronesAlive <= 0 ? 3 : 2;
  return 3;
}

function transitionPhase1To2(bossE: number, ctx: GameContext): void {
  const { world, particles, screenShake, sfx, events } = ctx;
  const tag = world.get(bossE, BossTag)!;
  tag.phase = 2;
  tag.phaseTime = 0;
  events.emit('bossPhase', { from: 1, to: 2 });
  const pos = world.get(bossE, Position)!;
  for (let i = 0; i < 60; i++) {
    particles.bigExplosions.spawn({
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 500,
      vy: (Math.random() - 0.5) * 500,
      life: 1,
    });
  }
  screenShake.add(BALANCE.shakeBossPhase);
  sfx.play('boss_phase');
  for (let i = 0; i < 3; i++) {
    const d = world.spawn();
    world.add(d, Position, { x: pos.x + (i - 1) * 140, y: pos.y + 20 });
    world.add(d, Velocity, { vx: 0, vy: 0 });
    world.add(d, Collider, { w: 48, h: 36 });
    world.add(d, Health, { hp: BALANCE.bossPhase2DroneHp, maxHp: BALANCE.bossPhase2DroneHp, flashUntil: 0 });
    world.add(d, SpriteRef, { name: 'ufoRed.png', scale: 0.7 });
    world.add(d, Drone, { targetX: pos.x, targetY: pos.y });
  }
  world.removeComponent(bossE, SpriteRef);
  world.removeComponent(bossE, Collider);
}

function transitionPhase2To3(bossE: number, ctx: GameContext): void {
  const { world, particles, screenShake, sfx, events } = ctx;
  const tag = world.get(bossE, BossTag)!;
  tag.phase = 3;
  tag.phaseTime = 0;
  const hp = world.get(bossE, Health)!;
  hp.hp = BALANCE.bossPhase3Hp;
  hp.maxHp = BALANCE.bossPhase3Hp;
  events.emit('bossPhase', { from: 2, to: 3 });
  const pos = world.get(bossE, Position)!;
  world.add(bossE, SpriteRef, { name: 'ufoRed.png', scale: 1.2, tint: '#f85149' });
  world.add(bossE, Collider, { w: 120, h: 80 });
  for (let i = 0; i < 80; i++) {
    particles.bigExplosions.spawn({
      x: pos.x,
      y: pos.y,
      vx: (Math.random() - 0.5) * 600,
      vy: (Math.random() - 0.5) * 600,
      life: 1.2,
    });
  }
  screenShake.add({ amplitude: 14, duration: 0.6 });
  sfx.play('boss_roar');
}

export function bossAiSystem(dt: number, ctx: GameContext): void {
  const { world } = ctx;
  for (const [bossE, tag] of world.query(BossTag)) {
    const pos = world.get(bossE, Position);
    const hp = world.get(bossE, Health);
    if (!pos || !hp) continue;
    tag.phaseTime += dt;
    tag.fireTimer -= dt;

    if (tag.phase === 1) {
      pos.x = BALANCE.viewportWidth / 2 + Math.sin(tag.phaseTime) * 180;
      pos.y = 100;
      if (tag.fireTimer <= 0) {
        tag.fireTimer = 0.8;
        for (const dir of [-0.3, 0, 0.3]) {
          const b = world.spawn();
          world.add(b, Position, { x: pos.x, y: pos.y + 20 });
          world.add(b, Velocity, { vx: dir * 260, vy: BALANCE.enemyBulletSpeed });
          world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
          world.add(b, Collider, { w: 8, h: 16 });
          world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 0.8 });
        }
      }
      const next = advanceBossPhase({ phase: 1, hp: hp.hp });
      if (next === 2) transitionPhase1To2(bossE, ctx);
    } else if (tag.phase === 2) {
      let drones = 0;
      for (const _ of world.query(Drone)) drones++;
      const next = advanceBossPhase({ phase: 2, dronesAlive: drones });
      if (next === 3) transitionPhase2To3(bossE, ctx);
    } else {
      pos.x = BALANCE.viewportWidth / 2 + Math.sin(tag.phaseTime * 2) * 220;
      pos.y = 120;
      if (tag.fireTimer <= 0) {
        tag.fireTimer = 0.25;
        const b = world.spawn();
        world.add(b, Position, { x: pos.x, y: pos.y + 20 });
        world.add(b, Velocity, { vx: Math.cos(tag.phaseTime * 4) * 300, vy: BALANCE.enemyBulletSpeed });
        world.add(b, Bullet, { fromPlayer: false, damage: 1, pierce: false });
        world.add(b, Collider, { w: 10, h: 18 });
        world.add(b, SpriteRef, { name: 'laserRed01.png', scale: 1 });
      }
    }
  }
}
