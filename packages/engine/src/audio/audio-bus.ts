export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private unlocked = false;
  private pendingUnlock: (() => void)[] = [];

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  }

  // Call from first user gesture to satisfy autoplay policy.
  unlock(): void {
    if (this.unlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    for (const cb of this.pendingUnlock) cb();
    this.pendingUnlock.length = 0;
  }

  onUnlocked(cb: () => void): void {
    if (this.unlocked) cb();
    else this.pendingUnlock.push(cb);
  }

  async loadBuffer(url: string): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('AudioBus not initialized');
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return this.ctx.decodeAudioData(arr);
  }

  playSfx(buf: AudioBuffer, { pitch = 1, volume = 1 } = {}): void {
    if (!this.ctx || !this.sfxGain || !this.unlocked) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxGain);
    src.start();
  }

  playMusic(buf: AudioBuffer, { loop = true, volume = 1 } = {}): () => void {
    if (!this.ctx || !this.musicGain) return () => {};
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.musicGain);
    src.start();
    return () => {
      try { src.stop(); } catch {}
      g.disconnect();
    };
  }

  setMusicVolume(v: number): void {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfxVolume(v: number): void {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getMusicDestination(): AudioNode | null {
    return this.musicGain;
  }
}
