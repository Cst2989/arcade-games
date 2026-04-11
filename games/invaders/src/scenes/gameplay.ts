import { Scene, EventBus, World } from '@osi/engine';
import type { Renderer, SpriteAtlas, InputMap, GameLoop, Sfx, ScreenShake, Tween } from '@osi/engine';
import type { Level } from '../data/mapping.js';
import type { GameContext, HudState, InvadersEvents } from './gameplay-context.js';
import { createHudState } from './gameplay-context.js';
import {
  Position, SpriteRef, Health, Player, Powerup, Collider, Enemy, Bullet,
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
import { waveSpawnerSystem } from '../systems/wave-spawner.js';
import { particleSystem } from '../systems/particle.js';
import { screenShakeSystem } from '../systems/screen-shake.js';
import { tweenSystem } from '../systems/tween.js';
import { hudUpdateSystem } from '../systems/hud-update.js';

import { drawHud } from '../ui/hud.js';
import {
  CELL, ROW_PITCH, COLS_PER_ROW, GRID_LEFT, GRID_WIDTH, EMPTY_CELL_COLOR, cellCenterX,
} from '../systems/wave-spawner.js';

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
      rows: [],
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

    this.ctx.state.waveIndex = 0;
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

    main.fillStyle = BALANCE.bg;
    main.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);

    this.ctx.particles.stars.render(main);

    main.save();
    main.translate(offX, offY);

    drawGridHeader(main, this.ctx.level.contributor.totalCommits ?? 0, this.ctx.rows.length);

    for (const row of this.ctx.rows) {
      for (let col = 0; col < COLS_PER_ROW; col++) {
        const slot = row.cells[col]!;
        const cx = cellCenterX(col);
        const color = slot.alive ? slot.color : EMPTY_CELL_COLOR;
        drawRoundedCell(main, cx, row.y, CELL, color);
      }
    }

    for (const [e, pos, sprite] of this.ctx.world.query(Position, SpriteRef)) {
      const hp = this.ctx.world.get(e, Health);
      const flashing = !!(hp && hp.flashUntil > this.now);
      const en = this.ctx.world.get(e, Enemy);
      const bullet = this.ctx.world.get(e, Bullet);

      if (en) {
        if (flashing) drawRoundedCell(main, pos.x, pos.y, CELL, '#ffffff');
        continue;
      }
      if (bullet) {
        if (bullet.fromPlayer) {
          main.fillStyle = '#58a6ff';
          main.fillRect(pos.x - 2, pos.y - 9, 4, 18);
        } else {
          main.fillStyle = '#f85149';
          main.shadowColor = '#f85149';
          main.shadowBlur = 6;
          main.fillRect(pos.x - 2, pos.y - 11, 4, 22);
          main.shadowBlur = 0;
        }
        continue;
      }
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

function drawRoundedCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  const r = 3;
  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawGridHeader(ctx: CanvasRenderingContext2D, totalCommits: number, weeksSeen: number): void {
  ctx.save();
  ctx.fillStyle = '#c9d1d9';
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${totalCommits.toLocaleString()} contributions in the last year`,
    GRID_LEFT,
    40,
  );
  ctx.fillStyle = '#8b949e';
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.fillText(`weeks defended: ${weeksSeen}`, GRID_LEFT + GRID_WIDTH - 140, 40);

  const legendX = GRID_LEFT + GRID_WIDTH - 110;
  const legendY = 56;
  const legendCell = 10;
  const legendGap = 3;
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Less', legendX - 4, legendY + 8);
  const shades = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  for (let i = 0; i < shades.length; i++) {
    drawRoundedCell(ctx, legendX + i * (legendCell + legendGap) + legendCell / 2, legendY + 5, legendCell, shades[i]!);
  }
  ctx.textAlign = 'left';
  ctx.fillText('More', legendX + shades.length * (legendCell + legendGap) + 2, legendY + 8);
  ctx.restore();
  void ROW_PITCH;
}
