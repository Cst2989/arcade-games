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
  readonly main: CanvasRenderingContext2D;
  private layers: InternalLayer[] = [];
  private byName = new Map<LayerName, InternalLayer>();

  constructor(private target: HTMLCanvasElement) {
    this.width = target.width;
    this.height = target.height;
    const ctx = target.getContext('2d');
    if (!ctx) throw new Error('Renderer: failed to acquire 2D context on target canvas');
    this.main = ctx;
  }

  addLayer(cfg: LayerConfig): void {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`Renderer: failed to acquire 2D context for layer "${cfg.name}"`);
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
        this.main.drawImage(l.canvas, 0, 0);
        this.main.filter = 'none';
        this.main.globalCompositeOperation = 'source-over';
        this.main.drawImage(l.canvas, 0, 0);
        this.main.restore();
      } else {
        this.main.drawImage(l.canvas, 0, 0);
      }
    }
  }
}
