import type { GitHubRelease } from './github-client.js';

export interface ReleaseCard {
  tag: string;
  title: string;
  date: string;
  summary: string;
}

const MAJOR_VERSION_RE = /^v?(\d+)\.(\d+)(?:\.(\d+))?/;

function isMajor(tag: string): boolean {
  const m = tag.match(MAJOR_VERSION_RE);
  if (!m) return false;
  const minor = Number(m[2] ?? '0');
  const patch = Number(m[3] ?? '0');
  return minor === 0 && patch === 0;
}

function cleanSummary(body: string | null, fallbackName: string | null, tag: string): string {
  const raw = (body ?? fallbackName ?? '').trim();
  if (!raw) return `Released ${tag}`;
  // Strip markdown artifacts that look bad in a monospace canvas.
  const stripped = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ');
  return stripped.slice(0, 320);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toCard(r: GitHubRelease): ReleaseCard {
  return {
    tag: r.tag_name,
    title: (r.name || r.tag_name).trim(),
    date: formatDate(r.published_at),
    summary: cleanSummary(r.body, r.name, r.tag_name),
  };
}

export function pickReleaseCards(
  releases: GitHubRelease[],
  count: number,
  repoFullName: string,
): ReleaseCard[] {
  const real = releases.filter((r) => !r.prerelease);
  const majors = real.filter((r) => isMajor(r.tag_name));
  const pool = majors.length >= count ? majors : real;

  if (pool.length === 0) {
    return Array.from({ length: count }, (_, i) => ({
      tag: `v${i + 1}.0.0`,
      title: `${repoFullName} milestone`,
      date: '',
      summary: 'No public releases yet — every commit is a story.',
    }));
  }

  // Spread picks evenly across the pool so we don't repeat the same release.
  const cards: ReleaseCard[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i * pool.length) / count);
    cards.push(toCard(pool[idx]!));
  }
  return cards;
}
