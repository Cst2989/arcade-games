const ASPECT = 960 / 600;

export class CanvasScaler {
  private rect = { left: 0, top: 0, width: 960, height: 600 };

  constructor(private canvas: HTMLCanvasElement) {
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    (screen.orientation as any)?.lock('landscape').catch(() => {});
  }

  getRect(): { left: number; top: number; width: number; height: number } {
    return this.rect;
  }

  private resize = (): void => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let cssW: number;
    let cssH: number;

    if (vw / vh > ASPECT) {
      cssH = vh;
      cssW = vh * ASPECT;
    } else {
      cssW = vw;
      cssH = vw / ASPECT;
    }

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const domRect = this.canvas.getBoundingClientRect();
    this.rect = {
      left: domRect.left,
      top: domRect.top,
      width: domRect.width,
      height: domRect.height,
    };
  };

  destroy(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
  }
}
