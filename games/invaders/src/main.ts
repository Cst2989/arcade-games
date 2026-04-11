import {
  Renderer, GameLoop, Keyboard, InputMap, SceneManager,
  SpriteAtlas, ParticleEmitter, ScreenShake, AudioBus, Sfx,
} from '@osi/engine';

import { BALANCE } from './config/balance.js';
import { getMockRepoData } from './data/mock-data.js';
import { contributorToLevel, type Level } from './data/mapping.js';
import { extractChunks, type Chunk } from './data/knowledge-extractor.js';

import { TitleScene } from './scenes/title.js';
import { LoadingScene } from './scenes/loading.js';
import { LevelIntroScene } from './scenes/level-intro.js';
import { GameplayScene, type GameplayDeps } from './scenes/gameplay.js';
import { BossIntroScene } from './scenes/boss-intro.js';
import { BossScene } from './scenes/boss.js';
import { VictoryScene } from './scenes/victory.js';
import { PauseScene } from './scenes/pause.js';
import { GameOverScene } from './scenes/game-over.js';
import { LevelCompleteScene } from './scenes/level-complete.js';

const BASE = import.meta.env.BASE_URL;
const assetUrl = (p: string) => `${BASE}${p.replace(/^\/+/, '')}`;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const gameLoop = new GameLoop({ fixedDt: BALANCE.fixedDt, maxStepsPerFrame: 5 });
const kb = new Keyboard();
kb.attach(window);
const input = new InputMap(kb);
input
  .bind('left', ['ArrowLeft', 'KeyA'])
  .bind('right', ['ArrowRight', 'KeyD'])
  .bind('fire', ['Space'])
  .bind('bomb', ['KeyX'])
  .bind('pause', ['Escape']);

const screenShake = new ScreenShake({ maxAmplitude: 24 });

const particles = {
  sparks: new ParticleEmitter({ capacity: BALANCE.particleCapacities.sparks, drawColor: '#ffd866', drawSize: 2 }),
  explosions: new ParticleEmitter({ capacity: BALANCE.particleCapacities.explosions, drawColor: '#f85149', drawSize: 3, gravity: 40 }),
  bigExplosions: new ParticleEmitter({ capacity: BALANCE.particleCapacities.bigExplosions, drawColor: '#ff7b72', drawSize: 5, gravity: 20 }),
  stars: new ParticleEmitter({ capacity: BALANCE.particleCapacities.stars, drawColor: '#30363d', drawSize: 1 }),
  powerupDust: new ParticleEmitter({ capacity: BALANCE.particleCapacities.powerupDust, drawColor: '#d2a8ff', drawSize: 2 }),
};

const atlas = new SpriteAtlas();
const audio = new AudioBus();
const sfx = new Sfx(audio);

const sceneManager = new SceneManager();
gameLoop.onUpdate = (dt) => sceneManager.update(dt);
gameLoop.onRender = (alpha) => {
  sceneManager.render(alpha);
  kb.endFrame();
};

async function boot(): Promise<void> {
  try {
    await atlas.load(
      assetUrl('assets/kenney-space-shooter/sheet.png'),
      assetUrl('assets/kenney-space-shooter/sheet.xml'),
    );
    console.log('[invaders] atlas loaded');
  } catch (err) {
    console.warn('[invaders] sprite atlas missing — falling back to colored rects', err);
  }

  await audio.init();
  try {
    await sfx.load({
      shoot: assetUrl('assets/sfx/shoot.wav'),
      enemy_shoot: assetUrl('assets/sfx/enemy_shoot.wav'),
      hit_soft: assetUrl('assets/sfx/hit_soft.wav'),
      hit_hard: assetUrl('assets/sfx/hit_hard.wav'),
      explode_small: assetUrl('assets/sfx/explode_small.wav'),
      explode_big: assetUrl('assets/sfx/explode_big.wav'),
      powerup_drop: assetUrl('assets/sfx/powerup_drop.wav'),
      powerup_get: assetUrl('assets/sfx/powerup_get.wav'),
      level_up: assetUrl('assets/sfx/level_up.wav'),
      boss_phase: assetUrl('assets/sfx/boss_phase.wav'),
      boss_roar: assetUrl('assets/sfx/boss_roar.wav'),
      boss_die: assetUrl('assets/sfx/boss_die.wav'),
      ui_hover: assetUrl('assets/sfx/ui_hover.wav'),
      ui_click: assetUrl('assets/sfx/ui_click.wav'),
    });
    console.log('[invaders] sfx loaded');
  } catch (err) {
    console.warn('[invaders] sfx load failed', err);
  }

  const unlockAudio = () => {
    audio.unlock();
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
  };
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  const title = new TitleScene(renderer, particles.stars, (repo) => startGame(repo));
  sceneManager.push(title);
  gameLoop.start();
}

