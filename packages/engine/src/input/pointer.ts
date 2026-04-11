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
      // Translate client coords into the canvas drawing buffer, so CSS
      // scaling (HiDPI, responsive layouts) does not desync hit-testing.
      const sx = canvas.width / r.width;
      const sy = canvas.height / r.height;
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
