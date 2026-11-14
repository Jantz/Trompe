/**
 * Small, dependency-free colour toolkit for skins: parse CSS colours (oklch, hex, rgb), convert
 * OKLCH to sRGB, measure WCAG contrast (with alpha composited over a backdrop) and nudge a
 * colour's lightness until a pair is readable. Used by the Studio, the skin generator and tests.
 */

/** A colour in OKLCH. l is 0..1, c is chroma (0..~0.4), h is hue in degrees, a is alpha 0..1. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const num = (s: string, pct = 1) => (s.trim().endsWith('%') ? (parseFloat(s) / 100) * pct : parseFloat(s));

/** Parses oklch(), #rgb/#rrggbb(aa), rgb()/rgba() and a few keywords. Returns null for anything else. */
export function parseColor(input: string | null | undefined): Oklch | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { l: 0, c: 0, h: 0, a: 0 };
  if (s === 'white') return { l: 1, c: 0, h: 0, a: 1 };
  if (s === 'black') return { l: 0, c: 0, h: 0, a: 1 };
  let m = s.match(/^oklch\(\s*([^\s/,)]+)[\s,]+([^\s/,)]+)[\s,]+([^\s/,)]+)\s*(?:\/\s*([^\s)]+))?\s*\)$/);
  if (m) {
    const l = num(m[1]!, 1);
    const c = num(m[2]!, 0.4);
    const h = m[3] === 'none' ? 0 : parseFloat(m[3]!);
    const a = m[4] === undefined ? 1 : num(m[4], 1);
    if ([l, c, h, a].some((v) => Number.isNaN(v))) return null;
    return { l: clamp(l), c: Math.max(0, c), h: ((h % 360) + 360) % 360, a: clamp(a) };
  }
  m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let hex = m[1]!;
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((x) => x + x).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    const v = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgbToOklch([v(0), v(2), v(4)], hex.length === 8 ? v(6) : 1);
  }
  m = s.match(/^rgba?\(\s*([^\s,/)]+)[\s,]+([^\s,/)]+)[\s,]+([^\s,/)]+)\s*(?:[,/]\s*([^\s)]+))?\s*\)$/);
  if (m) {
    const ch = (x: string) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255);
    const a = m[4] === undefined ? 1 : num(m[4], 1);
    return srgbToOklch([ch(m[1]!), ch(m[2]!), ch(m[3]!)], a);
  }
  return null;
}

/** Formats as a compact oklch() string. */
export function formatOklch({ l, c, h, a }: Oklch): string {
  const r = (v: number, d: number) => String(Number(v.toFixed(d)));
  return `oklch(${r(l * 100, 1)}% ${r(c, 3)} ${r(h, 1)}${a < 1 ? ` / ${r(a, 2)}` : ''})`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** OKLCH to linear sRGB (unclamped). */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function srgbToOklch(rgb: [number, number, number], a = 1): Oklch {
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: clamp(L), c, h, a };
}

/** Whether the colour fits in sRGB. */
export function inGamut(c: Oklch): boolean {
  return oklchToLinear(c).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** Reduces chroma until the colour fits in sRGB (keeps lightness and hue). */
export function toGamut(c: Oklch): Oklch {
  if (inGamut(c)) return c;
  let lo = 0;
  let hi = c.c;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut({ ...c, c: mid })) lo = mid;
    else hi = mid;
  }
  return { ...c, c: lo };
}

/** Gamma-encoded sRGB channels 0..1, gamut-mapped by chroma reduction. */
export function toSrgb(c: Oklch): [number, number, number] {
  return oklchToLinear(toGamut(c)).map((v) => clamp(toGamma(clamp(v)))) as [number, number, number];
}

/** #rrggbb (alpha dropped), for <input type="color">. */
export function toHex(c: Oklch): string {
  return '#' + toSrgb(c).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

/** WCAG relative luminance. */
export function luminance(c: Oklch): number {
  const [r, g, b] = toSrgb(c).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Alpha-composites fg over bg in sRGB and returns an opaque colour. */
export function composite(fg: Oklch, bg: Oklch): Oklch {
  if (fg.a >= 1) return fg;
  const F = toSrgb(fg);
  const B = toSrgb({ ...bg, a: 1 });
  return srgbToOklch(F.map((v, i) => v * fg.a + B[i]! * (1 - fg.a)) as [number, number, number], 1);
}

/** WCAG 2 contrast ratio of fg on bg. Translucent colours are composited over the backdrop (default white). */
export function contrast(fg: Oklch, bg: Oklch, backdrop: Oklch = { l: 1, c: 0, h: 0, a: 1 }): number {
  const B = composite(bg, backdrop);
  const F = composite(fg, B);
  const a = luminance(F);
  const b = luminance(B);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Returns fg with its lightness moved (toward black or white, whichever reaches the target with
 * the smallest change) until it meets `min` contrast on bg. Hue and chroma are kept.
 */
export function ensureContrast(fg: Oklch, bg: Oklch, min: number, backdrop?: Oklch): Oklch {
  if (contrast(fg, bg, backdrop) >= min) return fg;
  const tryDir = (target: number) => {
    let lo = fg.l;
    let hi = target;
    if (contrast({ ...fg, l: hi }, bg, backdrop) < min) return null;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (contrast({ ...fg, l: mid }, bg, backdrop) >= min) hi = mid;
      else lo = mid;
    }
    return { ...fg, l: hi };
  };
  const up = tryDir(1);
  const down = tryDir(0);
  if (up && down) return Math.abs(up.l - fg.l) <= Math.abs(down.l - fg.l) ? up : down;
  return up ?? down ?? { ...fg, l: luminance(composite(bg, backdrop ?? { l: 1, c: 0, h: 0, a: 1 })) > 0.18 ? 0 : 1, c: 0 };
}

/** Shorthand: mix lightness/chroma of a colour. */
export function adjust(c: Oklch, d: Partial<Oklch>): Oklch {
  return { l: clamp(d.l ?? c.l), c: Math.max(0, d.c ?? c.c), h: d.h ?? c.h, a: clamp(d.a ?? c.a) };
}

/**
 * Resolves light-dark(a, b) to the branch for a scheme. Other values pass through.
 */
export function themed(value: string, scheme: 'light' | 'dark'): string {
  const m = value.match(/^light-dark\((.*)\)$/s);
  if (!m) return value;
  let depth = 0;
  for (let i = 0; i < m[1]!.length; i++) {
    const ch = m[1]![i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) return (scheme === 'light' ? m[1]!.slice(0, i) : m[1]!.slice(i + 1)).trim();
  }
  return value;
}
