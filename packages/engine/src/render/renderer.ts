export type LayerName = string;

export interface LayerConfig {
  name: LayerName;
  postFx?: 'glow' | 'none';
  clear?: boolean;
}

interface InternalLayer extends LayerConfig {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export class Renderer {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly main: CanvasRenderingContext2D;
  private layers: InternalLayer[] = [];
  private byName = new Map<LayerName, InternalLayer>();

  constructor(private target: HTMLCanvasElement) {
    // Logical dimensions come from the canvas's HTML width/height attributes.
    // Internal buffer is scaled by devicePixelRatio so canvas drawing (text in
    // particular) is not bilinear-upscaled to physical pixels by the browser.
    this.width = target.width;
    this.height = target.height;
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    target.width = Math.round(this.width * dpr);
    target.height = Math.round(this.height * dpr);
    if (!target.style.width) target.style.width = `${this.width}px`;
    if (!target.style.height) target.style.height = `${this.height}px`;
    target.dataset.osiDpr = String(dpr);
    const ctx = target.getContext('2d');
    if (!ctx) throw new Error('Renderer: failed to acquire 2D context on target canvas');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.main = ctx;
  }

  addLayer(cfg: LayerConfig): void {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`Renderer: failed to acquire 2D context for layer "${cfg.name}"`);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const layer: InternalLayer = { ...cfg, canvas, ctx };
    this.layers.push(layer);
    this.byName.set(cfg.name, layer);
  }

  layer(name: LayerName): CanvasRenderingContext2D {
    const l = this.byName.get(name);
    if (!l) throw new Error(`layer not registered: ${name}`);
    return l.ctx;
  }

  beginFrame(): void {
    this.main.fillStyle = '#0d1117';
    this.main.fillRect(0, 0, this.width, this.height);
    for (const l of this.layers) {
      if (l.clear !== false) l.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  endFrame(): void {
    for (const l of this.layers) {
      if (l.postFx === 'glow') {
        // ctx.filter is supported on Chrome/Firefox and Safari 18+. On
        // older Safari the blur is silently dropped and glow degrades to
        // a plain additive draw — acceptable graceful fallback.
        this.main.save();
        this.main.globalCompositeOperation = 'lighter';
        this.main.filter = 'blur(6px)';
        this.main.drawImage(l.canvas, 0, 0, this.width, this.height);
        this.main.filter = 'none';
        this.main.globalCompositeOperation = 'source-over';
        this.main.drawImage(l.canvas, 0, 0, this.width, this.height);
        this.main.restore();
      } else {
        this.main.drawImage(l.canvas, 0, 0, this.width, this.height);
      }
    }
  }
}
