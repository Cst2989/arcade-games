import { AudioBus } from './audio-bus.js';

export type AmbientMode = 'welcoming' | 'foreboding';

interface VoiceNodes {
  osc: OscillatorNode;
  detune: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

const CHORDS: Record<AmbientMode, number[]> = {
  welcoming: [174.61, 261.63, 329.63, 392.00, 523.25],
  foreboding: [110.00, 164.81, 196.00, 261.63, 311.13],
};

export class AmbientMusic {
  private voices: VoiceNodes[] = [];
  private filter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private arp: { osc: OscillatorNode; gain: GainNode; timer: number } | null = null;
  private stopped = false;

  constructor(private bus: AudioBus) {}

  start(mode: AmbientMode, { volume = 0.35 }: { volume?: number } = {}): void {
    const ctx = this.bus.getContext();
    const dest = this.bus.getMusicDestination();
    if (!ctx || !dest) return;
    this.stop();
    this.stopped = false;

    const freqs = CHORDS[mode];
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(volume, now + 2.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'welcoming' ? 1400 : 700;
    filter.Q.value = 0.8;

    master.connect(filter);
    filter.connect(dest);

    this.masterGain = master;
    this.filter = filter;

    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i]!;
      const osc = ctx.createOscillator();
      osc.type = mode === 'welcoming' ? 'triangle' : 'sine';
      osc.frequency.value = f;

      const detune = ctx.createOscillator();
      detune.type = 'sine';
      detune.frequency.value = f * 1.003;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.16 / freqs.length;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08 + i * 0.03;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.05 / freqs.length;

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);

      osc.connect(voiceGain);
      detune.connect(voiceGain);
      voiceGain.connect(master);

      osc.start(now);
      detune.start(now);
      lfo.start(now);

      this.voices.push({ osc, detune, gain: voiceGain, lfo, lfoGain });
    }

    if (mode === 'welcoming') {
      this.startArpeggio(ctx, master, freqs);
    } else {
      this.startDrone(ctx, master);
    }
  }

  private startArpeggio(ctx: AudioContext, dest: GainNode, notes: number[]): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    this.arp = { osc, gain, timer: 0 };

    let step = 0;
    const stepTime = 0.42;
    const tick = () => {
      if (this.stopped || !this.arp) return;
      const t = ctx.currentTime;
      const noteIdx = step % notes.length;
      const octave = Math.floor(step / notes.length) % 2 === 0 ? 2 : 4;
      osc.frequency.setValueAtTime(notes[noteIdx]! * octave, t);
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + stepTime - 0.02);
      step++;
      this.arp.timer = window.setTimeout(tick, stepTime * 1000) as unknown as number;
    };
    tick();
  }

  private startDrone(ctx: AudioContext, dest: GainNode): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 4;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start();
    lfo.start();

    this.arp = { osc, gain, timer: 0 };
  }

  stop(): void {
    this.stopped = true;
    const ctx = this.bus.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
      } catch {}
    }

    const stopAt = now + 0.7;
    for (const v of this.voices) {
      try { v.osc.stop(stopAt); } catch {}
      try { v.detune.stop(stopAt); } catch {}
      try { v.lfo.stop(stopAt); } catch {}
    }
    this.voices = [];

    if (this.arp) {
      if (this.arp.timer) clearTimeout(this.arp.timer);
      try { this.arp.osc.stop(stopAt); } catch {}
      this.arp = null;
    }

    setTimeout(() => {
      try { this.filter?.disconnect(); } catch {}
      try { this.masterGain?.disconnect(); } catch {}
      this.filter = null;
      this.masterGain = null;
    }, 800);
  }
}
