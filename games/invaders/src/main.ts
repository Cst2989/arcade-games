import {
  Renderer, GameLoop, Keyboard, InputMap, SceneManager,
  SpriteAtlas, ParticleEmitter, ScreenShake, AudioBus, Sfx,
} from '@osi/engine';

import { BALANCE } from './config/balance.js';
import { getMockRepoData } from './data/mock-data.js';
import { contributorToLevel, type Level } from './data/mapping.js';
import type { ContributorStats } from './data/contributor-stats.js';
import { aggregateDaily, pickBiggestCommit } from './data/contributor-stats.js';
import {
  getRepo, getContributors, getUser, getCommitsForAuthor,
  withCache, GitHubRateLimitError,
  type GitHubUser,
} from './data/github-client.js';
import { promptForToken } from './ui/token-prompt.js';
import { createGameStats, type GameStats } from './scenes/gameplay-context.js';

import { TitleScene } from './scenes/title.js';
import { DeepLinkIntroScene } from './scenes/deep-link-intro.js';
import { LoadingScene } from './scenes/loading.js';
import { LevelIntroScene } from './scenes/level-intro.js';
import { GameplayScene, type GameplayDeps } from './scenes/gameplay.js';
import { BossIntroScene } from './scenes/boss-intro.js';
import { BossScene } from './scenes/boss.js';
import { VictoryScene } from './scenes/victory.js';
import { PauseScene } from './scenes/pause.js';
import { GameOverScene } from './scenes/game-over.js';
import { LevelCompleteScene } from './scenes/level-complete.js';
import { CanvasScaler } from './ui/canvas-scaler.js';
import { TouchControls } from './ui/touch-controls.js';
import { isTouchDevice } from './ui/touch-detect.js';
import { trackGameStart, trackLevelComplete, trackBossDefeated, trackGameOver, trackVictory } from './ui/analytics.js';

const BASE = import.meta.env.BASE_URL;
const assetUrl = (p: string) => `${BASE}${p.replace(/^\/+/, '')}`;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const scaler = new CanvasScaler(canvas);
const touch = isTouchDevice();
const touchControls = touch ? new TouchControls(scaler) : null;
if (touchControls) touchControls.mount();

window.addEventListener('resize', () => {
  touchControls?.reposition();
});
window.addEventListener('orientationchange', () => {
  touchControls?.reposition();
});

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
      level_complete: assetUrl('assets/sfx/level_complete.wav'),
      game_over: assetUrl('assets/sfx/game_over.wav'),
    });
    console.log('[invaders] sfx loaded');
  } catch (err) {
    console.warn('[invaders] sfx load failed', err);
  }

  const unlockAudio = () => {
    audio.unlock();
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
  };
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
  window.addEventListener('click', unlockAudio);

  const params = new URLSearchParams(window.location.search);

  (window as unknown as { __osiShowTokenModal?: () => void }).__osiShowTokenModal = () =>
    promptForToken({
      onSave: () => console.log('[invaders] token-modal demo: saved'),
      onCancel: () => console.log('[invaders] token-modal demo: cancelled'),
    });

  if (params.get('test') === 'modal') {
    promptForToken({
      onSave: () => console.log('[invaders] token-modal demo: saved'),
      onCancel: () => console.log('[invaders] token-modal demo: cancelled'),
    });
  }

  const deepLink = params.get('repo') ?? params.get('load');
  const hasValidDeepLink = deepLink !== null && /^[\w.-]+\/[\w.-]+$/.test(deepLink);

  if (hasValidDeepLink) {
    const intro = new DeepLinkIntroScene(
      renderer,
      deepLink,
      particles.stars,
      sfx,
      audio,
      () => startGame(deepLink),
      touch,
    );
    sceneManager.push(intro);
  } else {
    const title = new TitleScene(renderer, particles.stars, (repo) => startGame(repo), audio, touch);
    sceneManager.push(title);
  }

  gameLoop.start();
}

