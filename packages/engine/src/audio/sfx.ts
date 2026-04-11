import { AudioBus } from './audio-bus.js';

export class Sfx {
  private buffers = new Map<string, AudioBuffer>();
  constructor(private bus: AudioBus) {}

  async load(map: Record<string, string>): Promise<void> {
    const entries = await Promise.all(
      Object.entries(map).map(async ([name, url]) => [name, await this.bus.loadBuffer(url)] as const),
    );
    for (const [name, buf] of entries) this.buffers.set(name, buf);
  }

  play(name: string, opts?: { pitch?: number; volume?: number }): void {
    const buf = this.buffers.get(name);
    if (!buf) return;
    this.bus.playSfx(buf, opts ?? {});
  }
}
