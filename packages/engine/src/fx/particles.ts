export interface ParticleSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface ParticleConfig {
  capacity: number;
  gravity?: number;
  drawColor?: string;
  drawSize?: number;
}

const STRIDE = 6; // x, y, vx, vy, life, maxLife

export class ParticleEmitter {
  private data: Float32Array;
  private alive: Uint8Array;
  private cursor = 0;
  private _count = 0;

  constructor(private cfg: ParticleConfig) {
    this.data = new Float32Array(cfg.capacity * STRIDE);
    this.alive = new Uint8Array(cfg.capacity);
  }

  spawn(s: ParticleSpawn): boolean {
    const cap = this.cfg.capacity;
    // linear probe for a free slot, starting at cursor
    for (let i = 0; i < cap; i++) {
      const idx = (this.cursor + i) % cap;
      if (!this.alive[idx]) {
        this.alive[idx] = 1;
        const o = idx * STRIDE;
        this.data[o] = s.x;
        this.data[o + 1] = s.y;
        this.data[o + 2] = s.vx;
        this.data[o + 3] = s.vy;
        this.data[o + 4] = s.life;
        this.data[o + 5] = s.life;
        this.cursor = (idx + 1) % cap;
        this._count++;
        return true;
      }
    }
    return false;
  }

  update(dt: number): void {
    const g = this.cfg.gravity ?? 0;
    const cap = this.cfg.capacity;
    for (let i = 0; i < cap; i++) {
      if (!this.alive[i]) continue;
      const o = i * STRIDE;
      const lifeIdx = o + 4;
      this.data[lifeIdx] = this.data[lifeIdx]! - dt;
      if (this.data[lifeIdx]! <= 0) {
        this.alive[i] = 0;
        this._count--;
        continue;
      }
      this.data[o] = this.data[o]! + this.data[o + 2]! * dt;
      this.data[o + 1] = this.data[o + 1]! + this.data[o + 3]! * dt;
      this.data[o + 3] = this.data[o + 3]! + g * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const color = this.cfg.drawColor ?? '#ffffff';
    const size = this.cfg.drawSize ?? 2;
    const cap = this.cfg.capacity;
    ctx.save();
    for (let i = 0; i < cap; i++) {
      if (!this.alive[i]) continue;
      const o = i * STRIDE;
      const life = this.data[o + 4]! / this.data[o + 5]!;
      ctx.globalAlpha = Math.max(0, life);
      ctx.fillStyle = color;
      ctx.fillRect(this.data[o]! - size / 2, this.data[o + 1]! - size / 2, size, size);
    }
    ctx.restore();
  }

  aliveCount(): number {
    return this._count;
  }

  // Returns [NaN, NaN] when the pool is empty — callers must guard on aliveCount().
  debugFirst(): [number, number] {
    for (let i = 0; i < this.cfg.capacity; i++) {
      if (this.alive[i]) return [this.data[i * STRIDE]!, this.data[i * STRIDE + 1]!];
    }
    return [NaN, NaN];
  }

  clear(): void {
    this.alive.fill(0);
    this._count = 0;
    this.cursor = 0;
  }
}
