const PERM: number[] = (() => {
  const p: number[] = new Array(512);
  const base: number[] = [];
  for (let i = 0; i < 256; i++) base.push(i);
  // Fisher-Yates with fixed seed for determinism
  let seed = 1234567;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) p[i] = base[i % 256]!;
  return p;
})();

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (hash: number, x: number) => ((hash & 1) === 0 ? x : -x);

export function perlin1(x: number): number {
  const xi = Math.floor(x) & 255;
  const xf = x - Math.floor(x);
  const u = fade(xf);
  const a = PERM[xi]!;
  const b = PERM[xi + 1]!;
  return ((1 - u) * grad(a, xf) + u * grad(b, xf - 1));
}
