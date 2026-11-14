/**
 * Tactile feedback: synthesized mechanical sounds and haptics.
 *
 * Off by default. Turn on with `feedback.configure({ sound: true, haptics: true })`, typically from
 * a settings toggle. Nothing is loaded, allocated or computed until then.
 *
 * Sounds are not samples. Each profile is a small physical model (an impulse exciting a few damped
 * resonant modes, plus a filtered noise transient) rendered once into four slightly different
 * variants, then played with tiny pitch and level jitter, so a fast run of detents never sounds
 * machine-gunned. Everything is a few kilobytes of code and ~50 ms of audio per profile.
 *
 * Skins choose sounds in CSS, so a rubber studio skin and a chrome skin can click differently
 * without code: `--tr-sound-press`, `--tr-sound-release`, `--tr-sound-detent`, `--tr-sound-toggle`
 * take a profile name or `none`, and `--tr-sound-pitch` (number, default 1) tunes the whole
 * element (metal higher, big rubber caps lower).
 */

/** Sound and haptic profiles, each modelled on a real mechanism. */
export const soundProfiles = [
  'tick', // fine detent, tiny ball-bearing click
  'detent', // rotary switch step
  'click', // tactile dome button bottoming out
  'release', // button cap returning
  'clack', // mechanical key switch: stem click plus bottom-out
  'latch', // latching push button or toggle, metallic spring
  'thunk', // heavy power or bat-handle toggle
  'slide', // fader friction, continuous (see feedback.slide)
] as const;

export type SoundProfile = (typeof soundProfiles)[number];

/** Global feedback settings. */
export interface FeedbackConfig {
  /** Play synthesized sounds. Default false. */
  sound: boolean;
  /** Vibrate on supporting devices. Default false. */
  haptics: boolean;
  /** Master volume, 0..1. Default 0.6. */
  volume: number;
}

/** Options for a single feedback event. */
export interface PlayOptions {
  /** Strength of the event, 0..1 (a gentle tap vs a firm press). Default 1. */
  intensity?: number;
  /** Pitch multiplier, e.g. from `--tr-sound-pitch`. Default 1. */
  pitch?: number;
  /** Stereo position, -1 (left) to 1 (right). Controllers derive it from the element's position. */
  pan?: number;
  /** Also vibrate (when haptics are on). Default true. */
  haptic?: boolean;
}

/** A continuous friction voice for a fader drag. */
export interface SlideVoice {
  /** Sets the drag speed, 0 (still) to 1 (fast throw). */
  update(speed: number): void;
  /** Fades the voice out. */
  stop(): void;
}

const config: FeedbackConfig = { sound: false, haptics: false, volume: 0.6 };
const listeners = new Set<(c: Readonly<FeedbackConfig>) => void>();

// ---------------------------------------------------------------------------------------------
// DSP helpers: tiny, allocation-light, deterministic.

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type FilterType = 'lp' | 'hp' | 'bp';

/** RBJ biquad, applied in place. */
function biquad(buf: Float32Array, sr: number, type: FilterType, f: number, q: number): void {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lp') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (type === 'hp') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i]!;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
}

interface Voice {
  buf: Float32Array;
  sr: number;
  r: () => number;
  /** Frequency jitter for this variant. */
  j: number;
}

/** Adds an exponentially decaying sine (one resonant mode of the part). */
function mode(v: Voice, freq: number, decay: number, amp: number, start = 0): void {
  const { buf, sr } = v;
  const f = freq * (1 + (v.r() - 0.5) * 0.06) * v.j;
  const s0 = Math.floor(start * sr);
  const phase = v.r() * Math.PI * 2;
  for (let i = s0; i < buf.length; i++) {
    const t = (i - s0) / sr;
    const env = Math.exp(-t / decay);
    if (env < 1e-4) break;
    buf[i]! += amp * env * Math.sin(2 * Math.PI * f * t + phase);
  }
}

/** Adds a sine whose pitch falls from f0 to f1 (a body "thump"). */
function thump(v: Voice, f0: number, f1: number, decay: number, amp: number, start = 0): void {
  const { buf, sr } = v;
  const s0 = Math.floor(start * sr);
  let ph = 0;
  for (let i = s0; i < buf.length; i++) {
    const t = (i - s0) / sr;
    const env = Math.exp(-t / decay);
    if (env < 1e-4) break;
    const f = (f1 + (f0 - f1) * Math.exp(-t / (decay * 0.6))) * v.j;
    ph += (2 * Math.PI * f) / sr;
    buf[i]! += amp * env * Math.sin(ph);
  }
}

