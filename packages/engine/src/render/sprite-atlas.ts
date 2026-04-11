export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseAtlasXml(xml: string): Map<string, AtlasFrame> {
  const frames = new Map<string, AtlasFrame>();
  const re = /<SubTexture\s+name="([^"]+)"\s+x="(\d+)"\s+y="(\d+)"\s+width="(\d+)"\s+height="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    frames.set(m[1]!, {
      x: Number(m[2]),
      y: Number(m[3]),
      w: Number(m[4]),
      h: Number(m[5]),
    });
  }
  return frames;
}

export class SpriteAtlas {
  private image: HTMLImageElement | null = null;
  private frames: Map<string, AtlasFrame> = new Map();
  private tintCache = new Map<string, HTMLCanvasElement>();

  async load(imageUrl: string, xmlUrl: string): Promise<void> {
    const [img, xml] = await Promise.all([
      loadImage(imageUrl),
      fetch(xmlUrl).then((r) => r.text()),
    ]);
    this.image = img;
    this.frames = parseAtlasXml(xml);
  }

  has(name: string): boolean {
    return this.frames.has(name);
  }

  frame(name: string): AtlasFrame {
    const f = this.frames.get(name);
    if (!f) throw new Error(`sprite not found: ${name}`);
    return f;
  }

  draw(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number, scale = 1): void {
    if (!this.image) return;
    const f = this.frame(name);
    ctx.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      dx - (f.w * scale) / 2,
      dy - (f.h * scale) / 2,
      f.w * scale,
      f.h * scale,
    );
  }

  drawTinted(
    ctx: CanvasRenderingContext2D,
    name: string,
    dx: number,
    dy: number,
    tint: string,
    scale = 1,
  ): void {
    if (!this.image) return;
    const key = `${name}|${tint}`;
    let cached = this.tintCache.get(key);
    if (!cached) {
      const f = this.frame(name);
      cached = document.createElement('canvas');
      cached.width = f.w;
      cached.height = f.h;
      const c = cached.getContext('2d')!;
      c.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = tint;
      c.fillRect(0, 0, f.w, f.h);
      this.tintCache.set(key, cached);
    }
    ctx.drawImage(
      cached,
      dx - (cached.width * scale) / 2,
      dy - (cached.height * scale) / 2,
      cached.width * scale,
      cached.height * scale,
    );
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
