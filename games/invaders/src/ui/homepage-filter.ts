export interface FilterableRepo {
  owner: string;
  name: string;
}

export function filterRepos<T extends FilterableRepo>(repos: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return repos;
  return repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(q));
}

export function clampScroll(scroll: number, contentHeight: number, viewportHeight: number): number {
  const max = Math.max(0, contentHeight - viewportHeight);
  if (scroll < 0) return 0;
  if (scroll > max) return max;
  return scroll;
}
