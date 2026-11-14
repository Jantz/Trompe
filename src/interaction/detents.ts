/**
 * Detents: the notches a real knob or fader clicks into.
 *
 * A detent is modelled as a local "potential well". Inside its capture zone the visible position
 * is pulled toward the notch (it sticks), then catches up quickly near the edge of the zone (it
 * snaps out), exactly how a spring-loaded ball feels against a notched ring. Strength 0 keeps the
 * motion linear and only clicks; strength 1 is a hard, sticky detent.
 */

export interface DetentSpec {
  /** `'steps'`: every step is a notch (rotary selectors). An array: notches at those values (a centre detent). */
  positions: 'steps' | readonly number[];
  /** 0 (clicks only) to 1 (very sticky). */
  strength: number;
  /** Half-width of each notch's capture zone, in value units. Ignored for `'steps'`. */
  width: number;
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

function sticky(p: number, d: number, w: number, strength: number): number {
  const u = (p - d) / w;
  const k = 1 + 4 * strength;
  return d + Math.sign(u) * Math.pow(Math.abs(u), k) * w;
}

/** Maps a raw (pointer-driven) position to the visible position with detents applied. */
export function applyDetents(p: number, spec: DetentSpec | null, r: Range): number {
  if (!spec || spec.strength <= 0) return p;
  if (spec.positions === 'steps') {
    if (!(r.step > 0)) return p;
    const d = r.min + Math.round((p - r.min) / r.step) * r.step;
    return sticky(p, d, r.step / 2, spec.strength);
  }
  for (const d of spec.positions) {
    if (Math.abs(p - d) < spec.width) return sticky(p, d, spec.width, spec.strength);
  }
  return p;
}

/**
 * An integer that changes exactly when a notch is crossed. Comparing it between frames tells the
 * controller when to click.
 */
export function detentIndex(p: number, spec: DetentSpec | null, r: Range): number {
  if (!spec) return 0;
  if (spec.positions === 'steps') return r.step > 0 ? Math.round((p - r.min) / r.step) : 0;
  let i = 0;
  for (const d of spec.positions) if (p >= d) i++;
  return i;
}

/** Where the part comes to rest when released at `p`: the nearest notch if close, else `p`. */
export function restingPoint(p: number, spec: DetentSpec | null, r: Range): number {
  if (!spec) return p;
  if (spec.positions === 'steps') return r.step > 0 ? r.min + Math.round((p - r.min) / r.step) * r.step : p;
  for (const d of spec.positions) if (Math.abs(p - d) < spec.width * 0.5) return d;
  return p;
}
