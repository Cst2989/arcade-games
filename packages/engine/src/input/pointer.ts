export class Pointer {
  x = 0;
  y = 0;
  down = false;
  clickedThisFrame = false;

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.x = e.clientX - r.left;
      this.y = e.clientY - r.top;
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