/** Adds a filtered noise transient (the contact itself). */
function burst(v: Voice, dur: number, amp: number, type: FilterType, f: number, q: number, start = 0): void {
  const { sr } = v;
  const n = Math.ceil((dur * 4 + 0.002) * sr);
  const tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.00015) * Math.exp(-t / dur);
    tmp[i] = (v.r() * 2 - 1) * env;
  }
  biquad(tmp, sr, type, f * v.j, q);
  const s0 = Math.floor(start * sr);
  for (let i = 0; i < n && s0 + i < v.buf.length; i++) v.buf[s0 + i]! += amp * tmp[i]!;
}

interface ProfileSpec {
  length: number;
  gain: number;
  build(v: Voice): void;
}

const SPECS: Record<Exclude<SoundProfile, 'slide'>, ProfileSpec> = {
  tick: {
    length: 0.03,
    gain: 0.32,
    build(v) {
      burst(v, 0.0006, 1, 'bp', 6000, 1.4);
      mode(v, 4300, 0.004, 0.45);
      mode(v, 7300, 0.0022, 0.3);
    },
  },
  detent: {
    length: 0.05,
    gain: 0.48,
    build(v) {
      burst(v, 0.0008, 0.9, 'bp', 3600, 1.1);
      mode(v, 2350, 0.009, 0.55);
      mode(v, 5150, 0.005, 0.38);
      mode(v, 900, 0.006, 0.3);
    },
  },
  click: {
    length: 0.06,
    gain: 0.6,
    build(v) {
      burst(v, 0.0016, 0.8, 'lp', 3200, 0.8);
      mode(v, 1550, 0.011, 0.5);
      mode(v, 3450, 0.006, 0.34);
      thump(v, 240, 160, 0.008, 0.35);
    },
  },
  release: {
    length: 0.045,
    gain: 0.34,
    build(v) {
      burst(v, 0.0009, 0.7, 'bp', 4200, 1.2);
      mode(v, 2100, 0.008, 0.45);
      mode(v, 4600, 0.004, 0.3);
    },
  },
  clack: {
    length: 0.1,
    gain: 0.72,
    build(v) {
      // Stem click, then the cap bottoming out 6 ms later.
      burst(v, 0.0005, 0.45, 'bp', 5200, 1.5);
      mode(v, 3900, 0.003, 0.2);
      burst(v, 0.002, 0.9, 'bp', 1800, 0.9, 0.006);
      mode(v, 640, 0.028, 0.5, 0.006);
      mode(v, 1870, 0.016, 0.4, 0.006);
      mode(v, 3950, 0.007, 0.25, 0.006);
      thump(v, 170, 120, 0.02, 0.5, 0.006);
    },
  },
  latch: {
    length: 0.13,
    gain: 0.55,
    build(v) {
      burst(v, 0.001, 0.8, 'hp', 2000, 0.7);
      mode(v, 1250, 0.006, 0.4);
      // Inharmonic modes of a small steel spring ringing briefly.
      mode(v, 2650, 0.04, 0.42);
      mode(v, 5640, 0.024, 0.28);
      mode(v, 8810, 0.014, 0.18);
    },
  },
  thunk: {
    length: 0.17,
    gain: 0.9,
    build(v) {
      thump(v, 150, 72, 0.045, 1);
      burst(v, 0.004, 0.6, 'lp', 900, 0.7);
      mode(v, 430, 0.03, 0.3);
      // The contacts closing a few milliseconds after the lever lands.
      burst(v, 0.0008, 0.35, 'bp', 3000, 1.2, 0.012);
      mode(v, 2400, 0.008, 0.18, 0.012);
    },
  },
};

const VARIANTS = 4;

