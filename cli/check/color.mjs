// Small CSS colour parser and WCAG contrast maths. Handles oklch(), oklab(), rgb()/rgba(), hex,
// a few keywords, and light-dark(a, b). Anything else (var(), color-mix()) returns null so rules
// can skip it instead of guessing.

const NAMED = { white: [1, 1, 1, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };

const num = (s, pctScale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * pctScale : parseFloat(s));

function splitArgs(inner) {
  const [main, alpha] = inner.split('/').map((s) => s.trim());
  return { parts: main.split(/[\s,]+/).filter(Boolean), alpha: alpha === undefined ? 1 : num(alpha) };
}

function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  });
}

/** Parses one colour to [r, g, b, a] in gamma-encoded sRGB 0..1, or null. */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const v = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return [v(0), v(2), v(4), h.length === 8 ? v(6) : 1];
  }
  if ((m = s.match(/^oklch\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    if (parts.length !== 3 || parts.some((p) => !/^-?[\d.]+(%|deg)?$/.test(p))) return null;
    const L = num(parts[0]), C = num(parts[1], 0.4), H = (parseFloat(parts[2]) * Math.PI) / 180;
    return [...oklabToSrgb(L, C * Math.cos(H), C * Math.sin(H)), alpha];
  }
  if ((m = s.match(/^oklab\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    if (parts.length !== 3) return null;
    return [...oklabToSrgb(num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)), alpha];
  }
  if ((m = s.match(/^rgba?\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    if (parts.length < 3) return null;
    const a = parts.length === 4 ? num(parts[3]) : alpha;
    return [...parts.slice(0, 3).map((p) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / 255)), a];
  }
  return null;
}

/** Splits light-dark(a, b) into { light, dark }; plain values are used for both. */
export function themed(value) {
  if (typeof value !== 'string') return { light: value, dark: value };
  const m = value.trim().match(/^light-dark\((.*)\)$/i);
  if (!m) return { light: value, dark: value };
  let depth = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return { light: m[1].slice(0, i).trim(), dark: m[1].slice(i + 1).trim() };
  }
  return { light: value, dark: value };
}

/** Composites fg over bg (both [r,g,b,a]); result is opaque if bg is. */
export function over(fg, bg) {
  const a = fg[3] + bg[3] * (1 - fg[3]);
  if (a === 0) return [0, 0, 0, 0];
  return [0, 1, 2].map((i) => (fg[i] * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a).concat(a);
}

export function luminance([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio. Translucent colours are composited over `backdrop` (default white). */
export function contrast(fg, bg, backdrop = [1, 1, 1, 1]) {
  const B = bg[3] < 1 ? over(bg, backdrop) : bg;
  const F = fg[3] < 1 ? over(fg, B) : fg;
  const [l1, l2] = [luminance(F), luminance(B)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
