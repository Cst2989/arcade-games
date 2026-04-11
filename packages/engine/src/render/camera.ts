export class Camera {
  x = 0;
  y = 0;
  shakeOffsetX = 0;
  shakeOffsetY = 0;

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x + this.shakeOffsetX, y: wy - this.y + this.shakeOffsetY };
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-this.x + this.shakeOffsetX, -this.y + this.shakeOffsetY);
  }

  restore(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}