/** Renders one profile variant to raw samples (exported for tests). */
export function renderProfile(profile: Exclude<SoundProfile, 'slide'>, variant: number, sr: number): Float32Array {
  const spec = SPECS[profile];
  const r = rng(0x9e3779b9 ^ (soundProfiles.indexOf(profile) * 7919 + variant * 104729));
  const v: Voice = { buf: new Float32Array(Math.ceil(spec.length * sr)), sr, r, j: 1 + (r() - 0.5) * 0.05 };
  spec.build(v);
  // Remove DC and sub-bass (no phone speaker can play it; it only eats headroom).
  biquad(v.buf, sr, 'hp', 60, 0.7);
  let peak = 0;
  for (const s of v.buf) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? (spec.gain * (0.92 + r() * 0.08)) / peak : 0;
  // Short fade at the end so truncation never clicks.
  const fade = Math.floor(0.004 * sr);
  for (let i = 0; i < v.buf.length; i++) {
    const tail = v.buf.length - i;
    v.buf[i] = v.buf[i]! * g * (tail < fade ? tail / fade : 1);
  }
  return v.buf;
}

// ---------------------------------------------------------------------------------------------
// Audio engine.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const buffers = new Map<string, AudioBuffer[]>();
const lastPlayed = new Map<string, number>();
const recent: number[] = [];

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  // A gentle limiter so a burst of clicks never clips.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 8;
  comp.attack.value = 0.001;
  comp.release.value = 0.08;
  master = ctx.createGain();
  master.gain.value = config.volume;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

function variants(profile: Exclude<SoundProfile, 'slide'>, ac: AudioContext): AudioBuffer[] {
  let list = buffers.get(profile);
  if (!list) {
    list = [];
    for (let i = 0; i < VARIANTS; i++) {
      const data = renderProfile(profile, i, ac.sampleRate);
      const b = ac.createBuffer(1, data.length, ac.sampleRate);
      b.getChannelData(0).set(data);
      list.push(b);
    }
    buffers.set(profile, list);
  }
  return list;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = ac.sampleRate; // 1 s loop
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  const r = rng(1234);
  // Brown-ish noise: smoother, more like felt and grease than hiss.
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.06 * (r() * 2 - 1)) / 1.06;
    d[i] = last * 3.2;
  }
  return noise;
}

/** Resumes audio inside a user gesture. Browsers only allow sound after one. */
function unlock(): void {
  if (!config.sound) return;
  const ac = audio();
  if (ac && ac.state === 'suspended') void ac.resume();
}

let unlockInstalled = false;
function installUnlock(): void {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  // Touch pointerdown does not count as activation in some browsers; pointerup and keydown do.
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

function playSound(profile: Exclude<SoundProfile, 'slide'>, o: PlayOptions): void {
  const ac = audio();
  if (!ac || !master) return;
  if (ac.state === 'suspended') void ac.resume();
  const now = performance.now();
  // Rate limit per profile: real detents cannot click faster than ~100 Hz either.
  const prev = lastPlayed.get(profile) ?? -1e9;
  if (now - prev < 9) return;
  lastPlayed.set(profile, now);
  // Density compensation: a fast spin should whirr, not roar.
  while (recent.length && now - recent[0]! > 250) recent.shift();
  recent.push(now);
  const density = recent.length > 8 ? Math.max(0.35, 8 / recent.length) : 1;

  const list = variants(profile, ac);
  const src = ac.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)]!;
  src.playbackRate.value = (o.pitch ?? 1) * (1 + (Math.random() - 0.5) * 0.035);
  const g = ac.createGain();
  const intensity = Math.min(1, Math.max(0, o.intensity ?? 1));
  g.gain.value = Math.pow(intensity, 1.4) * density * (0.9 + Math.random() * 0.1);
  let node: AudioNode = src.connect(g);
  if (o.pan && typeof ac.createStereoPanner === 'function') {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    node = node.connect(p);
  }
  node.connect(master);
  src.start();
}

// ---------------------------------------------------------------------------------------------
// Haptics.

const HAPTIC_MS: Record<SoundProfile, number> = {
  tick: 4,
  detent: 7,
  click: 10,
  release: 0,
  clack: 12,
  latch: 14,
  thunk: 22,
  slide: 0,
};

let lastHaptic = 0;
let iosSwitch: HTMLLabelElement | null = null;

function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * iOS has no vibration API, but Safari 18+ plays a system haptic when a native
 * `<input type="checkbox" switch>` is toggled. A hidden one, toggled through its label inside the
 * user's gesture, gives real haptic ticks on iPhone. Its click is stopped at the label and the
 * element is marked `data-tr-haptic-proxy`, so app code can ignore it.
 */
