export class Pointer {
  x = 0;
  y = 0;
  down = false;
  clickedThisFrame = false;

  // attach() is one-shot by design — there is no detach(). The engine
  // assumes a single long-lived canvas for the lifetime of the app.
  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      // canvas.width is the physical drawing buffer (logical * dpr). Divide by
      // dpr so hit-testing stays in the game's logical coordinate space.
      const dpr = parseFloat(canvas.dataset.osiDpr ?? '') || (window.devicePixelRatio || 1);
      const sx = canvas.width / dpr / r.width;
      const sy = canvas.height / dpr / r.height;
      this.x = (e.clientX - r.left) * sx;
      this.y = (e.clientY - r.top) * sy;
    });
    canvas.addEventListener('pointerdown', () => {
      this.down = true;
      this.clickedThisFrame = true;
    });
    canvas.addEventListener('pointerup', () => {
      this.down = false;
    });
  }

  endFrame(): void {
    this.clickedThisFrame = false;
  }
}