function startGame(repoFullName: string): void {
  trackGameStart(repoFullName);
  const loading = new LoadingScene(renderer, atlas, particles.stars, kb);
  sceneManager.replace(loading);
  void loadRealRepo(repoFullName, loading).catch((err) => {
    console.error('[invaders] real-data load failed, using mock', err);
    if (err instanceof GitHubRateLimitError) {
      promptForToken({
        onSave: () => startGame(repoFullName),
        onCancel: () => startGameFromMock(repoFullName, loading),
      });
      return;
    }
    startGameFromMock(repoFullName, loading);
  });
}

async function loadRealRepo(repoFullName: string, loading: LoadingScene): Promise<void> {
  const [owner, name] = repoFullName.split('/');
  if (!owner || !name) {
    startGameFromMock(repoFullName, loading);
    return;
  }

  loading.setProgress(0.05, 'fetching repo metadata');
  const repo = await withCache(`repo:${owner}/${name}`, () => getRepo(owner, name));

  loading.setProgress(0.15, 'fetching contributors');
  const contribs = await withCache(
    `contribs:${owner}/${name}`,
    () => getContributors(owner, name),
  );
  if (contribs.length === 0) throw new Error('no contributors returned');

  // Fetch commits for top 10 by GitHub's all-time count, then re-rank by last-year
  // total so the boss is whoever's been most active this past year.
  const candidates = contribs.slice(0, 10);
  const sinceIso = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

  interface Ranked {
    stats: ContributorStats;
    user: GitHubUser | null;
    avatarImage: HTMLImageElement | null;
    recentTotal: number;
  }

  const ranked: Ranked[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    loading.setProgress(
      0.15 + 0.45 * (i / candidates.length),
      `fetching commits for ${c.login}`,
    );
    const commits = await withCache(
      `commits:${owner}/${name}/${c.login}`,
      () => getCommitsForAuthor(owner, name, c.login, sinceIso),
    );
    const daily = aggregateDaily(commits);
    const recentTotal = daily.reduce((n, d) => n + d.count, 0);
    const biggestCommit = pickBiggestCommit(commits);

    const user = await withCache(`user:${c.login}`, () => getUser(c.login))
      .catch(() => null);
    const avatarUrl = user?.avatar_url ?? c.avatar_url;
    const avatarImage = await loadImage(avatarUrl).catch(() => null);

    const stats: ContributorStats = {
      login: c.login,
      avatarUrl,
      totalCommits: recentTotal,
      daily,
      ...(biggestCommit ? { biggestCommit } : {}),
    };
    ranked.push({ stats, user, avatarImage, recentTotal });
  }

  // Sort by recent commits DESC and keep top 5. The #1 recent committer becomes the boss.
  ranked.sort((a, b) => b.recentTotal - a.recentTotal);
  const top5 = ranked.filter((r) => r.recentTotal > 0).slice(0, 5);
  if (top5.length === 0) throw new Error('no recent contributors');

  // Level order = weakest → strongest: reverse so levels[0] = rank #5, levels[N-1] = boss.
  const ordered = [...top5].reverse();
  const levels: Level[] = ordered.map(({ stats, user, avatarImage }, idx) =>
    contributorToLevel(
      stats,
      { id: stats.login, login: stats.login, name: stats.login },
      idx,
      {
        ...(user ? { user } : {}),
        ...(repo.language ? { language: repo.language } : {}),
        ...(avatarImage ? { avatarImage } : {}),
      },
    ),
  );
  const ranks = ordered.map((_, idx) => ordered.length - idx);

  loading.setProgress(1, 'ready');
  const stats = createGameStats();
  setTimeout(() => launchLevel(0, levels, ranks, repoFullName, stats), 400);
}

function startGameFromMock(repoFullName: string, loading: LoadingScene): void {
  loading.setProgress(0.1, 'using mock data (offline)');
  const data = getMockRepoData(repoFullName);
  loading.setProgress(0.5, 'building levels');
  const levels: Level[] = data.contributors.slice(0, 5).map((stats, idx) =>
    contributorToLevel(
      stats,
      { id: stats.login, login: stats.login, name: stats.login },
      idx,
    ),
  );
  const ranks = levels.map((_, idx) => levels.length - idx);
  loading.setProgress(1, 'ready');
  const stats = createGameStats();
  setTimeout(
    () => launchLevel(0, levels, ranks, repoFullName, stats),
    600,
  );
}

