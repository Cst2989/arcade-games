export interface GameLoopOptions {
  fixedDt: number;
  maxStepsPerFrame: number;
}

export class GameLoop {
  timeScale = 1;
  onUpdate: ((dt: number) => void) | null = null;
  onRender: ((alpha: number) => void) | null = null;

  private accumulator = 0;
  private lastMs = -1;
  private running = false;
  private rafId = 0;

  constructor(private readonly opts: GameLoopOptions) {}

  tick(nowMs: number): void {
    if (this.lastMs < 0) {
      this.lastMs = nowMs;
      this.onRender?.(0);
      return;
    }
    const frameSec = Math.min((nowMs - this.lastMs) / 1000, 0.25);
    this.lastMs = nowMs;
    this.accumulator += frameSec;

    let steps = 0;
    while (this.accumulator >= this.opts.fixedDt && steps < this.opts.maxStepsPerFrame) {
      this.onUpdate?.(this.opts.fixedDt * this.timeScale);
      this.accumulator -= this.opts.fixedDt;
      steps++;
    }
    if (this.accumulator > this.opts.fixedDt * this.opts.maxStepsPerFrame) {
      this.accumulator = 0; // drop to avoid spiral
    }
    const alpha = this.accumulator / this.opts.fixedDt;
    this.onRender?.(alpha);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.tick(t);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.lastMs = -1;
    this.accumulator = 0;
  }
}
