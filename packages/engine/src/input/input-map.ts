import { Keyboard } from './keyboard.js';

export type Action = string;

export class InputMap {
  private bindings = new Map<Action, string[]>();
  constructor(private kb: Keyboard) {}

  bind(action: Action, codes: string[]): this {
    this.bindings.set(action, codes);
    return this;
  }

  isDown(action: Action): boolean {
    const codes = this.bindings.get(action);
    if (!codes) return false;
    return codes.some((c) => this.kb.isDown(c));
  }

  wasPressed(action: Action): boolean {
    const codes = this.bindings.get(action);
    if (!codes) return false;
    return codes.some((c) => this.kb.wasPressed(c));
  }
}