function launchLevel(
  levelIndex: number,
  levels: Level[],
  ranks: number[],
  repoFullName: string,
  stats: GameStats,
): void {
  const level = levels[levelIndex]!;
  const rank = ranks[levelIndex] ?? levelIndex + 1;
  const isBossLevel = levelIndex === levels.length - 1;

  const intro = new LevelIntroScene(
    renderer,
    levelIndex,
    rank,
    level.profile,
    isBossLevel,
    () => {
      const deps: GameplayDeps = { input, gameLoop, sfx, screenShake, particles, stats };
      if (isBossLevel) {
        const bossIntro = new BossIntroScene(renderer, level.contributor.login, () => {
          let bossRef: BossScene | null = null;
          const boss = new BossScene(
            renderer,
            atlas,
            level,
            levelIndex,
            deps,
            () => {
              const levelScore = bossRef?.ctx.state.score ?? 0;
              stats.totalScore += levelScore;
              stats.levelsCompleted += 1;
              trackBossDefeated(repoFullName, stats.totalScore);
              trackVictory(repoFullName, stats.totalScore);
              const victory = new VictoryScene(renderer, repoFullName, stats, levels, () => {
                sceneManager.clear();
                sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r), audio, touch));
              }, touch);
              sceneManager.replace(victory);
            },
            (score, wave) => {
              trackGameOver(repoFullName, levelIndex, score);
              const over = new GameOverScene(renderer, score, wave, sfx, () => {
                launchLevel(levelIndex, levels, ranks, repoFullName, stats);
              }, touch);
              sceneManager.replace(over);
            },
          );
          bossRef = boss;
          sceneManager.replace(boss);
        });
        sceneManager.replace(bossIntro);
        return;
      }

      let currentScene: GameplayScene | null = null;
      const gameplay = new GameplayScene(
        renderer,
        atlas,
        level,
        levelIndex,
        deps,
        () => onLevelCleared(
          levelIndex, levels, ranks, repoFullName, stats,
          currentScene?.ctx.state.score ?? 0,
        ),
        (score, wave) => {
          trackGameOver(repoFullName, levelIndex, score);
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
          }, touch);
          sceneManager.replace(over);
        },
      );
      currentScene = gameplay;
      sceneManager.replace(gameplay);
    },
    touch,
  );
  sceneManager.replace(intro);
}

function onLevelCleared(
  levelIndex: number,
  levels: Level[],
  ranks: number[],
  repoFullName: string,
  stats: GameStats,
  levelScore: number,
): void {
  sfx.play('level_up');
  stats.totalScore += levelScore;
  stats.levelsCompleted += 1;
  trackLevelComplete(repoFullName, levelIndex + 1, stats.totalScore);
  const level = levels[levelIndex]!;
  const nextIndex = levelIndex + 1;
  const isBossNext = nextIndex === levels.length - 1;
  const nextLabel = isBossNext ? 'BOSS FIGHT' : 'NEXT LEVEL';

  const complete = new LevelCompleteScene(
    renderer,
    level.profile,
    levelScore,
    stats.totalScore,
    nextLabel,
    sfx,
    levelIndex,
    repoFullName,
    () => launchLevel(nextIndex, levels, ranks, repoFullName, stats),
  );
  sceneManager.replace(complete);
}

function pauseIfPlaying(): void {
  const top = sceneManager.top();
  if (top instanceof GameplayScene || top instanceof BossScene) {
    sceneManager.push(new PauseScene(renderer, gameLoop, () => sceneManager.pop(), touch));
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') pauseIfPlaying();
});

if (touch) {
  const mql = window.matchMedia('(orientation: portrait)');
  mql.addEventListener('change', (e) => {
    if (e.matches) pauseIfPlaying();
  });
}

void boot();
