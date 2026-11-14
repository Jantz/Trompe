/**
 * Plain language to skin. `skinFromDescription("walnut and brass, warm amber accent, low evening
 * light")` returns a complete, contrast-checked skin plus notes explaining every decision, so an
 * agent (or a person in the Studio) can start from words and then refine. Deterministic: the same
 * words always give the same skin. Unknown words are ignored and listed in the notes.
 */
import { compileSkin } from './compile.js';
import { textureDefaultStrength } from './textures.js';
import { materialPresets, presetSpec, type MaterialPreset } from './presets.js';
import { paletteTokens, type PaletteInput } from './palette.js';
import { parseColor } from './color.js';
import { fixContrast } from './validate.js';
import type { Skin, SkinElement } from './types.js';

export interface DescribeResult {
  skin: Skin;
  /** One line per decision, in order, e.g. "Surfaces: walnut (from “walnut”)". */
  notes: string[];
}

export interface DescribeOptions {
  /** Skin name. Default: derived from the description. */
  name?: string;
}

interface Colour {
  hue: number;
  chroma: number;
  /** Lightness hint for neutrals (cream, charcoal...). */
  l?: number;
}

/** Colour words: hue (degrees), chroma (OKLCH) and an optional lightness hint. */
const COLOURS: Record<string, Colour> = {
  red: { hue: 27, chroma: 0.19 }, crimson: { hue: 20, chroma: 0.2 }, scarlet: { hue: 30, chroma: 0.21 }, burgundy: { hue: 15, chroma: 0.12, l: 0.38 }, wine: { hue: 10, chroma: 0.12, l: 0.38 }, oxblood: { hue: 22, chroma: 0.12, l: 0.36 },
  coral: { hue: 35, chroma: 0.15 }, orange: { hue: 50, chroma: 0.18 }, tangerine: { hue: 55, chroma: 0.19 }, rust: { hue: 42, chroma: 0.13, l: 0.5 }, terracotta: { hue: 40, chroma: 0.12 }, copper: { hue: 48, chroma: 0.12 },
  amber: { hue: 70, chroma: 0.16 }, honey: { hue: 75, chroma: 0.13 }, mustard: { hue: 90, chroma: 0.14 }, yellow: { hue: 95, chroma: 0.17 }, gold: { hue: 85, chroma: 0.13 }, golden: { hue: 80, chroma: 0.14 },
  lime: { hue: 128, chroma: 0.19 }, olive: { hue: 115, chroma: 0.08, l: 0.5 }, sage: { hue: 140, chroma: 0.05 }, green: { hue: 150, chroma: 0.15 }, emerald: { hue: 160, chroma: 0.15 }, forest: { hue: 150, chroma: 0.09, l: 0.4 }, mint: { hue: 165, chroma: 0.1 },
  teal: { hue: 190, chroma: 0.11 }, turquoise: { hue: 185, chroma: 0.13 }, cyan: { hue: 205, chroma: 0.13 }, aqua: { hue: 200, chroma: 0.12 },
  sky: { hue: 230, chroma: 0.11 }, blue: { hue: 255, chroma: 0.17 }, cobalt: { hue: 262, chroma: 0.18 }, navy: { hue: 262, chroma: 0.09, l: 0.3 }, denim: { hue: 250, chroma: 0.08 }, indigo: { hue: 275, chroma: 0.17 }, ultramarine: { hue: 268, chroma: 0.2 },
  violet: { hue: 295, chroma: 0.17 }, purple: { hue: 305, chroma: 0.16 }, lavender: { hue: 295, chroma: 0.08 }, plum: { hue: 330, chroma: 0.1, l: 0.4 }, magenta: { hue: 335, chroma: 0.22 }, fuchsia: { hue: 340, chroma: 0.22 }, pink: { hue: 355, chroma: 0.13 }, rose: { hue: 5, chroma: 0.12 },
  cream: { hue: 85, chroma: 0.03, l: 0.94 }, brown: { hue: 55, chroma: 0.07, l: 0.42 }, tan: { hue: 65, chroma: 0.07, l: 0.68 }, chocolate: { hue: 45, chroma: 0.06, l: 0.32 }, ivory: { hue: 90, chroma: 0.02, l: 0.96 }, beige: { hue: 75, chroma: 0.04, l: 0.88 }, sand: { hue: 75, chroma: 0.05, l: 0.85 }, bone: { hue: 85, chroma: 0.02, l: 0.92 },
  grey: { hue: 260, chroma: 0.005 }, gray: { hue: 260, chroma: 0.005 }, slate: { hue: 250, chroma: 0.02, l: 0.4 }, charcoal: { hue: 260, chroma: 0.008, l: 0.27 }, graphite: { hue: 260, chroma: 0.008, l: 0.32 }, white: { hue: 90, chroma: 0.003, l: 0.97 }, black: { hue: 260, chroma: 0.005, l: 0.18 },
};

interface Mood {
  scheme?: 'light' | 'dark';
  surfaces?: string;
  controls?: string;
  accent?: Colour;
  tint?: { hue: number; amount: number };
  realism?: number;
  light?: { angle: number; elevation: number };
  radius?: [number, number, number];
  font?: string;
  motion?: string;
  label: string;
}

