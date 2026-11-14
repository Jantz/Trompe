/**
 * Pure helpers for tr-chart: nice scales, number formats and SVG path builders. No DOM.
 * Every path builder emits the same command sequence for the same number of points, so a change
 * of values can be animated by interpolating the `d` property.
 */

export interface Tick {
  value: number;
  label: string;
}

/** Round a span to 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/** A clean domain and its ticks for values from lo to hi, with about `count` steps. */
export function niceDomain(lo: number, hi: number, count: number): { min: number; max: number; step: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, step: 1 };
  if (lo === hi) {
    if (lo === 0) return { min: 0, max: 1, step: 0.25 };
    const pad = Math.abs(lo) * 0.5;
    lo -= lo > 0 ? pad : 0;
    hi += hi > 0 ? pad : pad;
  }
  const step = niceStep(hi - lo, count);
  // Snap the ends out to whole steps; tiny float noise must not add a step.
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  return { min, max, step };
}

/** A number formatter: plain, currency or with a unit suffix; compact on axes that reach 10,000. */
export function formatter(opts: { currency?: string; unit?: string; decimals?: number; compact?: boolean; locale?: string }): (v: number) => string {
  const o: Intl.NumberFormatOptions = {};
  if (opts.currency) {
    o.style = 'currency';
    o.currency = opts.currency;
  }
  if (opts.compact) {
    o.notation = 'compact';
    o.maximumFractionDigits = 1;
  } else if (opts.decimals != null && opts.decimals >= 0) {
    o.minimumFractionDigits = opts.decimals;
    o.maximumFractionDigits = opts.decimals;
  } else if (opts.currency) {
    // whole amounts read cleaner on charts; cents only when the values have them
    o.minimumFractionDigits = 0;
    o.maximumFractionDigits = 2;
  } else {
    o.maximumFractionDigits = 2;
  }
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(opts.locale, o);
  } catch {
    nf = new Intl.NumberFormat(opts.locale, { maximumFractionDigits: 2 });
  }
  const unit = opts.unit ?? '';
  const spaced = unit && /^[A-Za-z]/.test(unit) ? ` ${unit}` : unit;
  return (v: number) => nf.format(v) + spaced;
}

/** Ticks across a nice domain. */
export function ticks(min: number, max: number, step: number, fmt: (v: number) => string): Tick[] {
  const out: Tick[] = [];
  const n = Math.round((max - min) / step);
  for (let i = 0; i <= n; i++) {
    // avoid -0 and float dust (0.30000000000000004)
    const v = Number((min + i * step).toPrecision(12)) || 0;
    out.push({ value: v, label: fmt(v) });
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A smooth line through points that never overshoots (monotone cubic, Fritsch–Carlson), so a
 * curve never suggests a value the data does not have. Always "M" then one "C" per segment.
 */
export function linePath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1)
    return `M ${r2(pts[0][0])} ${r2(pts[0][1])} C ${r2(pts[0][0])} ${r2(pts[0][1])} ${r2(pts[0][0])} ${r2(pts[0][1])} ${r2(pts[0][0])} ${r2(pts[0][1])}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6;
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${r2(pts[i][0] + h)} ${r2(pts[i][1] + t[i] * h)} ${r2(pts[i + 1][0] - h)} ${r2(pts[i + 1][1] - t[i + 1] * h)} ${r2(pts[i + 1][0])} ${r2(pts[i + 1][1])}`;
  }
  return d;
}

/** The area under (or between) lines: the top line forward, the bottom line back. */
export function areaPath(top: Array<[number, number]>, bottom: Array<[number, number]>): string {
  if (!top.length) return '';
  const back = [...bottom].reverse();
  const lower = linePath(back).replace(/^M/, 'L');
  return `${linePath(top)} ${lower} Z`;
}

/**
 * A bar from the baseline y0 to the value end y1, with rounded corners at the value end only
 * (square at the baseline). Works both ways (negative values hang down). Fixed command shape.
 */
export function barPath(x: number, w: number, y0: number, y1: number, radius: number): string {
  const up = y1 <= y0;
  const h = Math.abs(y0 - y1);
  const r = Math.max(0, Math.min(radius, w / 2, h));
  const s = up ? 1 : 0;
  const yr = up ? y1 + r : y1 - r;
  return (
    `M ${r2(x)} ${r2(y0)} L ${r2(x)} ${r2(yr)} A ${r2(r)} ${r2(r)} 0 0 ${s} ${r2(x + r)} ${r2(y1)} ` +
    `L ${r2(x + w - r)} ${r2(y1)} A ${r2(r)} ${r2(r)} 0 0 ${s} ${r2(x + w)} ${r2(yr)} L ${r2(x + w)} ${r2(y0)} Z`
  );
}

/** Number of x labels that fit: every `step`-th label is shown. */
export function labelStep(count: number, width: number, longest: number): number {
  if (count <= 1) return 1;
  const room = width / count;
  return Math.max(1, Math.ceil((longest + 12) / Math.max(1, room)));
}

/** Parse "1,234.5", "$4,200", "−12 %" and the like. NaN when there is no number. */
export function parseNumber(text: string): number {
  const t = text.replace(/−/g, '-').replace(/[^0-9.\-eE]/g, '');
  return t ? Number.parseFloat(t) : Number.NaN;
}
