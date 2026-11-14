/**
 * In-browser skin validation: the same checks `trompe check` runs on *.skin.json files (format,
 * vocabulary, WCAG contrast), usable live while editing, plus one-call contrast repair.
 */
import { finishes, materials, profiles, tokens } from '../generated/tokens.js';
import { elementTags } from '../generated/elements.js';
import { contrast, ensureContrast, formatOklch, parseColor, themed, type Oklch } from './color.js';
import { CONTRAST_PAIRS } from './palette.js';
import { isTexture, textureDefaultStrength as defaultStrength, textureSpread, textures, type Texture } from './textures.js';
import type { Skin, SkinElement } from './types.js';

export interface SkinFinding {
  severity: 'error' | 'warning';
  /** Where in the skin, e.g. "tokens.color.ink" or "elements.tr-button.material". */
  path: string;
  message: string;
  /** Contrast findings carry the measured ratio. */
  ratio?: number;
  /** A safe automatic fix: set this token or variable to this value. */
  fix?: { path: string; value: string };
}

interface TokenMeta {
  name: string;
  cssVariable: string;
  type: string;
  value: unknown;
  darkValue?: unknown;
}
const meta = tokens as unknown as readonly TokenMeta[];
const byName = new Map(meta.map((t) => [t.name, t]));
const ELEMENT_KEYS = new Set(['material', 'finish', 'profile', 'texture', 'vars', 'style']);
const TOP_KEYS = new Set(['name', 'description', 'colorScheme', 'tokens', 'elements', '$schema', 'extends']);

/** Resolves a colour token for a skin: the skin's value, else the default for its scheme. */
export function resolveColor(skin: Skin, name: string): Oklch | null {
  const scheme = skin.colorScheme === 'dark' ? 'dark' : 'light';
  const own = skin.tokens?.[name];
  const t = byName.get(name);
  const raw = own ?? (scheme === 'dark' ? (t?.darkValue ?? t?.value) : t?.value);
  return raw === undefined ? null : parseColor(themed(String(raw), scheme));
}

/** Elements whose own surface carries body text (panels, nav, lists, menus, dialogs). */
const TEXT_SURFACES = ['tr-panel', 'tr-nav', 'tr-list', 'tr-toolbar', 'tr-dialog', 'tr-menu'];

const textureOf = (spec: SkinElement | undefined): { name: Texture; strength?: number } | null => {
  const t = spec?.texture;
  if (!t || t === 'none') return null;
  const o = typeof t === 'string' ? { name: t } : t;
  return isTexture(o.name) ? o : null;
};

/**
 * The darkest and lightest colours a textured surface really shows: its base moved by the
 * texture's measured lightness range. Without a texture, just the base.
 */
export function surfaceRange(base: Oklch, texture?: SkinElement['texture']): Oklch[] {
  const t = textureOf({ texture });
  if (!t) return [base];
  const { down, up } = textureSpread(t.name, base.l, t.strength);
  return [
    { ...base, l: Math.max(0, base.l - down) },
    { ...base, l: Math.min(1, base.l + up) },
  ];
}

/** Moves fg until it reaches `min` against every background (as far as that is possible). */
function ensureAll(fg: Oklch, bgs: Oklch[], min: number, canvas?: Oklch): Oklch {
  let out = fg;
  for (let i = 0; i < 4; i++) for (const b of bgs) if (contrast(out, b, canvas) < min) out = ensureContrast(out, b, min + 0.05, canvas);
  return out;
}
const worst = (fg: Oklch, bgs: Oklch[], canvas?: Oklch) => Math.min(...bgs.map((b) => contrast(fg, b, canvas)));

/** Measures every pair in CONTRAST_PAIRS. */
export function contrastReport(skin: Skin): { fg: string; bg: string; min: number; why: string; ratio: number }[] {
  const canvas = resolveColor(skin, 'color.canvas') ?? { l: 1, c: 0, h: 0, a: 1 };
  const out = [];
  for (const [fg, bg, min, why] of CONTRAST_PAIRS) {
    const F = resolveColor(skin, fg);
    const B = resolveColor(skin, bg);
    if (!F || !B) continue;
    out.push({ fg, bg, min, why, ratio: Number(contrast(F, B, canvas).toFixed(2)) });
  }
  return out;
}

