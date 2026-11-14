/**
 * Damped-spring physics for Trompe's moving parts.
 *
 * Springs are described the way people perceive them, by `duration` (seconds to settle visually) and
 * `bounce` (0 = no overshoot, 0.5 = very springy), and solved analytically, so the result is exact at
 * any frame rate and a spring can be re-targeted mid-flight without losing its velocity.
 *
 * The same spring can run in JavaScript ({@link Spring}, for drags, inertia and re-targeting) or be
 * baked into a CSS `linear()` easing ({@link springEasing}) so press and toggle animations run on
 * the compositor with no script per frame.
 */

/** Perceptual spring parameters. */
export interface SpringParams {
  /** Approximate time to settle, in seconds. Shorter is stiffer. */
  duration: number;
  /** Overshoot, 0 (critically damped) to 0.9 (very bouncy). Negative values are over-damped. */
  bounce: number;
}

/**
 * Named springs used across Trompe. Each mimics a mechanism:
 *
 * - `press`   a key or button cap returning on its spring: quick, small overshoot.
 * - `throw`   a toggle lever or slide switch snapping over centre: fast, firm landing.
 * - `detent`  a knob dropping into a notch: very quick, a hint of bounce.
 * - `glide`   a motorised fader or keyboard-driven value travelling to a target: smooth, no bounce.
 * - `needle`  an analogue meter needle (VU-like): about 300 ms rise, 1-2 % overshoot.
 * - `settle`  generic, critically damped.
 */
export const springs = {
  press: { duration: 0.22, bounce: 0.28 },
  throw: { duration: 0.16, bounce: 0.18 },
  detent: { duration: 0.12, bounce: 0.12 },
  glide: { duration: 0.32, bounce: 0 },
  needle: { duration: 0.42, bounce: 0.12 },
  settle: { duration: 0.25, bounce: 0 },
} as const satisfies Record<string, SpringParams>;

export type SpringName = keyof typeof springs;

/** Resolves a spring name or parameter object. */
export function resolveSpring(spring: SpringName | SpringParams): SpringParams {
  return typeof spring === 'string' ? springs[spring] : spring;
}

interface Coeffs {
  /** Natural angular frequency, rad/s. */
  w: number;
  /** Damping ratio. */
  z: number;
}

function coeffs(p: SpringParams): Coeffs {
  const duration = Math.max(0.01, p.duration);
  const bounce = Math.min(0.95, p.bounce);
  // Same mapping as SwiftUI / Apple's perceptual springs: period = duration, damping = 1 - bounce.
  const w = (2 * Math.PI) / duration;
  const z = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  return { w, z };
}

/**
 * Advances a spring analytically. `x` is the displacement from the target, `v` the velocity (units
 * per second). Returns the new displacement and velocity after `t` seconds.
 */
export function stepSpring(x: number, v: number, t: number, c: Coeffs): [number, number] {
  const { w, z } = c;
  if (z < 1) {
    const a = z * w;
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-a * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const b = (v + a * x) / wd;
    return [e * (x * cos + b * sin), e * (v * cos - (a * b + x * wd) * sin)];
  }
  if (z === 1) {
    const e = Math.exp(-w * t);
    const b = v + w * x;
    return [e * (x + b * t), e * (v - w * b * t)];
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w * (z - s);
  const r2 = -w * (z + s);
  const c2 = (v - r1 * x) / (r2 - r1);
  const c1 = x - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return [c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2];
}

/**
 * A one-dimensional spring that chases a target. Re-target any time; velocity is preserved, so
 * interrupted motion never jerks.
 *
 * @example
 * const s = new Spring(0, 'glide');
 * s.target = 1;
 * loop(dt => { s.step(dt); el.style.setProperty('--x', s.value); return !s.settled; });
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  /** Displacement below which (together with a small velocity) the spring counts as settled. */
  precision: number;
  private c: Coeffs;

  constructor(value: number, params: SpringName | SpringParams = 'settle', precision = 0.0005) {
    this.value = value;
    this.target = value;
    this.precision = precision;
    this.c = coeffs(resolveSpring(params));
  }

  /** Changes the spring's character without disturbing its state. */
  set params(p: SpringName | SpringParams) {
    this.c = coeffs(resolveSpring(p));
  }

  get settled(): boolean {
    return Math.abs(this.value - this.target) < this.precision && Math.abs(this.velocity) < this.precision * 20;
  }

  /** Jumps to a value and stops. */
  snap(value: number): void {
    this.value = this.target = value;
    this.velocity = 0;
  }

  /** Advances by `dt` seconds. Returns true while still moving. */
  step(dt: number): boolean {
    const [x, v] = stepSpring(this.value - this.target, this.velocity, dt, this.c);
    this.value = this.target + x;
    this.velocity = v;
    if (this.settled) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

/** A CSS easing baked from a spring, ready for `transition-timing-function`. */
export interface SpringEasing {
  /** A CSS `linear()` easing function. */
  easing: string;
  /** Duration in milliseconds that the easing spans. */
  duration: number;
}

/**
 * Bakes a spring into a CSS `linear()` easing, so the animation can run on the compositor.
 * Points are placed adaptively: only where straight segments would err by more than `tolerance`.
 *
 * @param velocity Initial velocity, in units of the full travel per second (0 = starts at rest).
 */
export function springEasing(
  spring: SpringName | SpringParams,
  { velocity = 0, tolerance = 0.002 }: { velocity?: number; tolerance?: number } = {},
): SpringEasing {
  const c = coeffs(resolveSpring(spring));
  // Simulate at 1 ms resolution until settled (|x| < 0.001 of the travel).
  const dt = 0.001;
  const samples: number[] = [0];
  let x = -1;
  let v = velocity;
  for (let i = 0; i < 5000; i++) {
    [x, v] = stepSpring(-1, velocity, (i + 1) * dt, c);
    samples.push(1 + x);
    if (Math.abs(x) < 0.001 && Math.abs(v) < 0.02) break;
  }
  samples[samples.length - 1] = 1;
  const n = samples.length - 1;
  // Ramer-Douglas-Peucker style simplification on (t, y).
  const keep = new Uint8Array(n + 1);
  keep[0] = keep[n] = 1;
  const stack: Array<[number, number]> = [[0, n]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let err = tolerance;
    for (let i = a + 1; i < b; i++) {
      const lerp = samples[a]! + ((samples[b]! - samples[a]!) * (i - a)) / (b - a);
      const e = Math.abs(samples[i]! - lerp);
      if (e > err) {
        err = e;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    if (!keep[i]) continue;
    const y = round(samples[i]!, 4);
    parts.push(i === 0 || i === n ? String(y) : `${y} ${round((i / n) * 100, 2)}%`);
  }
  return { easing: `linear(${parts.join(', ')})`, duration: Math.round(n * dt * 1000) };
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f || 0;
}