/** Genres and moods: whole looks that explicit words then refine. */
const MOODS: Record<string, Mood> = {
  retro: { label: 'late-70s equipment', scheme: 'light', surfaces: 'satin-plastic', controls: 'satin-plastic', accent: COLOURS.orange, tint: { hue: 75, amount: 0.9 }, realism: 0.9, radius: [3, 5, 8], font: 'grotesk' },
  vintage: { label: 'vintage', scheme: 'light', surfaces: 'oak', controls: 'brass', accent: COLOURS.rust, tint: { hue: 75, amount: 0.8 }, realism: 0.9, font: 'serif' },
  y2k: { label: 'turn-of-the-millennium hardware', scheme: 'light', surfaces: 'aluminium', controls: 'chrome', accent: COLOURS.blue, tint: { hue: 250, amount: 0.4 }, realism: 1, radius: [6, 12, 18], font: 'geometric' },
  studio: { label: 'pro studio gear', scheme: 'dark', surfaces: 'anodized-black', controls: 'soft-touch', accent: COLOURS.amber, realism: 1, radius: [3, 5, 8], font: 'grotesk' },
  luxury: { label: 'luxury goods', scheme: 'dark', surfaces: 'black-leather', controls: 'brass', accent: COLOURS.gold, realism: 1, radius: [4, 8, 12], font: 'serif', motion: 'calm' },
  scandinavian: { label: 'Scandinavian calm', scheme: 'light', surfaces: 'oak', controls: 'satin-plastic', accent: COLOURS.sage, tint: { hue: 80, amount: 0.5 }, realism: 0.55, radius: [8, 12, 18], font: 'humanist', motion: 'calm' },
  japanese: { label: 'Japanese paper and wood', scheme: 'light', surfaces: 'paper', controls: 'oak', accent: COLOURS.red, tint: { hue: 85, amount: 0.6 }, realism: 0.6, radius: [2, 4, 6], font: 'serif', motion: 'calm' },
  industrial: { label: 'industrial', scheme: 'light', surfaces: 'concrete', controls: 'gunmetal', accent: COLOURS.orange, realism: 0.9, radius: [2, 3, 4], font: 'mono' },
  automotive: { label: 'automotive interior', scheme: 'dark', surfaces: 'black-leather', controls: 'aluminium', accent: COLOURS.red, realism: 1, radius: [6, 10, 16], font: 'geometric', motion: 'snappy' },
  cyberpunk: { label: 'neon night', scheme: 'dark', surfaces: 'carbon', controls: 'smoked-glass', accent: COLOURS.magenta, tint: { hue: 290, amount: 0.8 }, realism: 0.9, radius: [2, 3, 4], font: 'mono', motion: 'snappy' },
  library: { label: 'old library', scheme: 'dark', surfaces: 'walnut', controls: 'brass', accent: COLOURS.amber, tint: { hue: 60, amount: 0.7 }, realism: 1, radius: [4, 6, 10], font: 'serif', light: { angle: 300, elevation: 35 } },
  kitchen: { label: 'kitchen appliance', scheme: 'light', surfaces: 'aluminium', controls: 'ceramic', accent: COLOURS.teal, realism: 0.8, radius: [10, 14, 22], font: 'rounded' },
  clinical: { label: 'clinical', scheme: 'light', surfaces: 'ceramic', controls: 'satin-plastic', accent: COLOURS.teal, tint: { hue: 200, amount: 0.3 }, realism: 0.45, radius: [8, 12, 16], font: 'humanist' },
  rugged: { label: 'rugged outdoor gear', scheme: 'dark', surfaces: 'soft-touch', controls: 'knurled-steel', accent: COLOURS.orange, realism: 1, radius: [4, 6, 10], font: 'grotesk', motion: 'heavy' },
  playful: { label: 'playful', scheme: 'light', surfaces: 'satin-plastic', controls: 'candy', accent: COLOURS.pink, tint: { hue: 350, amount: 0.6 }, realism: 0.8, radius: [12, 18, 28], font: 'rounded', motion: 'bouncy' },
  fintech: { label: 'premium finance', scheme: 'dark', surfaces: 'titanium', controls: 'titanium', accent: COLOURS.emerald, tint: { hue: 255, amount: 0.6 }, realism: 0.7, radius: [6, 10, 14], font: 'geometric' },
  editorial: { label: 'editorial print', scheme: 'light', surfaces: 'paper', controls: 'paper', accent: COLOURS.red, tint: { hue: 85, amount: 0.5 }, realism: 0.4, radius: [0, 2, 3], font: 'serif' },
  nautical: { label: 'nautical', scheme: 'light', surfaces: 'oak', controls: 'brass', accent: COLOURS.navy, tint: { hue: 240, amount: 0.4 }, realism: 0.9, font: 'serif' },
  gaming: { label: 'gaming rig', scheme: 'dark', surfaces: 'carbon', controls: 'soft-touch', accent: COLOURS.lime, realism: 1, radius: [3, 5, 8], font: 'geometric', motion: 'snappy' },
  spa: { label: 'calm wellness', scheme: 'light', surfaces: 'concrete', controls: 'ceramic', accent: COLOURS.sage, tint: { hue: 120, amount: 0.5 }, realism: 0.55, radius: [12, 18, 26], font: 'humanist', motion: 'calm' },
  cafe: { label: 'neighbourhood café', scheme: 'light', surfaces: 'walnut', controls: 'ceramic', accent: COLOURS.terracotta, tint: { hue: 70, amount: 0.8 }, realism: 0.85, font: 'humanist' },
  minimal: { label: 'minimal', scheme: 'light', surfaces: 'satin-plastic', controls: 'satin-plastic', accent: COLOURS.blue, tint: { hue: 260, amount: 0.15 }, realism: 0.2, font: 'system' },
};

const MOOD_WORDS: Record<string, string> = {
  retro: 'retro', '70s': 'retro', '1970s': 'retro', '80s': 'retro', '1980s': 'retro', heritage: 'retro', vintage: 'vintage', antique: 'vintage', classic: 'vintage',
  y2k: 'y2k', millennium: 'y2k', '2000s': 'y2k', aqua: 'y2k',
  studio: 'studio', pro: 'studio', rack: 'studio', audio: 'studio', hardware: 'studio',
  luxury: 'luxury', luxurious: 'luxury', premium: 'luxury', boutique: 'luxury', watch: 'luxury', jewellery: 'luxury',
  scandinavian: 'scandinavian', nordic: 'scandinavian', hygge: 'scandinavian',
  japanese: 'japanese', zen: 'japanese', washi: 'japanese',
  industrial: 'industrial', brutalist: 'industrial', factory: 'industrial', workshop: 'industrial',
  automotive: 'automotive', car: 'automotive', cockpit: 'automotive', racing: 'automotive', motorsport: 'automotive',
  cyberpunk: 'cyberpunk', neon: 'cyberpunk', synthwave: 'cyberpunk', futuristic: 'cyberpunk',
  library: 'library', academia: 'library', study: 'library', scholarly: 'library',
  kitchen: 'kitchen', appliance: 'kitchen', home: 'kitchen',
  clinical: 'clinical', medical: 'clinical', lab: 'clinical', laboratory: 'clinical', health: 'clinical', hospital: 'clinical',
  rugged: 'rugged', outdoor: 'rugged', field: 'rugged', tactical: 'rugged', adventure: 'rugged', submarine: 'rugged', bunker: 'rugged', military: 'rugged', expedition: 'rugged',
  playful: 'playful', toy: 'playful', kids: 'playful', fun: 'playful', cheerful: 'playful',
  fintech: 'fintech', banking: 'fintech', bank: 'fintech', finance: 'fintech', trading: 'fintech', wallet: 'fintech',
  editorial: 'editorial', magazine: 'editorial', newspaper: 'editorial', journal: 'editorial', literary: 'editorial',
  nautical: 'nautical', marine: 'nautical', yacht: 'nautical', sailing: 'nautical',
  gaming: 'gaming', gamer: 'gaming', esports: 'gaming',
  spa: 'spa', wellness: 'spa', meditation: 'spa', calm: 'spa',
  cafe: 'cafe', café: 'cafe', coffee: 'cafe', bakery: 'cafe', restaurant: 'cafe',
  minimal: 'minimal', minimalist: 'minimal', clean: 'minimal', simple: 'minimal',
};

