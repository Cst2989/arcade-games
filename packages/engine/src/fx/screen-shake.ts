import { perlin1 } from '../util/perlin.js';
import { clamp } from '../util/math.js';

export interface ShakeOptions {
  amplitude: number;
  duration: number;
}

interface ActiveShake {
  amp: number;
  remaining: number;
  total: number;
  seedX: number;
  seedY: number;
}

export interface ScreenShakeConfig {
  maxAmplitude: number;
}

export class ScreenShake {
  offsetX = 0;
  offsetY = 0;
  private shakes: ActiveShake[] = [];
  private t = 0;

  constructor(private cfg: ScreenShakeConfig) {}

  add(opts: ShakeOptions): void {
    if (opts.duration <= 0) return;
    this.shakes.push({
      amp: opts.amplitude,
      remaining: opts.duration,
      total: opts.duration,
      seedX: Math.random() * 1000,
      seedY: Math.random() * 1000,
    });
  }

  update(dt: number): void {
    this.t += dt;
    let sx = 0;
    let sy = 0;
    const next: ActiveShake[] = [];
    for (const s of this.shakes) {
      s.remaining -= dt;
      if (s.remaining <= 0) continue;
      const decay = s.remaining / s.total;
      const amp = s.amp * decay * decay;
      sx += perlin1(s.seedX + this.t * 25) * amp;
      sy += perlin1(s.seedY + this.t * 25) * amp;
      next.push(s);
    }
    this.shakes = next;
    this.offsetX = clamp(sx, -this.cfg.maxAmplitude, this.cfg.maxAmplitude);
    this.offsetY = clamp(sy, -this.cfg.maxAmplitude, this.cfg.maxAmplitude);
  }

  activeCount(): number {
    return this.shakes.length;
  }

  clear(): void {
    this.shakes.length = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}
