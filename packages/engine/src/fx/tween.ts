export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

export interface TweenOptions {
  duration: number;
  easing?: (t: number) => number;
  loop?: boolean;
  onComplete?: () => void;
}

export class Tween<T extends Record<string, number>> {
  done = false;
  private elapsed = 0;
  private start: Partial<T> = {};
  private completedFired = false;

  constructor(
    private target: T,
    private to: Partial<T>,
    private opts: TweenOptions,
  ) {
    for (const k of Object.keys(to)) {
      (this.start as Record<string, number>)[k] = target[k as keyof T] as number;
    }
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const raw = this.elapsed / this.opts.duration;
    if (raw >= 1 && !this.opts.loop) {
      for (const k of Object.keys(this.to)) {
        (this.target as Record<string, number>)[k] = this.to[k as keyof T] as number;
      }
      this.done = true;
      if (!this.completedFired) {
        this.completedFired = true;
        this.opts.onComplete?.();
      }
      return;
    }
    const t = this.opts.loop ? raw - Math.floor(raw) : Math.min(raw, 1);
    const ease = (this.opts.easing ?? Easing.linear)(t);
    for (const k of Object.keys(this.to)) {
      const s = (this.start as Record<string, number>)[k]!;
      const e = this.to[k as keyof T] as number;
      (this.target as Record<string, number>)[k] = s + (e - s) * ease;
    }
  }
}
