import { GameplayScene, type GameplayDeps } from './gameplay.js';
import { BossTag, Collider, Health, Player, Position, SpriteRef, Velocity } from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import type { Renderer, SpriteAtlas } from '@osi/engine';
import type { Level } from '../data/mapping.js';

export class BossScene extends GameplayScene {
  private stopBossMusic: (() => void) | null = null;

  constructor(
    renderer: Renderer,
    atlas: SpriteAtlas,
    level: Level,
    levelIndex: number,
    deps: GameplayDeps,
    onVictory: () => void,
    onGameOver?: (score: number, wave: number) => void,
  ) {
    super(renderer, atlas, level, levelIndex, deps, onVictory, onGameOver);
  }

  override onEnter(): void {
    super.onEnter();
    this.ctx.sfx.play('boss_roar', { volume: 0.9 });
    this.stopBossMusic = this.ctx.sfx.loop('boss_phase', { volume: 0.35 });
    const toRemove: number[] = [];
    for (const [e] of this.ctx.world.query(SpriteRef, Collider)) {
      if (this.ctx.world.has(e, Player)) continue;
      if (this.ctx.world.has(e, BossTag)) continue;
      toRemove.push(e);
    }
    for (const e of toRemove) this.ctx.world.remove(e);

    const boss = this.ctx.world.spawn();
    this.ctx.world.add(boss, Position, { x: BALANCE.viewportWidth / 2, y: 100 });
    this.ctx.world.add(boss, Velocity, { vx: 0, vy: 0 });
    this.ctx.world.add(boss, Collider, { w: 140, h: 90 });
    this.ctx.world.add(boss, Health, {
      hp: BALANCE.bossPhase1Hp,
      maxHp: BALANCE.bossPhase1Hp,
      flashUntil: 0,
    });
    this.ctx.world.add(boss, SpriteRef, { name: 'ufoBlue.png', scale: 1.4 });
    this.ctx.world.add(boss, BossTag, { phase: 1, phaseTime: 0, fireTimer: 1 });
  }

  override onExit(): void {
    if (this.stopBossMusic) {
      this.stopBossMusic();
      this.stopBossMusic = null;
    }
    super.onExit();
  }
}