/** Checks a skin. An empty array means it builds and every readable pair passes. */
export function validateSkin(skin: Skin): SkinFinding[] {
  const out: SkinFinding[] = [];
  const add = (f: SkinFinding) => out.push(f);
  if (typeof skin.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(skin.name)) add({ severity: 'error', path: 'name', message: 'name must be lowercase kebab-case; it becomes data-tr-skin="<name>".' });
  if (typeof skin.description !== 'string' || skin.description.length < 20) add({ severity: 'warning', path: 'description', message: 'Describe what the skin looks like in a sentence; agents choose skins by it.' });
  if (skin.colorScheme !== 'light' && skin.colorScheme !== 'dark') add({ severity: 'error', path: 'colorScheme', message: 'colorScheme must be "light" or "dark".' });
  for (const k of Object.keys(skin)) if (!TOP_KEYS.has(k)) add({ severity: 'warning', path: k, message: `Unknown top-level key "${k}" is ignored.` });

  for (const [name, value] of Object.entries(skin.tokens ?? {})) {
    const t = byName.get(name);
    if (!t) {
      add({ severity: 'error', path: `tokens.${name}`, message: `"${name}" is not a Trompe token.` });
      continue;
    }
    if (t.type === 'color' && typeof value === 'string' && !/var\(|color-mix|light-dark/.test(value) && !parseColor(value)) {
      add({ severity: 'warning', path: `tokens.${name}`, message: `Could not read "${value}" as a colour; contrast was not checked.` });
    }
  }

  const tags = new Set<string>(elementTags);
  const enums: Record<string, readonly string[]> = { material: materials, finish: finishes, profile: profiles };
  for (const [tag, conf] of Object.entries(skin.elements ?? {}) as [string, SkinElement][]) {
    if (tag !== '*' && !tags.has(tag)) {
      add({ severity: 'error', path: `elements.${tag}`, message: `"${tag}" is not a Trompe element.` });
      continue;
    }
    for (const [k, v] of Object.entries(conf ?? {})) {
      const path = `elements.${tag}.${k}`;
      if (!ELEMENT_KEYS.has(k)) add({ severity: 'error', path, message: `"${k}" is not a skin element key. Use material, finish, profile, texture, vars or style.` });
      else if (enums[k] && !enums[k]!.includes(v as string)) add({ severity: 'error', path, message: `"${String(v)}" is not a ${k}. Use one of: ${enums[k]!.join(', ')}.` });
      else if (k === 'texture') {
        const name = typeof v === 'string' ? v : (v as { name?: string })?.name;
        if (name !== 'none' && !isTexture(name)) add({ severity: 'error', path, message: `"${String(name)}" is not a texture. Use one of: none, ${textures.join(', ')}.` });
      } else if (k === 'vars') {
        for (const name of Object.keys(v as object)) {
          if (!/^--tr-[mfp]-[a-z-]+$/.test(name)) add({ severity: 'error', path: `${path}.${name}`, message: `${name} is not a material, finish or profile parameter (--tr-m-*, --tr-f-*, --tr-p-*).` });
        }
      }
    }
    // Material ink on its base, across the texture's darkest and lightest parts.
    const star = skin.elements?.['*'];
    const vars = { ...(star?.vars ?? {}), ...(conf?.vars ?? {}) };
    const scheme = skin.colorScheme === 'dark' ? 'dark' : 'light';
    const canvas = resolveColor(skin, 'color.canvas') ?? undefined;
    const texture = conf?.texture ?? star?.texture;
    const ownsLook = !!(conf?.vars?.['--tr-m-ink'] || conf?.vars?.['--tr-m-base'] || (tag !== '*' && conf?.texture));
    const ink = ownsLook ? vars['--tr-m-ink'] : undefined;
    const base = vars['--tr-m-base'];
    const B = base ? parseColor(themed(base, scheme)) : null;
    if (ink && B) {
      const F = parseColor(themed(ink, scheme));
      if (F) {
        const range = surfaceRange(B, texture);
        const ratio = worst(F, range, canvas);
        if (ratio < 4.5) {
          const fixed = ensureAll(F, range, 4.6, canvas);
          const reachable = worst(fixed, range, canvas) >= 4.5;
          const t = textureOf({ texture });
          add({
            severity: 'error',
            path: `elements.${tag}.vars.--tr-m-ink`,
            message: `${tag}: text on this ${t ? `${t.name} ` : ''}surface drops to ${ratio.toFixed(2)}:1${t ? ' where the texture is lightest or darkest' : ''}, needs 4.5:1.`,
            ratio: Number(ratio.toFixed(2)),
            fix: reachable || !t
              ? { path: `elements.${tag}.vars.--tr-m-ink`, value: formatOklch(fixed) }
              : { path: `elements.${tag}.texture.strength`, value: String(Number(((t.strength ?? defaultStrength(t.name)) * 0.6).toFixed(2))) },
          });
        }
      }
    }
    // Secondary text (color.ink-muted) sits directly on panels, lists and dialogs too.
    if (tag !== '*' && TEXT_SURFACES.includes(tag) && B && (conf?.vars?.['--tr-m-base'] || conf?.texture)) {
      const own = conf?.style?.['--tr-color-ink-muted'];
      const M = own ? parseColor(themed(own, scheme)) : resolveColor(skin, 'color.ink-muted');
      if (M) {
        const range = surfaceRange(B, texture);
        const ratio = worst(M, range, canvas);
        if (ratio < 4.5) {
          add({
            severity: 'error',
            path: `elements.${tag}.style.--tr-color-ink-muted`,
            message: `${tag}: secondary text (color.ink-muted) on this surface is ${ratio.toFixed(2)}:1, needs 4.5:1.`,
            ratio: Number(ratio.toFixed(2)),
            fix: { path: `elements.${tag}.style.--tr-color-ink-muted`, value: formatOklch(ensureAll(M, range, 4.6, canvas)) },
          });
        }
      }
    }
  }

  const canvas = resolveColor(skin, 'color.canvas') ?? undefined;
  for (const r of contrastReport(skin)) {
    if (r.ratio >= r.min) continue;
    const F = resolveColor(skin, r.fg)!;
    const B = resolveColor(skin, r.bg)!;
    add({
      severity: r.min >= 4.5 || r.fg === 'color.focus' ? 'error' : 'warning',
      path: `tokens.${r.fg}`,
      message: `${r.fg} on ${r.bg} is ${r.ratio.toFixed(2)}:1, needs ${r.min}:1 for ${r.why}.`,
      ratio: r.ratio,
      fix: { path: `tokens.${r.fg}`, value: formatOklch(ensureContrast(F, B, r.min + 0.1, canvas)) },
    });
  }
  return out;
}

/** Sets a dotted path like "tokens.color.ink" or "elements.tr-button.vars.--tr-m-ink" on a skin copy. */
export function setSkinPath(skin: Skin, path: string, value: string): Skin {
  const next = structuredClone(skin);
  if (path.startsWith('tokens.')) {
    next.tokens = { ...(next.tokens ?? {}), [path.slice(7)]: value };
    return next;
  }
  const m = path.match(/^elements\.([^.]+)\.(vars|style)\.(.+)$/);
  if (m) {
    const el = (next.elements ??= {})[m[1]!] ?? {};
    el[m[2] as 'vars' | 'style'] = { ...(el[m[2] as 'vars' | 'style'] ?? {}), [m[3]!]: value };
    next.elements[m[1]!] = el;
  }
  const t = path.match(/^elements\.([^.]+)\.texture\.(strength|scale)$/);
  if (t) {
    const el = (next.elements ??= {})[t[1]!] ?? {};
    const cur = el.texture ?? next.elements['*']?.texture;
    if (cur && cur !== 'none') {
      const o = typeof cur === 'string' ? { name: cur } : { ...cur };
      el.texture = { ...o, [t[2]!]: Number(value) };
      next.elements[t[1]!] = el;
    }
  }
  return next;
}

/**
 * Applies every automatic contrast fix, repeating until stable (fixing ink can change what
 * another pair measures). Returns the repaired copy and what changed.
 */
export function fixContrast(skin: Skin): { skin: Skin; changed: string[] } {
  let next = skin;
  const changed = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const fixes = validateSkin(next).filter((f) => f.fix);
    if (!fixes.length) break;
    for (const f of fixes) {
      next = setSkinPath(next, f.fix!.path, f.fix!.value);
      changed.add(f.fix!.path);
    }
  }
  return { skin: next, changed: [...changed] };
}
