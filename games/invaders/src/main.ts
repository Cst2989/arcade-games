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
  withCache, GitHubRateLimitError, setToken,
  type GitHubUser,
} from './data/github-client.js';
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
  };
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  const params = new URLSearchParams(window.location.search);
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
    );
    sceneManager.push(intro);
  } else {
    const title = new TitleScene(renderer, particles.stars, (repo) => startGame(repo));
    sceneManager.push(title);
  }

  gameLoop.start();
}

function startGame(repoFullName: string): void {
  const loading = new LoadingScene(renderer, atlas, particles.stars, kb);
  sceneManager.replace(loading);
  void loadRealRepo(repoFullName, loading).catch((err) => {
    console.error('[invaders] real-data load failed, using mock', err);
    if (err instanceof GitHubRateLimitError) {
      promptForToken(() => startGame(repoFullName));
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

function promptForToken(retry: () => void): void {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(13,17,23,0.92);z-index:9999;color:#c9d1d9;font-family:ui-monospace,Menlo,monospace;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#161b22;border:1px solid #30363d;padding:24px;max-width:480px;';

  const h = document.createElement('h2');
  h.style.cssText = 'margin:0 0 12px 0;font-size:16px;';
  h.textContent = 'rate limit hit';

  const p = document.createElement('p');
  p.style.cssText = 'margin:0 0 12px 0;font-size:13px;line-height:1.5;';
  p.append(
    document.createTextNode("GitHub unauth'd API is 60/hr. Paste a personal access token (classic, scope "),
  );
  const code = document.createElement('code');
  code.textContent = 'public_repo';
  p.append(code, document.createTextNode(') to keep going. Stored only in localStorage.'));

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'ghp_...';
  input.style.cssText =
    'width:100%;padding:8px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;box-sizing:border-box;';

  const row = document.createElement('div');
  row.style.cssText = 'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;';

  const cancel = document.createElement('button');
  cancel.textContent = 'cancel';
  cancel.style.cssText =
    'background:#21262d;color:#c9d1d9;border:1px solid #30363d;padding:6px 12px;cursor:pointer;';
  cancel.onclick = () => overlay.remove();

  const save = document.createElement('button');
  save.textContent = 'save';
  save.style.cssText =
    'background:#238636;color:#ffffff;border:1px solid #2ea043;padding:6px 12px;cursor:pointer;';
  save.onclick = () => {
    const val = input.value.trim();
    if (val) setToken(val);
    overlay.remove();
    retry();
  };

  row.append(cancel, save);
  card.append(h, p, input, row);
  overlay.append(card);
  document.body.append(overlay);
  input.focus();
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
              const victory = new VictoryScene(renderer, repoFullName, stats, () => {
                sceneManager.clear();
                sceneManager.push(new TitleScene(renderer, particles.stars, (r) => startGame(r)));
              });
              sceneManager.replace(victory);
            },
            (score, wave) => {
              const over = new GameOverScene(renderer, score, wave, sfx, () => {
                launchLevel(levelIndex, levels, ranks, repoFullName, stats);
              });
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
          const over = new GameOverScene(renderer, score, wave, sfx, () => {
            launchLevel(levelIndex, levels, ranks, repoFullName, stats);
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
  ranks: number[],
  repoFullName: string,
  stats: GameStats,
  levelScore: number,
): void {
  sfx.play('level_up');
  stats.totalScore += levelScore;
  stats.levelsCompleted += 1;
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

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const top = sceneManager.top();
    if (top instanceof GameplayScene || top instanceof BossScene) {
      sceneManager.push(new PauseScene(renderer, gameLoop, () => sceneManager.pop()));
    }
  }
});

void boot();