const FONTS: Record<string, { stack: string; label: string }> = {
  system: { label: 'system sans', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
  humanist: { label: 'humanist sans', stack: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif' },
  geometric: { label: 'geometric sans', stack: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif' },
  grotesk: { label: 'neo-grotesque', stack: 'Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif' },
  rounded: { label: 'rounded sans', stack: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif' },
  serif: { label: 'transitional serif', stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
  didone: { label: 'high-contrast serif', stack: 'Didot, "Bodoni MT", "Noto Serif Display", "URW Palladio L", P052, Sylfaen, serif' },
  mono: { label: 'monospace', stack: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace' },
};
const FONT_WORDS: Record<string, string> = {
  serif: 'serif', bookish: 'serif', literary: 'serif', elegant: 'didone', fashion: 'didone', didone: 'didone', mono: 'mono', monospace: 'mono', terminal: 'mono', technical: 'mono', code: 'mono',
  geometric: 'geometric', modern: 'geometric', rounded: 'rounded', friendly: 'rounded', soft: 'rounded', humanist: 'humanist', warm: 'humanist', swiss: 'grotesk', grotesk: 'grotesk', neutral: 'grotesk',
};

export const MOTION: Record<string, { label: string; press: number; release: number; travel: number; easing: string }> = {
  snappy: { label: 'snappy', press: 50, release: 110, travel: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  calm: { label: 'calm', press: 90, release: 240, travel: 320, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  bouncy: { label: 'bouncy', press: 70, release: 200, travel: 280, easing: 'linear(0, 0.3 8%, 0.95 22%, 1.12 32%, 1.06 45%, 0.98 62%, 1)' },
  heavy: { label: 'heavy', press: 110, release: 260, travel: 360, easing: 'cubic-bezier(0.6, 0, 0.3, 1)' },
};
const MOTION_WORDS: Record<string, string> = {
  snappy: 'snappy', fast: 'snappy', quick: 'snappy', crisp: 'snappy', responsive: 'snappy', calm: 'calm', smooth: 'calm', slow: 'calm', relaxed: 'calm', gentle: 'calm',
  bouncy: 'bouncy', springy: 'bouncy', playful: 'bouncy', elastic: 'bouncy', heavy: 'heavy', solid: 'heavy', mechanical: 'heavy', weighty: 'heavy', chunky: 'heavy',
};

const REALISM_WORDS: Record<string, number> = {
  flat: 0.05, minimal: 0.2, clean: 0.3, subtle: 0.35, understated: 0.35, gentle: 0.4, soft: 0.45, tactile: 0.65, physical: 0.85, realistic: 1, real: 1, 'hyper-real': 1, hyperreal: 1, photoreal: 1, photorealistic: 1, rich: 0.95, skeuomorphic: 1, '3d': 1,
};

/** "from the top left" and friends: where the light comes from, as --tr-light-angle (0 = top, clockwise). */
const LIGHT_FROM: Record<string, number> = {
  top: 0, above: 0, 'top-right': 45, right: 60, 'bottom-right': 135, bottom: 180, below: 180, 'bottom-left': 225, left: 290, 'top-left': 315,
};

const LIGHT_WORDS: Record<string, { angle?: number; elevation?: number; label: string }> = {
  morning: { angle: 300, elevation: 35, label: 'low morning light from the left' },
  noon: { angle: 0, elevation: 78, label: 'high noon light from above' },
  overhead: { angle: 0, elevation: 75, label: 'overhead light' },
  evening: { angle: 60, elevation: 25, label: 'low evening light from the right' },
  sunset: { angle: 65, elevation: 20, label: 'low sunset light' },
  golden: { angle: 60, elevation: 25, label: 'golden-hour light' },
  dramatic: { elevation: 28, label: 'dramatic low light' },
  moody: { elevation: 32, label: 'moody low light' },
  softbox: { angle: 345, elevation: 60, label: 'studio softbox light' },
  window: { angle: 300, elevation: 45, label: 'window light from the left' },
};

const SHAPE_WORDS: Record<string, { r: [number, number, number]; label: string; pill?: boolean }> = {
  sharp: { r: [0, 2, 3], label: 'sharp corners' }, square: { r: [0, 2, 3], label: 'square corners' }, angular: { r: [1, 2, 4], label: 'angular corners' }, crisp: { r: [2, 4, 6], label: 'crisp corners' },
  rounded: { r: [10, 16, 24], label: 'rounded corners' }, round: { r: [10, 16, 24], label: 'rounded corners' }, soft: { r: [10, 14, 22], label: 'soft corners' }, friendly: { r: [10, 16, 24], label: 'friendly round corners' },
  pill: { r: [10, 16, 26], label: 'pill-shaped controls', pill: true }, pills: { r: [10, 16, 26], label: 'pill-shaped controls', pill: true }, bubbly: { r: [14, 20, 30], label: 'bubbly round shapes', pill: true },
};

/** Words that make the colour after them vivid: "neon green", "electric blue". */
const VIVID = new Set(['neon', 'electric', 'vivid', 'fluorescent', 'fluoro', 'acid', 'bright', 'hot']);
const ACCENT_CUES = new Set(['lighting', 'lamps', 'lamp', 'emergency', 'neon', 'accent', 'accents', 'accented', 'highlight', 'highlights', 'pop', 'pops', 'details', 'detail', 'trim', 'buttons', 'button', 'lights', 'glow', 'leds', 'led', 'type']);
const CONTROL_CUES = new Set(['buttons', 'button', 'controls', 'control', 'keys', 'key', 'knobs', 'knob', 'switches', 'switch', 'toggles', 'dials', 'dial', 'trim', 'hardware', 'handles', 'fittings']);
const SURFACE_CUES = new Set(['panels', 'panel', 'cards', 'card', 'surfaces', 'surface', 'body', 'case', 'background', 'desk', 'top', 'base', 'walls', 'chassis']);

/** Every word the generator understands, by category. Useful for agents and autocomplete. */
export const describeVocabulary = {
  moods: Object.keys(MOOD_WORDS),
  materials: materialPresets.flatMap((p) => [p.id, ...p.keywords]),
  colours: Object.keys(COLOURS),
  realism: Object.keys(REALISM_WORDS),
  light: [...Object.keys(LIGHT_WORDS), ...Object.keys(LIGHT_FROM).map((d) => `from the ${d.replace('-', ' ')}`)],
  shape: Object.keys(SHAPE_WORDS),
  type: Object.keys(FONT_WORDS),
  motion: Object.keys(MOTION_WORDS),
  scheme: ['dark', 'light', 'night', 'midnight', 'bright', 'airy', 'daylight'],
};

/** Material keyword index: word -> preset id. Multi-word keys use hyphens ("rose-gold"). */
const MATERIAL_INDEX = new Map<string, string>();
for (const p of materialPresets) {
  MATERIAL_INDEX.set(p.id, p.id);
  for (const k of p.keywords) if (!MATERIAL_INDEX.has(k)) MATERIAL_INDEX.set(k, p.id);
}
// A few plain words that are clearer as materials than as moods or colours.
for (const [w, id] of Object.entries({ wood: 'walnut', wooden: 'walnut', metal: 'aluminium', steel: 'aluminium', stainless: 'aluminium', stone: 'concrete', hinoki: 'oak', cedar: 'oak', maple: 'oak', pine: 'oak', beech: 'oak', bamboo: 'oak', teak: 'walnut', mahogany: 'walnut', rosewood: 'ebony', iron: 'gunmetal', 'cast-iron': 'gunmetal', washi: 'paper', cork: 'kraft', tweed: 'linen', wool: 'felt', porcelain: 'ceramic', enamel: 'lacquer', pewter: 'titanium', silver: 'aluminium', velvet: 'charcoal-felt', suede: 'charcoal-felt', glass: 'frosted-glass' })) MATERIAL_INDEX.set(w, id);
const FINISH_WORDS: Record<string, 'brushed' | 'mirror' | 'gloss' | 'satin' | 'matte' | 'spun'> = { brushed: 'brushed', polished: 'mirror', mirrored: 'mirror', glossy: 'gloss', lacquered: 'gloss', satin: 'satin', matte: 'matte', matt: 'matte', spun: 'spun' };
const NOT_MATERIAL = new Set(['pro', 'gear', 'card', 'print', 'product', 'neutral', 'home', 'study', 'library', 'industrial', 'brutal', 'brutalist', 'performance', 'racing', 'car', 'automotive', 'clinical', 'appliance', 'luxury', 'playful', 'toy', 'y2k', 'millennium', 'scandinavian', 'nordic', 'editorial', 'nautical', 'rugged', 'tool', 'grip', 'casino', 'acoustic', 'glossy', 'bubbly', 'mirror', 'polished', 'midcentury', 'mid-century', 'hifi', 'rack']);

const preset = (id: string) => materialPresets.find((p) => p.id === id)!;
const words = (text: string) => {
  const raw = text
    .toLowerCase()
    .replace(/[“”"']/g, ' ')
    .replace(/carbon fib(er|re)/g, 'carbon-fibre')
    .replace(/rose gold/g, 'rose-gold')
    .replace(/soft touch/g, 'soft-touch')
    .replace(/piano black/g, 'piano-black')
    .replace(/mid[ -]century/g, 'mid-century')
    .replace(/golden hour/g, 'golden')
    .replace(/hyper[ -]real(istic)?/g, 'hyper-real')
    .replace(/black leather/g, 'black-leather')
    .replace(/(light|blonde|pale|bleached|whitewashed) wood/g, 'light-wood')
    .replace(/cast iron/g, 'cast-iron')
    .replace(/anodi[sz]ed (aluminium|aluminum|alloy|metal)/g, 'anodised')
    .replace(/black marble/g, 'black-marble')
    .replace(/\b(top|upper|bottom|lower)[ -](left|right)\b/g, (_, v, h) => `${v === 'upper' ? 'top' : v === 'lower' ? 'bottom' : v}-${h}`)
    .match(/[a-zà-ÿ0-9-]+/g);
  // "cobalt-blue", "sea-green", "warm-white": a compound colour reads as its first known colour.
  return (raw ?? []).map((x) => {
    if (!x.includes('-') || COLOURS[x]) return x;
    const parts = x.split('-');
    return parts.every((p) => COLOURS[p] || ['warm', 'cool', 'deep', 'dark', 'pale', 'light', 'soft', 'bright', 'dusty', 'sea', 'electric', 'neon', 'off'].includes(p)) ? (parts.find((p) => COLOURS[p]) ?? x) : x;
  });
};

const baseLightness = (p: MaterialPreset) => parseColor(p.spec.vars?.['--tr-m-base'] ?? '')?.l ?? (p.spec.material === 'rubber' ? 0.25 : undefined);

function tintPreset(spec: SkinElement, c: Colour): SkinElement {
  const base = parseColor(spec.vars?.['--tr-m-base'] ?? '');
  const l = c.l ?? base?.l ?? 0.6;
  const chroma = Math.min(c.chroma, spec.material === 'metal' || spec.material === 'chrome' ? 0.12 : spec.texture ? 0.1 : 0.16);
  const fmt = (L: number, C: number, H: number) => `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
  return { ...spec, vars: { ...(spec.vars ?? {}), '--tr-m-base': fmt(l, chroma, c.hue), '--tr-m-ink': l > 0.6 ? fmt(0.2, Math.min(0.04, chroma), c.hue) : fmt(0.97, 0.01, c.hue) } };
}

/** Words about what the app is, not how it looks. Ignored quietly. */
const APP_WORDS = new Set(['house', 'room', 'office', 'space', 'place', 'home', 'studio', 'shopfront', 'settings', 'dashboard', 'table', 'corners', 'corner', 'checkout', 'form', 'forms', 'page', 'pages', 'screen', 'screens', 'website', 'site', 'admin', 'console', 'tool', 'tools', 'editor', 'player', 'store', 'shop', 'mobile', 'desktop', 'backdrop', 'behind', 'everything', 'everywhere', 'feeling', 'vibe', 'vibes', 'mood', 'aesthetic', 'design', 'system', 'interface', 'controls', 'panels', 'lights', 'type', 'typography', 'font', 'fonts', 'text']);

const slug = (s: string) => s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Generates a complete skin from a plain-language description. */
export function skinFromDescription(text: string, options: DescribeOptions = {}): DescribeResult {
  const w = words(text);
  const notes: string[] = [];
  const used = new Set<number>();

  // 0. Negation: "no wood", "without brass", "not glossy". A family word bans the family.
  const banned = new Set<string>();
  const bannedFamilies = new Set<string>();
  const FAMILY_WORDS: Record<string, string> = { wood: 'wood', wooden: 'wood', timber: 'wood', metal: 'metal', metallic: 'metal', leather: 'leather', glass: 'glass', plastic: 'plastic', stone: 'mineral', fabric: 'textile', textile: 'textile', paper: 'paper' };
  for (let i = 0; i < w.length; i++) {
    if (!['no', 'without', 'not', 'never', 'avoid', 'nothing'].includes(w[i]!)) continue;
    used.add(i);
    for (let j = i + 1; j < Math.min(w.length, i + 4); j++) {
      const x = w[j]!;
      if (['and', 'or', 'nor', 'any', 'too', 'much', 'real'].includes(x)) {
        used.add(j);
        continue;
      }
      if (FAMILY_WORDS[x]) bannedFamilies.add(FAMILY_WORDS[x]!);
      else if (MATERIAL_INDEX.has(x)) banned.add(MATERIAL_INDEX.get(x)!);
      else if (FINISH_WORDS[x] || COLOURS[x] || REALISM_WORDS[x] !== undefined) banned.add(`word:${x}`);
      else break;
      used.add(j);
      if (!['and', 'or', 'nor'].includes(w[j + 1] ?? '')) break;
    }
  }
  const allowed = (id: string | undefined) => !!id && !banned.has(id) && !bannedFamilies.has(preset(id).family);
  if (banned.size || bannedFamilies.size)
    notes.push(`Avoiding: ${[...bannedFamilies, ...[...banned].map((b) => b.replace('word:', ''))].join(', ')}`);
  const skip = (i: number) => used.has(i) && (i > 0 && ['no', 'without', 'not', 'never', 'avoid', 'and', 'or', 'nor'].includes(w[i - 1]!) || banned.has(`word:${w[i]}`));

  // 1. Mood / genre: the base look.
  let mood: Mood | undefined;
  for (let i = 0; i < w.length; i++) {
    const m = MOOD_WORDS[w[i]!];
    if (VIVID.has(w[i]!) && COLOURS[w[i + 1] ?? '']) continue; // "neon green": a colour, not the look
    if (m && !skip(i) && (!MATERIAL_INDEX.has(w[i]!) || NOT_MATERIAL.has(w[i]!))) {
      mood = MOODS[m];
      used.add(i);
      notes.push(`Look: ${mood!.label} (from “${w[i]}”)`);
      break;
    }
  }

  // 2. Materials in order of mention, with their role cues ("brass knobs", "walnut panels").
  type Mat = { id: string; at: number; role?: 'surfaces' | 'controls'; tint?: Colour; finish?: (typeof FINISH_WORDS)[string] };
  const mats: Mat[] = [];
  for (let i = 0; i < w.length; i++) {
    // "cobalt accent", "copper highlights": a colour word right before an accent cue is a colour, not a material.
    if (COLOURS[w[i]!] && ['accent', 'accents', 'accented', 'highlight', 'highlights', 'pop', 'pops'].includes(w[i + 1] ?? '')) continue;
    const id = MATERIAL_INDEX.get(w[i]!);
    // "brushed titanium", "polished brass": a finish word before a material modifies it.
    if (FINISH_WORDS[w[i]!] && [w[i + 1], w[i + 2]].some((x) => MATERIAL_INDEX.has(x ?? '') && !NOT_MATERIAL.has(x!) && !FINISH_WORDS[x!])) {
      continue; // bound when the material is reached
    }
    // "hinoki wood", "walnut wood", "brass metal": the family word belongs to the material before it.
    const prevMat = mats[mats.length - 1];
    if (id && FAMILY_WORDS[w[i]!] && prevMat && prevMat.at >= i - 1 && preset(prevMat.id).family === preset(id).family) {
      used.add(i);
      continue;
    }
    if (!id || NOT_MATERIAL.has(w[i]!) || mats.some((m) => m.id === id) || !allowed(id) || (used.has(i) && skip(i))) {
      if (id) used.add(i);
      continue;
    }
    used.add(i);
    const next = w.slice(i + 1, i + 3);
    const role = next.some((x) => CONTROL_CUES.has(x)) ? 'controls' : next.some((x) => SURFACE_CUES.has(x)) ? 'surfaces' : undefined;
    // Adjectives bind to the material they come before, up to two words back: "matte black iron",
    // "pale hinoki wood", "deep green leather".
    let tint: Colour | undefined;
    let finish: (typeof FINISH_WORDS)[string] | undefined;
    let tone: 'pale' | 'dark' | undefined;
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
      const x = w[j]!;
      if (MATERIAL_INDEX.has(x) && !COLOURS[x] && !FINISH_WORDS[x] && !['light-wood'].includes(x)) break;
      if (!tint && COLOURS[x] && !(MATERIAL_INDEX.has(x) && !COLOURS[x])) {
        tint = COLOURS[x];
        used.add(j);
      } else if (!finish && FINISH_WORDS[x]) {
        finish = FINISH_WORDS[x];
        used.add(j);
      } else if (!tone && ['pale', 'light', 'bleached', 'blonde', 'whitewashed', 'pastel'].includes(x)) {
        tone = 'pale';
        used.add(j);
      } else if (!tone && ['dark', 'deep', 'smoked', 'aged', 'rich'].includes(x)) {
        tone = 'dark';
        used.add(j);
      }
    }
    let pick = id;
    if (tone === 'pale' && preset(id).family === 'wood' && allowed('oak')) pick = 'oak';
    if (tone === 'dark' && preset(id).family === 'wood' && id === 'oak') pick = 'walnut';
    if (tone && !tint && pick === id) {
      const base = parseColor(preset(id).spec.vars?.['--tr-m-base'] ?? '');
      if (base) tint = { hue: base.h, chroma: base.c, l: tone === 'pale' ? Math.max(base.l, 0.82) : Math.min(base.l, 0.3) };
    }
    mats.push({ id: pick, at: i, ...(role ? { role } : {}), ...(tint ? { tint } : {}), ...(finish ? { finish } : {}) });
  }

  let surfaces = mats.find((m) => m.role === 'surfaces');
  let controls = mats.find((m) => m.role === 'controls');
  // With three or more materials, hardware reads best in metal: give controls the first metal.
  if (!controls && mats.length > 2) controls = mats.find((m) => m !== surfaces && preset(m.id).family === 'metal');
  for (const m of mats) {
    const p = preset(m.id);
    if (m === surfaces || m === controls) continue;
    if (!surfaces && p.use.surfaces && !(controls === undefined && p.family === 'metal' && mats.length > 1 && !mats.some((x) => x !== m && preset(x.id).family === 'metal'))) surfaces = m;
    else if (!controls && p.use.controls) controls = m;
    else if (!surfaces && p.use.surfaces) surfaces = m;
  }
  if (surfaces && !controls && mats.length === 1 && preset(surfaces.id).family === 'metal' && !mood) controls = surfaces;
  // A further surface material dresses menus and dialogs ("washi paper" in a wood-and-iron room).
  const extra = mats.find((m) => m !== surfaces && m !== controls && preset(m.id).use.surfaces);
  const firstAllowed = (...ids: (string | undefined)[]) => ids.find((x) => allowed(x)) ?? 'satin-plastic';
  const surfaceId = surfaces?.id ?? firstAllowed(mood?.surfaces, controls && preset(controls.id).use.surfaces ? controls.id : undefined, 'satin-plastic', 'ceramic');
  const controlId = controls?.id ?? firstAllowed(mood?.controls, surfaces && preset(surfaces.id).use.controls && !preset(surfaces.id).spec.texture ? surfaces.id : undefined, 'satin-plastic', 'aluminium');
  let surfaceSpec = presetSpec(surfaceId)!;
  let controlSpec = presetSpec(controlId)!;
  if (surfaces?.tint) surfaceSpec = tintPreset(surfaceSpec, surfaces.tint);
  if (controls?.tint) controlSpec = tintPreset(controlSpec, controls.tint);
  if (surfaces?.finish) surfaceSpec = { ...surfaceSpec, finish: surfaces.finish };
  if (controls?.finish) controlSpec = { ...controlSpec, finish: controls.finish };
  notes.push(`Surfaces: ${preset(surfaceId).label.toLowerCase()}${surfaces ? ` (from “${w[surfaces.at]}”)` : mood ? ' (from the look)' : ' (default)'}`);
  notes.push(`Controls: ${preset(controlId).label.toLowerCase()}${controls ? ` (from “${w[controls.at]}”)` : mood ? ' (from the look)' : ' (default)'}`);

  // 3. Colour scheme.
  let scheme: 'light' | 'dark' | undefined;
  for (let i = 0; i < w.length; i++) {
    if (['dark', 'night', 'midnight', 'noir', 'moody', 'black', 'nocturnal'].includes(w[i]!) && !(w[i] === 'black' && MATERIAL_INDEX.has(w[i + 1] ?? ''))) {
      scheme = 'dark';
      used.add(i);
      notes.push(`Scheme: dark (from “${w[i]}”)`);
      break;
    }
    const lightAsScheme = w[i] !== 'light' || ['mode', 'theme', 'scheme', 'ui', 'interface', 'background', 'palette', 'look', 'and'].includes(w[i + 1] ?? '') || i === 0;
    if (['light', 'bright', 'airy', 'daylight', 'white', 'pale'].includes(w[i]!) && lightAsScheme && !(w[i] === 'bright' && COLOURS[w[i + 1] ?? '']) && w[i + 1] !== 'wood' && !MATERIAL_INDEX.has(w[i + 1] ?? '') && !LIGHT_WORDS[w[i - 1] ?? '']) {
      scheme = 'light';
      used.add(i);
      notes.push(`Scheme: light (from “${w[i]}”)`);
      break;
    }
  }
  if (!scheme) {
    const L = baseLightness(preset(surfaceId)) ?? parseColor(surfaceSpec.vars?.['--tr-m-base'] ?? '')?.l;
    scheme = mood?.scheme ?? (L !== undefined && L < 0.5 ? 'dark' : 'light');
    notes.push(`Scheme: ${scheme} (${mood?.scheme ? 'from the look' : L !== undefined && L < 0.5 ? `${preset(surfaceId).label.toLowerCase()} is dark` : 'default'})`);
  }

  // 4. Colours: accent and neutral tint.
  let accent: Colour | undefined;
  let tint: { hue: number; amount: number } | undefined = mood?.tint;
  const free: { c: Colour; word: string; i: number }[] = [];
  for (let i = 0; i < w.length; i++) {
    let c = COLOURS[w[i]!];
    if (c && VIVID.has(w[i - 1] ?? '')) {
      c = { ...c, chroma: Math.max(c.chroma * 1.4, 0.24), l: Math.max(c.l ?? 0.8, 0.82) };
      used.add(i - 1);
    }
    if (!c || used.has(i) || (MATERIAL_INDEX.has(w[i]!) && !NOT_MATERIAL.has(w[i]!) && mats.some((m) => m.at === i))) continue;
    const cue = (k: number) => ACCENT_CUES.has(w[k] ?? '') && !COLOURS[w[k + 1] ?? '']; // "black neon green": neon belongs to green
    const cueAt = cue(i + 1) ? i + 1 : !COLOURS[w[i + 1] ?? ''] && cue(i + 2) ? i + 2 : -1;
    if (cueAt > 0 && !accent && (c.chroma > 0.04 || ['accent', 'accents', 'accented'].includes(w[cueAt]!))) {
      accent = c;
      used.add(i);
      notes.push(`Accent: ${w[i]} (hue ${c.hue}°)`);
    } else free.push({ c, word: w[i]!, i });
  }
  const unusedColours: string[] = [];
  for (const f of free) {
    used.add(f.i);
    if (!accent && f.c.chroma > 0.04) {
      accent = f.c;
      notes.push(`Accent: ${f.word} (hue ${f.c.hue}°)`);
    } else if (!tint || tint === mood?.tint) {
      tint = { hue: f.c.hue, amount: f.c.chroma > 0.04 ? 0.8 : 0.5 };
      notes.push(`Neutral tint: ${f.word}`);
      if (f.c.l !== undefined && !scheme) scheme = f.c.l < 0.5 ? 'dark' : 'light';
    } else unusedColours.push(f.word);
  }
  // Say so when a colour word had no slot left, so the caller can set it by hand.
  if (unusedColours.length) notes.push(`Colours not used (accent and tint were already set): ${unusedColours.join(', ')}. Set them with tokens such as color.accent if you meant them.`);
  // Temperature words: "warm and cozy" pulls neutrals and the default accent warm, "icy" cool.
  const warmAt = w.findIndex((x, i) => ['warm', 'cozy', 'cosy', 'inviting', 'homely', 'snug', 'earthy', 'sunny'].includes(x) && !skip(i));
  const coolAt = w.findIndex((x, i) => ['cool', 'icy', 'cold', 'arctic', 'frosty', 'wintry', 'clinical'].includes(x) && !skip(i));
  const temp = warmAt >= 0 && (coolAt < 0 || warmAt < coolAt) ? 'warm' : coolAt >= 0 ? 'cool' : undefined;
  if (temp) {
    w.forEach((x, i) => ['warm', 'cozy', 'cosy', 'inviting', 'homely', 'snug', 'earthy', 'sunny', 'cool', 'icy', 'cold', 'arctic', 'frosty', 'wintry'].includes(x) && used.add(i));
    const tAt = temp === 'warm' ? warmAt : coolAt;
    const after = COLOURS[w[tAt + 1] ?? ''];
    // "warm white", "cool grey": a hint of temperature on a near-neutral, not a coloured room.
    const subtle = !!after && after.chroma <= 0.04;
    if (!tint || tint === mood?.tint) tint = temp === 'warm' ? { hue: 65, amount: subtle ? 0.35 : 0.9 } : { hue: 235, amount: subtle ? 0.35 : 0.8 };
    notes.push(`Temperature: ${temp} neutrals (from “${w[temp === 'warm' ? warmAt : coolAt]}”)`);
    if (!accent && (!mood?.accent || (temp === 'warm' ? Math.abs(((mood.accent.hue - 60 + 540) % 360) - 180) > 70 : false))) accent = temp === 'warm' ? COLOURS.amber! : COLOURS.sky!;
  }
  // A named coloured metal ("brushed gold details", "copper knobs") sets the accent before a look does.
  const METAL_ACCENT: Record<string, Colour> = { gold: COLOURS.gold!, brass: { hue: 80, chroma: 0.12 }, copper: COLOURS.copper!, 'rose-gold': COLOURS.rose! };
  const namedMetal = [controls, surfaces].find((m) => m && METAL_ACCENT[m.id]);
  if (!accent && namedMetal) {
    accent = METAL_ACCENT[namedMetal.id]!;
    notes.push(`Accent: ${preset(namedMetal.id).label.toLowerCase()} (from “${w[namedMetal.at]}”)`);
  }
  if (!accent) {
    accent = mood?.accent ?? (preset(controlId).family === 'metal' ? COLOURS.amber! : COLOURS.blue!);
    notes.push(`Accent: hue ${accent.hue}° (${mood?.accent ? 'from the look' : 'default'})`);
  }
  if (!tint) {
    const sb = parseColor(surfaceSpec.vars?.['--tr-m-base'] ?? '');
    tint = sb && sb.c > 0.01 ? { hue: sb.h, amount: 0.6 } : { hue: 260, amount: 0.25 };
  }

  // 5. Realism, light, shape, type, motion.
  let realism = mood?.realism ?? 0.85;
  let light = { angle: 330, elevation: 55, ...(mood?.light ?? {}) };
  let radius = mood?.radius ?? ([6, 10, 16] as [number, number, number]);
  let pill = false;
  let font = mood?.font;
  let motion = mood?.motion;
  let realismWord: string | undefined;
  let chromaScale = 1;
  for (let i = 0; i < w.length; i++) {
    const x = w[i]!;
    if (REALISM_WORDS[x] !== undefined && !(x === 'soft' && w[i + 1] && SHAPE_WORDS[w[i + 1]!])) {
      realism = REALISM_WORDS[x]!;
      used.add(i);
      realismWord = x;
    }
    if (['vivid', 'saturated', 'bold', 'electric', 'vibrant', 'loud'].includes(x)) {
      chromaScale = 1.35;
      used.add(i);
    }
    if (['muted', 'dusty', 'desaturated', 'subdued', 'quiet', 'faded'].includes(x)) {
      chromaScale = 0.55;
      used.add(i);
    }
    if (x === 'low' && (LIGHT_WORDS[w[i + 1] ?? ''] || w[i + 1] === 'light')) {
      light.elevation = Math.min(light.elevation, 28);
      used.add(i);
    }
    if (x === 'light' && (LIGHT_WORDS[w[i - 1] ?? ''] || ['low', 'high', 'soft', 'warm', 'cool', 'hard', 'side'].includes(w[i - 1] ?? ''))) used.add(i);
    if (LIGHT_WORDS[x]) {
      light = { ...light, ...Object.fromEntries(Object.entries(LIGHT_WORDS[x]!).filter(([k]) => k !== 'label')) };
      used.add(i);
      notes.push(`Light: ${LIGHT_WORDS[x]!.label}`);
    }
    const at = w[i + 1] === 'the' ? i + 2 : i + 1;
    if (x === 'from' && LIGHT_FROM[w[at] ?? ''] !== undefined) {
      const dir = w[at]!;
      light.angle = LIGHT_FROM[dir]!;
      used.add(i).add(at).add(i + 1);
      notes.push(`Light: from the ${dir === 'above' ? 'top' : dir === 'below' ? 'bottom' : dir.replace('-', ' ')} (${light.angle}°)`);
    }
    if (SHAPE_WORDS[x]) {
      radius = SHAPE_WORDS[x]!.r;
      pill ||= !!SHAPE_WORDS[x]!.pill;
      used.add(i);
      notes.push(`Shape: ${SHAPE_WORDS[x]!.label}`);
    }
    if (FONT_WORDS[x] && !(x === 'soft' && font)) {
      font = FONT_WORDS[x];
      used.add(i);
    }
    if (MOTION_WORDS[x]) {
      motion = MOTION_WORDS[x];
      used.add(i);
    }
  }
  if (realismWord) notes.push(`Realism: ${Math.round(realism * 100)}% (from “${realismWord}”)`);
  if (chromaScale !== 1) notes.push(`Colour: ${chromaScale > 1 ? 'more vivid' : 'muted'}`);
  if (font) notes.push(`Type: ${FONTS[font]!.label}`);
  if (motion) notes.push(`Motion: ${MOTION[motion]!.label}`);

  // 6. Assemble.
  const palette: PaletteInput = { scheme, hue: tint.hue, tint: tint.amount, accentHue: accent.hue, accentChroma: Math.min(0.3, accent.chroma * chromaScale), crispness: realism > 0.8 ? 0.6 : 0.45 };
  const tokens: Record<string, string | number> = {
    ...paletteTokens(palette),
    'realism.default': Number(realism.toFixed(2)),
    'light.angle': `${light.angle}deg`,
    'light.elevation': `${light.elevation}deg`,
    'radius.sm': `${radius[0]}px`,
    'radius.md': `${radius[1]}px`,
    'radius.lg': `${radius[2]}px`,
  };
  if (font) tokens['font.family'] = FONTS[font]!.stack;
  if (motion) {
    const m = MOTION[motion]!;
    tokens['motion.duration.press'] = `${m.press}ms`;
    tokens['motion.duration.release'] = `${m.release}ms`;
    tokens['motion.duration.travel'] = `${m.travel}ms`;
    tokens['motion.easing.spring'] = m.easing;
  }

  const textured = !!surfaceSpec.texture;
  const surfaceRoles = ['tr-panel', 'tr-nav', 'tr-list', 'tr-toolbar'];
  const controlRoles = ['tr-button', 'tr-switch', 'tr-slider', 'tr-knob', 'tr-segmented'];
  // Fields are recessed wells of the control material (metal controls get metal fields), without
  // texture: text needs a calm, high-contrast ground.
  const ctrl = preset(controlId);
  const ctrlL = parseColor(controlSpec.vars?.['--tr-m-base'] ?? '')?.l ?? 0.5;
  const fieldSpec: SkinElement =
    ctrl.family === 'metal' && controlSpec.vars && (scheme === 'dark' ? ctrlL < 0.5 : ctrlL > 0.62)
      ? { material: 'metal', finish: 'satin', vars: { ...controlSpec.vars } }
      : { material: 'plastic', finish: 'satin' };
  const elements: Record<string, SkinElement> = {
    '*': preset(controlId).family === 'plastic' && !controlSpec.texture ? controlSpec : { material: 'plastic', finish: 'satin' },
  };
  // Panels carry text: their texture is calmer than on a bare sample (about two thirds the relief).
  const calm = (spec: SkinElement): SkinElement => {
    const t = spec.texture;
    const name = typeof t === 'string' ? t : t?.name;
    if (!t || !name || name === 'none') return spec;
    const strength = (typeof t === 'object' && t.strength !== undefined ? t.strength : textureDefaultStrength(name)) * 0.68;
    return { ...spec, texture: { ...(typeof t === 'object' ? t : {}), name, strength: Number(strength.toFixed(2)) } };
  };
  for (const t of surfaceRoles) elements[t] = calm(surfaceSpec);
  // Nav and list items sit on their panel: their hover and selected plates are the same material.
  for (const t of ['tr-nav-item', 'tr-list-item']) elements[t] = surfaceSpec;
  for (const t of controlRoles) elements[t] = controlSpec;
  // Knurling is for grips: only knobs keep it; buttons and tracks get the plain machined metal.
  const tex = controlSpec.texture;
  if (tex && (tex === 'knurl' || (typeof tex === 'object' && tex.name === 'knurl'))) {
    const { texture: _drop, ...plain } = controlSpec;
    for (const t of controlRoles) if (t !== 'tr-knob') elements[t] = plain;
  }
  // Fields stay calm and legible on any material: text needs a plain, high-contrast well.
  for (const t of ['tr-input', 'tr-textarea', 'tr-select']) elements[t] = fieldSpec;
  // Floating layers take the surface material unless it is a heavy texture that would fight text.
  for (const t of ['tr-dialog', 'tr-menu']) elements[t] = textured && preset(surfaceId).family !== 'wood' && preset(surfaceId).family !== 'leather' ? fieldSpec : surfaceSpec;
  if (extra) {
    const spec = extra.tint ? tintPreset(presetSpec(extra.id)!, extra.tint) : presetSpec(extra.id)!;
    for (const t of ['tr-dialog', 'tr-menu']) elements[t] = spec;
    notes.push(`Menus and dialogs: ${preset(extra.id).label.toLowerCase()} (from “${w[extra.at]}”)`);
  }
  if (pill) elements['tr-button'] = { ...controlSpec, style: { '--tr-button-radius': '999px' } };
  // Default and accent buttons must read as different things: when the button material has the
  // accent's colour, move the button's lightness away from the accent fill.
  {
    const b = parseColor(elements['tr-button']?.vars?.['--tr-m-base'] ?? '');
    const a = parseColor(String(tokens['color.accent'] ?? ''));
    if (b && a && b.c > 0.05 && Math.abs(((b.h - a.h + 540) % 360) - 180) < 30 && Math.abs(b.l - a.l) < 0.16) {
      const L = a.l > 0.5 ? Math.max(0.2, a.l - 0.24) : Math.min(0.92, a.l + 0.24);
      const fmt = (x: number, c: number, h: number) => `oklch(${(x * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
      elements['tr-button'] = { ...elements['tr-button']!, vars: { ...elements['tr-button']!.vars, '--tr-m-base': fmt(L, b.c * 0.85, b.h), '--tr-m-ink': L > 0.6 ? fmt(0.2, 0.03, b.h) : fmt(0.97, 0.01, b.h) } };
      notes.push('Buttons: shifted away from the accent so default and accent buttons differ');
    }
  }
  if (controlSpec.material === 'chrome' || controlSpec.profile === 'dome') elements['tr-button'] = { ...elements['tr-button']!, profile: controlSpec.profile ?? 'convex' };

  const ignored = w.filter((x, i) => !used.has(i) && x.length > 3 && !APP_WORDS.has(x) && !['with', 'and', 'that', 'like', 'feel', 'look', 'style', 'theme', 'skin', 'interface', 'app', 'apps', 'into', 'from', 'some', 'very', 'more', 'less', 'over', 'under', 'made', 'using', 'inspired', 'colour', 'color', 'colors', 'colours', 'tone', 'tones'].includes(x) && !ACCENT_CUES.has(x) && !CONTROL_CUES.has(x) && !SURFACE_CUES.has(x));
  if (ignored.length) notes.push(`Not understood: ${[...new Set(ignored)].slice(0, 8).join(', ')}`);

  const name =
    options.name ??
    (slug(
      [...new Set([mats[0]?.id, mats[1]?.id, mood ? Object.entries(MOODS).find(([, v]) => v === mood)?.[0] : undefined].filter(Boolean) as string[])].slice(0, 2).join('-'),
    ) || 'custom');
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const description = `${preset(surfaceId).label} surfaces with ${preset(controlId).label.toLowerCase()} controls, ${scheme} scheme, ${Math.round(realism * 100)}% realism. Generated from: “${trimmed.length > 140 ? trimmed.slice(0, 137) + '…' : trimmed}”`;
  let skin: Skin = { name: /^[a-z]/.test(name) ? name : `skin-${name}`, description, colorScheme: scheme, tokens, elements };
  const fixed = fixContrast(skin);
  if (fixed.changed.length) notes.push(`Contrast: adjusted ${fixed.changed.length} colour${fixed.changed.length > 1 ? 's' : ''} to meet WCAG`);
  skin = fixed.skin;
  compileSkin(skin); // throws if anything is out of vocabulary
  return { skin, notes };
}
