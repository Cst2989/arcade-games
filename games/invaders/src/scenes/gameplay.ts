import { Scene, EventBus, World } from '@osi/engine';
import type { Renderer, SpriteAtlas, InputMap, GameLoop, Sfx, ScreenShake, Tween } from '@osi/engine';
import type { Level } from '../data/mapping.js';
import type { GameContext, GameStats, HudState, InvadersEvents } from './gameplay-context.js';
import { createHudState } from './gameplay-context.js';
import {
  Position, SpriteRef, Health, Player, Powerup, Collider, Enemy, Bullet,
} from '../components/index.js';
import { BALANCE } from '../config/balance.js';
import { isTouchDevice } from '../ui/touch-detect.js';
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
import { drawContributorPanel } from '../ui/contributor-panel.js';
import { setInGame } from '../ui/chrome.js';
import { POWERUPS } from '../config/powerups.js';
import {
  CELL, ROW_PITCH, COLS_PER_ROW, GRID_LEFT, GRID_WIDTH, EMPTY_CELL_COLOR, cellCenterX,
} from '../systems/wave-spawner.js';

export interface GameplayDeps {
  input: InputMap;
  gameLoop: GameLoop;
  sfx: Sfx;
  screenShake: ScreenShake;
  particles: GameContext['particles'];
  stats: GameStats;
  repoName: string;
}

export class GameplayScene extends Scene {
  readonly ctx: GameContext;
  protected now = 0;
  private playerSpawned = false;
  private gameOverFired = false;

  constructor(
    protected renderer: Renderer,
    protected atlas: SpriteAtlas,
    level: Level,
    levelIndex: number,
    deps: GameplayDeps,
    private onLevelCleared: () => void,
    private onGameOver?: (score: number, wave: number) => void,
  ) {
    super();
    const events = new EventBus<InvadersEvents>();
    const hud: HudState = createHudState();
    hud.repoName = deps.repoName;
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
      stats: deps.stats,
      state: {
        waveIndex: 0,
        score: 0,
        combo: 0,
        comboExpires: 0,
        chaosActive: null,
        forkSeconds: 0,
        rebaseSeconds: 0,
        squashReady: false,
      },
    };
    events.on('levelCleared', () => this.onLevelCleared());
  }

  override onExit(): void {
    setInGame(false);
    this.ctx.particles.sparks.clear();
    this.ctx.particles.explosions.clear();
    this.ctx.particles.bigExplosions.clear();
    this.ctx.particles.powerupDust.clear();
  }

  override onEnter(): void {
    setInGame(true);
    this.ctx.particles.sparks.clear();
    this.ctx.particles.explosions.clear();
    this.ctx.particles.bigExplosions.clear();
    this.ctx.particles.powerupDust.clear();
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
    this.playerSpawned = true;
    this.gameOverFired = false;
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

    if (this.playerSpawned && !this.gameOverFired) {
      let alive = false;
      for (const entry of this.ctx.world.query(Player)) { void entry; alive = true; break; }
      if (!alive) {
        this.gameOverFired = true;
        this.onGameOver?.(this.ctx.state.score, this.ctx.state.waveIndex);
      }
    }
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
        let color = slot.alive ? slot.color : EMPTY_CELL_COLOR;
        let hpRef: { hp: number; maxHp: number } | undefined;
        if (slot.alive && slot.entityId !== null) {
          const hp = this.ctx.world.get(slot.entityId, Health);
          if (hp && hp.maxHp > 0) {
            hpRef = hp;
            if (hp.hp < hp.maxHp) color = darkenColor(slot.color, hp.hp / hp.maxHp);
          }
        }
        drawRoundedCell(main, cx, row.y, CELL, color);
        if (hpRef && hpRef.maxHp > 1 && hpRef.hp < hpRef.maxHp) {
          drawHpPips(main, cx, row.y - CELL / 2 - 5, hpRef.hp, hpRef.maxHp);
        }
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

    const total = this.ctx.level.waves.reduce((n, w) => n + w.enemies.length, 0);
    const unspawned = this.ctx.level.waves
      .slice(this.ctx.state.waveIndex)
      .reduce((n, w) => n + w.enemies.length, 0);
    const aliveNow = this.ctx.rows.reduce(
      (n, row) => n + row.cells.filter((c) => c.alive).length,
      0,
    );
    const defeated = Math.max(0, total - unspawned - aliveNow);
    drawContributorPanel(main, this.ctx.level.profile, { defeated, total });

    drawInstructions(main, this.atlas, isTouchDevice());
    if (this.ctx.state.chaosActive?.kind === 'CI_FAILED') {
      main.fillStyle = 'rgba(248, 81, 73, 0.10)';
      main.fillRect(0, 0, BALANCE.viewportWidth, BALANCE.viewportHeight);
    }
    r.endFrame();
  }
}

