import { Scene } from './scene.js';

export class SceneManager {
  private stack: Scene[] = [];

  push(s: Scene): void {
    const prev = this.top();
    prev?.onPause();
    this.stack.push(s);
    s.onEnter();
  }

  pop(): void {
    const s = this.stack.pop();
    s?.onExit();
    this.top()?.onResume();
  }

  replace(s: Scene): void {
    const old = this.stack.pop();
    old?.onExit();
    this.stack.push(s);
    s.onEnter();
  }

  top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  update(dt: number): void {
    this.top()?.update(dt);
  }

  render(alpha: number): void {
    for (const s of this.stack) s.render(alpha);
  }

  clear(): void {
    while (this.stack.length) this.pop();
  }
}