function startGame(repoFullName: string): void {
  const loading = new LoadingScene(renderer, atlas, particles.stars, kb);
  sceneManager.replace(loading);
  loading.setProgress(0.1, 'mocking the repo');

  const data = getMockRepoData(repoFullName);
  loading.setProgress(0.5, 'building levels');

  const levels: Level[] = data.contributors.slice(0, 5).map((stats, idx) =>
    contributorToLevel(
      stats,
      { id: stats.login, login: stats.login, name: stats.login },
      idx,
    ),
  );
  const chunks: Chunk[] = extractChunks(data.readme, repoFullName);
  loading.setProgress(1, 'ready');

  setTimeout(() => launchLevel(0, levels, chunks, data.contributors[0]!.login), 600);
}

function launchLevel(
  levelIndex: number,
  levels: Level[],
  chunks: Chunk[],
  bossLogin: string,
): void {
  const level = levels[levelIndex]!;
  const chunk = chunks[levelIndex % Math.max(chunks.length, 1)] ?? {
    kind: 'FACT' as const,
    text: 'Ship it.',
    source: 'readme',
  };

  const intro = new LevelIntroScene(
    renderer,
    kb,
    levelIndex,
    {
      login: level.contributor.login,
      avatarUrl: level.contributor.avatar ?? '',
      totalCommits: level.contributor.totalCommits ?? 0,
      rank: levelIndex + 1,
    },
    chunk,
    () => {
      const deps: GameplayDeps = { input, gameLoop, sfx, screenShake, particles };
      let currentScene: GameplayScene | null = null;
      const gameplay = new GameplayScene(
        renderer,
        atlas,
        level,
        levelIndex,
        deps,
        () => onLevelCleared(levelIndex, levels, chunks, bossLogin, currentScene?.ctx.state.score ?? 0),
        (score, wave) => {
          const over = new GameOverScene(renderer, score, wave, () => {
            launchLevel(levelIndex, levels, chunks, bossLogin);
          });
          sceneManager.replace(over);
        },
      );
      currentScene = gameplay;
      sceneManager.replace(gameplay);
    },
  );
  sceneManager.replace(intro);
}

function onLevelCleared(
  levelIndex: number,
  levels: Level[],
  chunks: Chunk[],
  bossLogin: string,
  score: number,
): void {
  sfx.play('level_up');
  const level = levels[levelIndex]!;
  const nextIndex = levelIndex + 1;
  const hasNextLevel = nextIndex < levels.length;
  const nextLabel = hasNextLevel ? 'NEXT LEVEL' : 'BOSS FIGHT';

  const complete = new LevelCompleteScene(
    renderer,
    level.profile,
    score,
    nextLabel,
    () => {
      if (hasNextLevel) {
        launchLevel(nextIndex, levels, chunks, bossLogin);
        return;
      }
      const bossLevel = levels[levels.length - 1]!;
      const bossIntro = new BossIntroScene(renderer, bossLogin, () => {
        const deps: GameplayDeps = { input, gameLoop, sfx, screenShake, particles };
        const boss = new BossScene(renderer, atlas, bossLevel, levels.length - 1, deps, () => {
          const victory = new VictoryScene(renderer, bossLogin, 0, () => {
            sceneManager.clear();
            sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r)));
          });
          sceneManager.replace(victory);
        });
        sceneManager.replace(boss);
      });
      sceneManager.replace(bossIntro);
    },
  );
  sceneManager.replace(complete);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const top = sceneManager.top();
    if (top instanceof GameplayScene || top instanceof BossScene) {
      sceneManager.push(new PauseScene(renderer, gameLoop, () => sceneManager.pop()));
    }
  }
});

void boot();