function darkenColor(color: string, hpFraction: number): string {
  const h = color.startsWith('#') ? color.slice(1) : color;
  if (h.length !== 6) return color;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = (1 - Math.max(0, Math.min(1, hpFraction))) * 0.75;
  const mix = (c: number, dst: number) => Math.round(c * (1 - t) + dst * t);
  const nr = mix(r, 13);
  const ng = mix(g, 17);
  const nb = mix(b, 23);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(nr)}${hex(ng)}${hex(nb)}`;
}

function drawHpPips(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hp: number,
  maxHp: number,
): void {
  const clamped = Math.max(0, Math.min(maxHp, hp));
  const barW = 22;
  const barH = 3;
  const x = cx - barW / 2;
  const y = cy - barH / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
  ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
  const fillW = Math.max(0, (clamped / maxHp) * barW);
  const frac = clamped / maxHp;
  ctx.fillStyle = frac > 0.6 ? '#39d353' : frac > 0.3 ? '#d29922' : '#f85149';
  ctx.fillRect(x, y, fillW, barH);
  ctx.restore();
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

function drawInstructions(ctx: CanvasRenderingContext2D, atlas: SpriteAtlas, mobile = false): void {
  if (mobile) {
    drawInstructionsMobile(ctx, atlas);
    return;
  }
  const boxX = 576;
  const boxY = 76;
  const boxW = 360;
  const boxH = 344;
  const padX = 18;
  const padY = 16;
  const contentX = boxX + padX;

  ctx.save();

  ctx.fillStyle = 'rgba(22, 27, 34, 0.70)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('HOW TO PLAY', contentX, boxY + padY + 2);

  let y = boxY + padY + 26;
  ctx.font = '12px ui-monospace, Menlo, monospace';
  const controls: Array<[string, string]> = [
    ['\u2190 \u2192 / A D', 'move'],
    ['SPACE', 'fire'],
    ['X', 'bomb (1/level)'],
    ['ESC', 'pause'],
  ];
  for (const [key, desc] of controls) {
    ctx.fillStyle = '#58a6ff';
    ctx.fillText(key, contentX, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(desc, contentX + 110, y);
    y += 18;
  }

  y += 14;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('POWER-UPS  (auto on pickup)', contentX, y);
  y += 22;

  const effects: Record<string, string> = {
    revert:    'heal +1 HP',
    fork:      'triple shot 8s',
    rebase:    'slow enemies 5s',
    squash:    'next shot pierces',
    forcepush: '+1 bomb (X)',
  };
  ctx.font = '12px ui-monospace, Menlo, monospace';
  const iconScale = 0.6;
  for (const def of POWERUPS) {
    const iconCx = contentX + 10;
    const iconCy = y - 4;
    if (atlas.has(def.sprite)) {
      atlas.draw(ctx, def.sprite, iconCx, iconCy, iconScale);
    } else {
      ctx.fillStyle = def.color;
      ctx.fillRect(contentX, y - 12, 14, 14);
    }
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(def.label, contentX + 28, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(effects[def.kind] ?? '', contentX + 140, y);
    y += 22;
  }

  y += 6;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('squash = queued; fires on', contentX, y); y += 12;
  ctx.fillText('your next SPACE shot', contentX, y);

  ctx.restore();
}

function drawInstructionsMobile(ctx: CanvasRenderingContext2D, atlas: SpriteAtlas): void {
  const W = BALANCE.viewportWidth;
  const boxW = 200;
  const boxX = W - boxW - 20;
  const boxY = 96;
  const boxH = 200;
  const padX = 12;
  const contentX = boxX + padX;

  ctx.save();

  ctx.fillStyle = 'rgba(22, 27, 34, 0.70)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.fillText('POWER-UPS', contentX, boxY + 14);

  let y = boxY + 30;
  const effects: Record<string, string> = {
    revert:    '+1 HP',
    fork:      'triple shot',
    rebase:    'slow enemies',
    squash:    'pierce shot',
    forcepush: '+1 bomb (X)',
  };
  ctx.font = '11px ui-monospace, Menlo, monospace';
  const iconScale = 0.5;
  for (const def of POWERUPS) {
    const iconCx = contentX + 8;
    const iconCy = y - 4;
    if (atlas.has(def.sprite)) {
      atlas.draw(ctx, def.sprite, iconCx, iconCy, iconScale);
    } else {
      ctx.fillStyle = def.color;
      ctx.fillRect(contentX, y - 10, 12, 12);
    }
    ctx.fillStyle = '#c9d1d9';
    ctx.fillText(def.label, contentX + 22, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(effects[def.kind] ?? '', contentX + 100, y);
    ctx.font = '11px ui-monospace, Menlo, monospace';
    y += 20;
  }

  ctx.restore();
}

function drawGridHeader(ctx: CanvasRenderingContext2D, totalCommits: number, weeksSeen: number): void {
  ctx.save();
  const cx = GRID_LEFT + GRID_WIDTH / 2;
  ctx.fillStyle = '#c9d1d9';
  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${totalCommits.toLocaleString()} contributions in the last year`,
    cx, 30,
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(`weeks defended: ${weeksSeen}`, cx, 46);

  const legendX = cx - 32;
  const legendY = 58;
  const legendCell = 10;
  const legendGap = 3;
  ctx.fillStyle = '#ffffff';
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
