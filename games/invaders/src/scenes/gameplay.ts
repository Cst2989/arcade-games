import { Scene, EventBus, World } from '@osi/engine';
import type { Renderer, SpriteAtlas, InputMap, GameLoop, Sfx, ScreenShake, Tween } from '@osi/engine';
import type { Level } from '../data/mapping.js';
import type { GameContext, HudState, InvadersEvents } from './gameplay-context.js';
import { createHudState } from './gameplay-context.js';
import {
  Position, SpriteRef, Health, Player, Powerup, Collider,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { SHIP_TIERS } from '../config/ships.js';

import { inputSystem } from '../systems/input.js';
import { playerControlSystem } from '../systems/player-control.js';
import { enemyAiSystem } from '../systems/enemy-ai.js';
import { bossAiSystem } from '../systems/boss-ai.js';
import { physicsSystem } from '../systems/physics.js';
import { bulletSpawnSystem } from '../systems/bullet-spawn.js';
import { collisionSystem } from '../systems/collision.js';
import { damageSystem } from '../systems/damage.js';
import { deathSystem } from '../systems/death.js';
import { applyPowerup } from '../systems/powerup.js';
import { chaosEventSystem } from '../systems/chaos-events.js';
import { waveSpawnerSystem, spawnWave } from '../systems/wave-spawner.js';
import { particleSystem } from '../systems/particle.js';
import { screenShakeSystem } from '../systems/screen-shake.js';
import { tweenSystem } from '../systems/tween.js';
import { hudUpdateSystem } from '../systems/hud-update.js';

import { drawHud } from '../ui/hud.js';

export interface GameplayDeps {
  input: InputMap;
  gameLoop: GameLoop;
  sfx: Sfx;
  screenShake: ScreenShake;
  particles: GameContext['particles'];
}

export class GameplayScene extends Scene {
  readonly ctx: GameContext;
  protected now = 0;

  constructor(
    protected renderer: Renderer,
    protected atlas: SpriteAtlas,
    level: Level,
    levelIndex: number,
    deps: GameplayDeps,
    private onLevelCleared: () => void,
  ) {
    super();
    const events = new EventBus<InvadersEvents>();
    const hud: HudState = createHudState();
    this.ctx = {
      world: new World(),
      input: deps.input,
      events,
      gameLoop: deps.gameLoop,
      screenShake: deps.screenShake,
      particles: deps.particles,
      tweens: [] as Tween<Record<string, number>>[],
      sfx: deps.sfx,
      level,
      levelIndex,
      hud,
      state: {
        waveIndex: 0,
        score: 0,
        combo: 0,
        comboExpires: 0,
        chaosActive: null,
      },
    };
    events.on('levelCleared', () => this.onLevelCleared());
  }

  override onEnter(): void {
    const e = this.ctx.world.spawn();
    const tier = SHIP_TIERS[this.ctx.levelIndex]!;
    this.ctx.world.add(e, Position, {
      x: BALANCE.viewportWidth / 2,
      y: BALANCE.viewportHeight - 60,
    });
    this.ctx.world.add(e, SpriteRef, { name: tier.sprite, scale: 0.7 });
    this.ctx.world.add(e, Health, { hp: tier.maxHp, maxHp: tier.maxHp, flashUntil: 0 });
    this.ctx.world.add(e, Player, {
      tier: tier.level,
      fireCooldown: 0,
      invulnUntil: 0,
      shotsMultiplier: tier.shots as 1 | 2 | 3,
      bombsLeft: BALANCE.maxBombsPerLevel,
    });
    this.ctx.world.add(e, Collider, { w: 40, h: 32 });

    let wi = 0;
    while (wi < this.ctx.level.waves.length && this.ctx.level.waves[wi]!.enemies.length === 0) wi++;
    this.ctx.state.waveIndex = wi;
    if (wi < this.ctx.level.waves.length) spawnWave(this.ctx.level.waves[wi]!, this.ctx);
  }

  override update(dt: number): void {
    this.now += dt;
    inputSystem(dt, this.ctx);
    playerControlSystem(dt, this.ctx);
    enemyAiSystem(dt, this.ctx);
    bossAiSystem(dt, this.ctx);
    physicsSystem(dt, this.ctx);
    bulletSpawnSystem(dt, this.ctx);
    const hits = collisionSystem(dt, this.ctx);
    damageSystem(hits.filter((h) => h.targetKind !== 'powerup'), this.now, this.ctx);
    for (const h of hits.filter((h) => h.targetKind === 'powerup')) {
      const pu = this.ctx.world.get(h.bullet, Powerup);
      if (pu) {
        applyPowerup(pu.kind, h.target, this.ctx, this.now);
        this.ctx.world.remove(h.bullet);
      }
    }
    deathSystem(dt, this.now, this.ctx);
    chaosEventSystem(dt, this.now, this.ctx);
    waveSpawnerSystem(dt, this.ctx);
    particleSystem(dt, this.ctx);
    screenShakeSystem(dt, this.ctx);
    tweenSystem(dt, this.ctx);
    hudUpdateSystem(dt, this.ctx);
  }

  override render(): void {
    const r = this.renderer;
    r.beginFrame();
    const offX = this.ctx.screenShake.offsetX;
    const offY = this.ctx.screenShake.offsetY;
    const main = r.main;
    this.ctx.particles.stars.render(main);
    main.save();
    main.translate(offX, offY);
    for (const [e, pos, sprite] of this.ctx.world.query(Position, SpriteRef)) {
      const hp = this.ctx.world.get(e, Health);
      const flashing = !!(hp && hp.flashUntil > this.now);
      if (this.atlas.has(sprite.name)) {
        if (flashing) {
          this.atlas.drawTinted(main, sprite.name, pos.x, pos.y, '#ffffff', sprite.scale);
        } else if (sprite.tint) {
          this.atlas.drawTinted(main, sprite.name, pos.x, pos.y, sprite.tint, sprite.scale);
        } else {
          this.atlas.draw(main, sprite.name, pos.x, pos.y, sprite.scale);
        }
      } else {
        main.fillStyle = sprite.tint ?? '#58a6ff';
        const s = 24 * sprite.scale;
        main.fillRect(pos.x - s / 2, pos.y - s / 2, s, s);
      }
    }
    this.ctx.particles.sparks.render(main);
    this.ctx.particles.explosions.render(main);
    this.ctx.particles.bigExplosions.render(main);
    this.ctx.particles.powerupDust.render(main);
    main.restore();
    drawHud(r, this.ctx.hud);
    if (this.ctx.state.chaosActive?.kind === 'CI_FAILED') {
      main.fillStyle = 'rgba(248, 81, 73, 0.10)';
      main.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    }
    r.endFrame();
  }
}