function iosTick(): void {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.dataset.trHapticProxy = '';
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.append(input);
    label.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
    document.body.append(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

function vibrate(profile: SoundProfile, intensity: number): void {
  const ms = HAPTIC_MS[profile];
  if (!ms || intensity < 0.15) return;
  const now = performance.now();
  // Vibration motors need ~25 ms between pulses or they blur into a buzz.
  if (now - lastHaptic < 25) return;
  lastHaptic = now;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(Math.max(3, Math.round(ms * (0.5 + intensity * 0.5))));
  } else if (isAppleTouch() && typeof document !== 'undefined') {
    iosTick();
  }
}

// ---------------------------------------------------------------------------------------------
// Public API.

/** Reads a skin's sound choice for a slot from CSS (`--tr-sound-<slot>`), with a fallback. */
export function soundFor(
  el: Element,
  slot: 'press' | 'release' | 'detent' | 'toggle' | 'slide',
  fallback: SoundProfile | 'none',
): { profile: SoundProfile | 'none'; pitch: number; pan: number } {
  if (!config.sound && !config.haptics) return { profile: 'none', pitch: 1, pan: 0 };
  const cs = getComputedStyle(el);
  const raw = cs.getPropertyValue(`--tr-sound-${slot}`).trim();
  const profile = raw === 'none' || (soundProfiles as readonly string[]).includes(raw) ? (raw as SoundProfile | 'none') : fallback;
  const pitch = parseFloat(cs.getPropertyValue('--tr-sound-pitch')) || 1;
  return { profile, pitch, pan: 0 };
}

/** Stereo position of an element on screen, -0.35..0.35, for subtle spatial sound. */
export function panFor(rect: DOMRect): number {
  if (typeof innerWidth === 'undefined' || !innerWidth) return 0;
  const x = (rect.left + rect.width / 2) / innerWidth;
  return Math.max(-0.35, Math.min(0.35, (x - 0.5) * 0.7));
}

export const feedback = {
  /** Current settings (read-only snapshot). */
  get config(): Readonly<FeedbackConfig> {
    return { ...config };
  },

  /** Updates settings. Turning sound on prepares the audio engine on the next user gesture. */
  configure(next: Partial<FeedbackConfig>): void {
    if (next.sound !== undefined) config.sound = next.sound;
    if (next.haptics !== undefined) config.haptics = next.haptics;
    if (next.volume !== undefined) config.volume = Math.max(0, Math.min(1, next.volume));
    if (master && ctx) master.gain.setTargetAtTime(config.volume, ctx.currentTime, 0.01);
    if (config.sound) {
      installUnlock();
      unlock();
    }
    for (const l of listeners) l({ ...config });
  },

  /** Subscribes to settings changes. Returns an unsubscribe function. */
  subscribe(listener: (c: Readonly<FeedbackConfig>) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Plays a profile as sound and/or haptic, according to the settings. */
  play(profile: SoundProfile | 'none', options: PlayOptions = {}): void {
    if (profile === 'none' || profile === 'slide') return;
    const intensity = options.intensity ?? 1;
    if (config.sound && config.volume > 0) playSound(profile, options);
    if (config.haptics && options.haptic !== false) vibrate(profile, intensity);
  },

  /** Starts a continuous friction voice (fader drag). Returns a no-op voice when sound is off. */
  slide(options: Pick<PlayOptions, 'pitch' | 'pan'> = {}): SlideVoice {
    const ac = config.sound ? audio() : null;
    if (!ac || !master) return { update() {}, stop() {} };
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac);
    src.loop = true;
    src.loopStart = Math.random() * 0.5;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.value = 600 * (options.pitch ?? 1);
    const g = ac.createGain();
    g.gain.value = 0;
    let node: AudioNode = src.connect(bp).connect(g);
    if (options.pan && typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner();
      p.pan.value = options.pan;
      node = node.connect(p);
    }
    node.connect(master);
    src.start();
    let stopped = false;
    return {
      update(speed) {
        if (stopped) return;
        const s = Math.max(0, Math.min(1, speed));
        const t = ac.currentTime;
        g.gain.setTargetAtTime(Math.pow(s, 1.3) * 0.22, t, 0.02);
        bp.frequency.setTargetAtTime((500 + s * 2200) * (options.pitch ?? 1), t, 0.03);
      },
      stop() {
        if (stopped) return;
        stopped = true;
        const t = ac.currentTime;
        g.gain.setTargetAtTime(0, t, 0.02);
        src.stop(t + 0.15);
      },
    };
  },

  /** The audio context, once sound has been used (for meters or custom voices). */
  get context(): AudioContext | null {
    return ctx;
  },
};
