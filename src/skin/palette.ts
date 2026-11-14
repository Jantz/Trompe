/**
 * Palette generator: a handful of intent-level inputs (light or dark, a neutral hue and how much
 * of it, an accent, how crisp) become every colour token a skin needs, with each readable pair
 * pushed to WCAG contrast. The Studio's colour controls and the skin generator both use it.
 */
import { contrast, ensureContrast, formatOklch, parseColor, toGamut, type Oklch } from './color.js';

export interface PaletteInput {
  scheme: 'light' | 'dark';
  /** Hue of the neutrals (canvas, surfaces, ink), in degrees. */
  hue: number;
  /** How tinted the neutrals are, 0 (grey) .. 1 (clearly coloured). */
  tint: number;
  /** Accent hue in degrees. */
  accentHue: number;
  /** Accent chroma, 0 .. 0.3. */
  accentChroma: number;
  /** 0 = soft, low-contrast neutrals; 1 = crisp, high-contrast. Default 0.5. */
  crispness?: number;
}

/** The colour pairs a skin must keep readable: [foreground, background, minimum ratio, what for]. */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['color.ink', 'color.surface', 4.5, 'body text on surfaces'],
  ['color.ink', 'color.canvas', 4.5, 'body text on the page'],
  ['color.ink-muted', 'color.surface', 4.5, 'secondary text on surfaces'],
  ['color.accent-ink', 'color.accent', 4.5, 'text on accent fills'],
  ['color.danger-ink', 'color.danger', 4.5, 'text on danger fills'],
  ['color.edge', 'color.canvas', 3, 'control boundaries'],
  ['color.focus', 'color.canvas', 3, 'focus ring'],
];

const ok = (l: number, c: number, h: number, a = 1): Oklch => toGamut({ l, c, h, a });

/** Builds every color.* token from intent-level inputs. All pairs in CONTRAST_PAIRS pass. */
export function paletteTokens(p: PaletteInput): Record<string, string> {
  const dark = p.scheme === 'dark';
  const k = Math.min(1, Math.max(0, p.crispness ?? 0.5));
  const tc = Math.min(1, Math.max(0, p.tint)) * 0.035;
  const h = p.hue;
  const ac = Math.min(0.3, Math.max(0, p.accentChroma));

  const canvas = dark ? ok(0.19 - k * 0.04, tc * 0.9, h) : ok(0.925 - k * 0.02, tc * 0.8, h);
  const surface = dark ? ok(0.28 - k * 0.02, tc, h) : ok(0.962 + k * 0.015, tc * 0.7, h);
  const well = dark ? ok(canvas.l - 0.05, tc * 0.8, h) : ok(canvas.l - 0.045, tc, h);
  let ink = dark ? ok(0.94 + k * 0.03, tc * 0.4, h) : ok(0.25 - k * 0.07, tc * 0.6 + 0.008, h);
  let muted = dark ? ok(0.77, tc * 0.5, h) : ok(0.46, tc * 0.6 + 0.008, h);
  let edge = dark ? ok(0.52 + k * 0.06, tc * 0.6, h) : ok(0.62 - k * 0.06, tc * 0.6 + 0.008, h);
  let accent = dark ? ok(0.74, ac, p.accentHue) : ok(0.56, ac, p.accentHue);
  let focus = ok(dark ? 0.76 : 0.55, Math.max(0.12, ac * 0.9), ac > 0.05 ? p.accentHue : 255);
  const danger = dark ? ok(0.69, 0.17, 25) : ok(0.52, 0.19, 25);
  const shadow = dark ? ok(0.05, 0.01, h) : ok(0.24, Math.max(0.02, tc), h);

  ink = ensureContrast(ensureContrast(ink, surface, 4.6), canvas, 4.6);
  muted = ensureContrast(muted, surface, 4.6);
  edge = ensureContrast(edge, canvas, 3.05);
  focus = ensureContrast(focus, canvas, 3.1);
  // Accent fills carry text: pick the ink side with more room, then nudge the accent if needed.
  const light = ok(0.985, 0.01, p.accentHue);
  const darkInk = ok(0.2, Math.min(0.05, ac * 0.3), p.accentHue);
  let accentInk = contrast(light, accent) >= contrast(darkInk, accent) ? light : darkInk;
  if (contrast(accentInk, accent) < 4.6) accent = ensureContrast(accent, accentInk, 4.6);
  accentInk = ensureContrast(accentInk, accent, 4.6);
  const dangerInk = ensureContrast(dark ? ok(0.2, 0.03, 25) : ok(0.99, 0.005, 25), danger, 4.6);

  const t = (c: Oklch) => formatOklch(c);
  return {
    'color.canvas': t(canvas),
    'color.surface': t(surface),
    'color.well': t(well),
    'color.ink': t(ink),
    'color.ink-muted': t(muted),
    'color.edge': t(edge),
    'color.accent': t(accent),
    'color.accent-ink': t(accentInk),
    'color.danger': t(danger),
    'color.danger-ink': t(dangerInk),
    'color.focus': t(focus),
    'color.shadow': t(shadow),
  };
}

/** Reads intent-level inputs back from colour tokens (for editing an existing skin). */
export function paletteFromTokens(tokens: Record<string, unknown>, scheme: 'light' | 'dark'): PaletteInput {
  const surface = parseColor(String(tokens['color.surface'] ?? '')) ?? parseColor(String(tokens['color.canvas'] ?? ''));
  const accent = parseColor(String(tokens['color.accent'] ?? ''));
  return {
    scheme,
    hue: surface && surface.c > 0.002 ? Math.round(surface.h) : 260,
    tint: surface ? Math.min(1, Number((surface.c / 0.035).toFixed(2))) : 0.2,
    accentHue: accent ? Math.round(accent.h) : 45,
    accentChroma: accent ? Number(accent.c.toFixed(3)) : 0.16,
    crispness: 0.5,
  };
}
