export class Keyboard {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private releasedThisFrame = new Set<string>();
  private onDown = (e: KeyboardEvent) => {
    if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
    this.down.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => {
    if (this.down.has(e.code)) this.releasedThisFrame.add(e.code);
    this.down.delete(e.code);
  };

  attach(target: Window | HTMLElement = window): void {
    target.addEventListener('keydown', this.onDown as EventListener);
    target.addEventListener('keyup', this.onUp as EventListener);
  }

  detach(target: Window | HTMLElement = window): void {
    target.removeEventListener('keydown', this.onDown as EventListener);
    target.removeEventListener('keyup', this.onUp as EventListener);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  wasReleased(code: string): boolean {
    return this.releasedThisFrame.has(code);
  }

  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }
}
