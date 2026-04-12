declare function gtag(...args: unknown[]): void;

const utmParams = (() => {
  const p = new URLSearchParams(window.location.search);
  const source = p.get('utm_source') ?? '';
  const medium = p.get('utm_medium') ?? '';
  const campaign = p.get('utm_campaign') ?? '';
  return { utm_source: source, utm_medium: medium, utm_campaign: campaign };
})();

function send(event: string, params: Record<string, unknown>): void {
  if (typeof gtag === 'function') {
    gtag('event', event, { ...utmParams, ...params });
  }
}

export function trackGameStart(repo: string): void {
  send('game_start', { repo });
}

export function trackLevelComplete(repo: string, level: number, score: number): void {
  send('level_complete', { repo, level, score });
}

export function trackBossDefeated(repo: string, score: number): void {
  send('boss_defeated', { repo, score });
}

export function trackGameOver(repo: string, level: number, score: number): void {
  send('game_over', { repo, level, score });
}

export function trackShare(repo: string, method: string): void {
  send('share', { repo, method });
}

export function trackVictory(repo: string, finalScore: number): void {
  send('victory', { repo, final_score: finalScore });
}
