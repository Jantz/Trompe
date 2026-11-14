// Loads everything the checker knows from the package's own generated files, so rules stay
// in sync with the components: custom-elements.json, dist/tokens.json, dist/skins.json.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Parses a CEM type text such as "'a' | 'b' | undefined" or "-2 | -1 | 0" or "boolean". */
export function parseType(text = '') {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return { kind: 'any' };
  const parts = t.split('|').map((s) => s.trim()).filter((s) => s && s !== 'undefined' && s !== 'null');
  if (parts.length === 1 && parts[0] === 'boolean') return { kind: 'boolean' };
  if (parts.length === 1 && parts[0] === 'number') return { kind: 'number' };
  if (parts.length === 1 && parts[0] === 'string') return { kind: 'string' };
  const lits = parts.map((p) => {
    const m = p.match(/^'(.*)'$|^"(.*)"$/);
    if (m) return m[1] ?? m[2];
    if (/^-?\d+(\.\d+)?$/.test(p)) return p;
    return null;
  });
  if (lits.length && lits.every((x) => x !== null)) return { kind: 'enum', values: lits };
  return { kind: 'any' };
}

function readJson(path, what) {
  if (!existsSync(path)) {
    throw new Error(`${what} not found at ${path}. Run "npm run build" in the trompe package, or pass its path explicitly.`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadData(opts = {}) {
  const manifest = readJson(opts.manifest ?? resolve(PKG_ROOT, 'custom-elements.json'), 'custom-elements.json');
  const tokens = readJson(opts.tokens ?? resolve(PKG_ROOT, 'dist/tokens.json'), 'tokens.json');
  const skins = readJson(opts.skins ?? resolve(PKG_ROOT, 'dist/skins.json'), 'skins.json');

  /** @type {Map<string, any>} */
  const elements = new Map();
  for (const mod of manifest.modules ?? []) {
    for (const d of mod.declarations ?? []) {
      if (!d.customElement || !d.tagName) continue;
      const attrs = new Map();
      for (const a of d.attributes ?? []) attrs.set(a.name, { ...a, parsed: parseType(a.type?.text) });
      elements.set(d.tagName, {
        tag: d.tagName,
        role: d.role ?? null,
        summary: d.summary ?? '',
        attrs,
        /** Writable JS properties, lowercased: JSX writes them as camelCase props (valueText). */
        props: new Set((d.members ?? []).filter((m) => m.kind === 'field' && !m.static && (!m.privacy || m.privacy === 'public')).map((m) => m.name.toLowerCase())),
        cssProperties: new Set((d.cssProperties ?? []).map((p) => p.name)),
        parts: new Set((d.cssParts ?? []).map((p) => p.name)),
        slots: (d.slots ?? []).map((s) => s.name),
      });
    }
  }

  const tokenVars = new Set(tokens.tokens.map((t) => t.cssVariable));
  const tokenByName = new Map(tokens.tokens.map((t) => [t.name, t]));
  const prefixes = { material: '--tr-m-', finish: '--tr-f-', profile: '--tr-p-' };
  const bundleVars = new Set();
  for (const [group, prefix] of Object.entries(prefixes)) {
    for (const p of Object.keys(tokens[group]?.parameters ?? {})) bundleVars.add(prefix + p);
  }
  // Surface textures are material parameters set by skins ("texture": "wood") or by hand.
  for (const v of ['--tr-m-texture', '--tr-m-texture-size', '--tr-m-texture-blend']) bundleVars.add(v);
  for (const lvl of tokens.depthLevels ?? []) tokenVars.add(lvl.cssVariable);
  const componentVars = new Set();
  for (const el of elements.values()) for (const p of el.cssProperties) componentVars.add(p);

  const enums = {
    material: Object.keys(tokens.material?.values ?? {}),
    finish: Object.keys(tokens.finish?.values ?? {}),
    profile: Object.keys(tokens.profile?.values ?? {}),
    realism: Object.keys(tokens.realismPresets ?? {}),
    skin: (skins.skins ?? []).map((s) => s.name),
    theme: ['light', 'dark'],
  };

  return { manifest, tokens, skins, elements, tokenVars, tokenByName, bundleVars, componentVars, enums, pkgRoot: PKG_ROOT };
}

/** Levenshtein distance, for "did you mean" suggestions. */
export function distance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Closest candidate within a sensible distance, or undefined. */
export function suggest(value, candidates) {
  let best, bestD = Infinity;
  for (const c of candidates) {
    const dd = distance(value.toLowerCase(), String(c).toLowerCase());
    if (dd < bestD) { best = c; bestD = dd; }
  }
  return bestD <= Math.max(2, Math.floor(String(value).length / 3)) ? best : undefined;
}
