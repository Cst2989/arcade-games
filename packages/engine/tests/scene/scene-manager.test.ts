import { expect, test } from 'vitest';
import { Scene } from '../../src/scene/scene.js';
import { SceneManager } from '../../src/scene/scene-manager.js';

class LogScene extends Scene {
  constructor(public label: string, public log: string[]) {
    super();
  }
  override onEnter(): void {
    this.log.push(`enter:${this.label}`);
  }
  override onExit(): void {
    this.log.push(`exit:${this.label}`);
  }
  override update(dt: number): void {
    this.log.push(`update:${this.label}:${dt}`);
  }
}

test('push fires onEnter, replace fires onExit then onEnter', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('a', log));
  mgr.replace(new LogScene('b', log));
  expect(log).toEqual(['enter:a', 'exit:a', 'enter:b']);
});

test('update only calls top scene by default', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('bg', log));
  mgr.push(new LogScene('top', log));
  mgr.update(0.016);
  expect(log.filter((x) => x.startsWith('update'))).toEqual(['update:top:0.016']);
});

test('pop re-enters underneath scene as top', () => {
  const log: string[] = [];
  const mgr = new SceneManager();
  mgr.push(new LogScene('a', log));
  mgr.push(new LogScene('b', log));
  mgr.pop();
  mgr.update(0.016);
  expect(log).toContain('exit:b');
  expect(log).toContain('update:a:0.016');
});
