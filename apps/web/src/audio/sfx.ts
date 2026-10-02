/**
 * Short synthesized sound effects (Web Audio). The MVP ships no audio files,
 * so every sound is generated in the browser — disclosed in Settings.
 *
 * Rules (prompt 03): the AudioContext is created/resumed only after a user gesture
 * (`unlock()`), sounds respect mute, and the context is suspended while the tab is hidden.
 */

export type SfxName =
  | 'swap'
  | 'reject'
  | 'match'
  | 'special'
  | 'line'
  | 'bomb'
  | 'ram'
  | 'bigToi'
  | 'besh'
  | 'win'
  | 'lose'
  | 'click';

export const SFX_NAMES: readonly SfxName[] = [
  'swap',
  'reject',
  'match',
  'special',
  'line',
  'bomb',
  'ram',
  'bigToi',
  'besh',
  'win',
  'lose',
  'click',
];

export interface SfxOptions {
  /** Cascade wave (1-based); slightly raises the pitch of 'match'. */
  step?: number;
}

export interface Sfx {
  play(name: SfxName, options?: SfxOptions): void;
  setEnabled(enabled: boolean): void;
  /** Call from a user gesture (pointerdown/keydown). Safe to call repeatedly. */
  unlock(): void;
  readonly enabled: boolean;
  /** False when the browser has no Web Audio support. */
  readonly available: boolean;
  dispose(): void;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface ToneSpec {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  gain: number;
  attack?: number;
  delay?: number;
}

interface NoiseSpec {
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
  delay?: number;
  attack?: number;
}

/** Minimum gap between two plays of the same sound, to avoid stacking dozens of identical events. */
const THROTTLE_MS = 40;

export function createSfx(): Sfx {
  const Ctor = getAudioContextCtor();
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let enabled = true;
  let unlocked = false;
  const lastPlayed = new Map<SfxName, number>();

  const hidden = () => typeof document !== 'undefined' && document.hidden;

  function ensureContext(): AudioContext | null {
    if (!Ctor || !unlocked) return null;
    if (ctx) return ctx;
    try {
      ctx = new Ctor();
      out = ctx.createGain();
      out.gain.value = 0.3;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      out.connect(comp);
      comp.connect(ctx.destination);
    } catch {
      ctx = null;
      out = null;
    }
    return ctx;
  }

  function resume(): void {
    if (ctx && ctx.state === 'suspended' && enabled && !hidden()) ctx.resume().catch(() => {});
  }

  function suspend(): void {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  const onVisibility = () => (hidden() ? suspend() : resume());
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  function getNoise(c: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(c.sampleRate * 0.8);
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Deterministic pseudo-noise (LCG) — sound only, not game logic.
    let seed = 0x2545f491;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 0xffffffff - 0.5;
    }
    return noiseBuffer;
  }

  function envelope(c: AudioContext, at: number, gain: number, attack: number, dur: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(out!);
    return g;
  }

  function tone(c: AudioContext, now: number, s: ToneSpec): void {
    const at = now + (s.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = s.type ?? 'sine';
    osc.frequency.setValueAtTime(s.freq, at);
    if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, at + s.dur);
    osc.connect(envelope(c, at, s.gain, s.attack ?? 0.006, s.dur));
    osc.start(at);
    osc.stop(at + s.dur + 0.03);
  }

  function noise(c: AudioContext, now: number, s: NoiseSpec): void {
    const at = now + (s.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    const filter = c.createBiquadFilter();
    filter.type = s.filter;
    filter.frequency.setValueAtTime(s.freq, at);
    if (s.to) filter.frequency.exponentialRampToValueAtTime(s.to, at + s.dur);
    filter.Q.value = s.q ?? 0.8;
    src.connect(filter);
    filter.connect(envelope(c, at, s.gain, s.attack ?? 0.01, s.dur));
    src.start(at);
    src.stop(at + s.dur + 0.03);
  }

  function synth(c: AudioContext, name: SfxName, options: SfxOptions): void {
    const now = c.currentTime + 0.005;
    switch (name) {
      case 'click':
        tone(c, now, { freq: 880, dur: 0.05, gain: 0.18 });
        tone(c, now, { freq: 1320, dur: 0.03, gain: 0.06 });
        break;
      case 'swap':
        tone(c, now, { freq: 440, to: 620, type: 'triangle', dur: 0.1, gain: 0.28 });
        break;
      case 'reject':
        tone(c, now, { freq: 300, to: 210, type: 'triangle', dur: 0.09, gain: 0.28 });
        tone(c, now, { freq: 250, to: 170, type: 'triangle', dur: 0.1, gain: 0.24, delay: 0.1 });
        break;
      case 'match': {
        const step = Math.min(Math.max(options.step ?? 1, 1), 5);
        const base = 523.25 * 2 ** (((step - 1) * 2) / 12);
        tone(c, now, { freq: base, dur: 0.16, gain: 0.3 });
        tone(c, now, { freq: base * 1.5, dur: 0.14, gain: 0.16, delay: 0.035 });
        tone(c, now, { freq: base * 2, type: 'triangle', dur: 0.08, gain: 0.06, delay: 0.02 });
        break;
      }
      case 'special':
        [659.25, 880, 1174.66].forEach((freq, i) =>
          tone(c, now, { freq, type: 'triangle', dur: 0.18, gain: 0.2, delay: i * 0.07 }),
        );
        break;
      case 'line':
        noise(c, now, { filter: 'bandpass', freq: 700, to: 4200, q: 1.4, dur: 0.24, gain: 0.32 });
        tone(c, now, { freq: 600, to: 1250, dur: 0.2, gain: 0.1 });
        break;
      case 'bomb':
        tone(c, now, { freq: 170, to: 48, dur: 0.32, gain: 0.6 });
        noise(c, now, { filter: 'lowpass', freq: 1000, to: 180, dur: 0.28, gain: 0.32 });
        break;
      case 'ram':
        [783.99, 987.77, 1174.66, 1567.98].forEach((freq, i) =>
          tone(c, now, { freq, dur: 0.36, gain: 0.17, delay: i * 0.075 }),
        );
        noise(c, now, { filter: 'highpass', freq: 5000, dur: 0.45, gain: 0.05, attack: 0.08 });
        break;
      case 'bigToi':
        [392, 493.88, 587.33, 783.99].forEach((freq) =>
          tone(c, now, { freq, type: 'triangle', dur: 0.72, gain: 0.12, attack: 0.08 }),
        );
        noise(c, now, { filter: 'bandpass', freq: 400, to: 6000, q: 0.9, dur: 0.7, gain: 0.16, attack: 0.1 });
        [1567.98, 1975.53, 2349.32, 2637.02].forEach((freq, i) =>
          tone(c, now, { freq, dur: 0.2, gain: 0.07, delay: 0.3 + i * 0.08 }),
        );
        break;
      case 'besh':
        // «Дастархан для всех»: warm festive chord with a soft sweep (between RAM and «Большой той»).
        [440, 554.37, 659.25].forEach((freq, i) =>
          tone(c, now, { freq, type: 'triangle', dur: 0.5, gain: 0.14, attack: 0.03, delay: i * 0.05 }),
        );
        noise(c, now, { filter: 'bandpass', freq: 500, to: 3500, q: 1, dur: 0.45, gain: 0.14, attack: 0.05 });
        [1318.51, 1760].forEach((freq, i) => tone(c, now, { freq, dur: 0.18, gain: 0.07, delay: 0.22 + i * 0.08 }));
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
          tone(c, now, { freq, type: 'triangle', dur: 0.26, gain: 0.24, delay: i * 0.11 }),
        );
        [523.25, 659.25, 783.99].forEach((freq) =>
          tone(c, now, { freq: freq * 2, dur: 0.6, gain: 0.08, delay: 0.46, attack: 0.04 }),
        );
        break;
      case 'lose':
        [392, 349.23, 293.66].forEach((freq, i) =>
          tone(c, now, { freq, type: 'triangle', dur: 0.3, gain: 0.2, delay: i * 0.18 }),
        );
        break;
    }
  }

  return {
    get enabled() {
      return enabled;
    },
    get available() {
      return Ctor !== null;
    },
    unlock() {
      unlocked = true;
      if (!enabled) return;
      ensureContext();
      resume();
    },
    setEnabled(next: boolean) {
      enabled = next;
      if (enabled) {
        if (unlocked) ensureContext();
        resume();
      } else {
        suspend();
      }
    },
    play(name: SfxName, options: SfxOptions = {}) {
      if (!enabled || !unlocked || hidden()) return;
      const c = ensureContext();
      if (!c || !out) return;
      const nowMs = c.currentTime * 1000;
      const last = lastPlayed.get(name);
      if (last !== undefined && nowMs - last < THROTTLE_MS && nowMs >= last) return;
      lastPlayed.set(name, nowMs);
      if (c.state === 'suspended') resume();
      try {
        synth(c, name, options);
      } catch {
        /* Audio must never break the game. */
      }
    },
    dispose() {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      ctx?.close().catch(() => {});
      ctx = null;
      out = null;
    },
  };
}

/** Silent implementation for tests or environments without audio. */
export function createSilentSfx(): Sfx {
  return {
    enabled: false,
    available: false,
    play() {},
    setEnabled() {},
    unlock() {},
    dispose() {},
  };
}
