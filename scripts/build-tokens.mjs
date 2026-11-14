#!/usr/bin/env node
// Builds Trompe's design tokens from tokens/trompe.tokens.json (W3C DTCG format).
//
// Outputs (all generated, do not edit by hand):
//   src/generated/tokens.ts   global CSS, per-host bundle CSS, token metadata and TS name unions
//   src/generated/tokens.css  the same global CSS as a plain stylesheet (shipped as trompe/tokens.css)
//   src/generated/tokens.json flat, resolved token list for agents and tools (shipped as trompe/tokens.json)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(resolve(root, 'tokens/trompe.tokens.json'), 'utf8'));
const outDir = resolve(root, 'src/generated');
mkdirSync(outDir, { recursive: true });

const EXT = 'dev.trompe';

/** Walk the DTCG tree and collect tokens with inherited $type. */
function collect(node, path = [], inheritedType) {
  const out = [];
  const type = node.$type ?? inheritedType;
  if ('$value' in node) return [{ path, type, node }];
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    out.push(...collect(child, [...path, key], type));
  }
  return out;
}

const all = collect(source);
const cssName = (t) => t.node.$extensions?.[EXT]?.cssName ?? `--tr-${t.path.join('-')}`;
const dark = (t) => t.node.$extensions?.[EXT]?.dark;
const valueOf = (t) => {
  const d = dark(t);
  return d !== undefined ? `light-dark(${t.node.$value}, ${d})` : String(t.node.$value);
};
const isRef = (t) => typeof t.node.$value === 'string' && t.node.$value.trim().startsWith('var(') && dark(t) === undefined;

/**
 * Bundles: groups whose children are named parameter sets, applied by attribute.
 *   material -> --tr-m-<param>, finish -> --tr-f-<param>, profile -> --tr-p-<param>
 */
const BUNDLES = [
  { group: 'material', prefix: 'm', attr: 'material' },
  { group: 'finish', prefix: 'f', attr: 'finish' },
  { group: 'profile', prefix: 'p', attr: 'profile' },
];
for (const b of BUNDLES) {
  b.tokens = all.filter((t) => t.path[0] === b.group);
  b.names = [...new Set(b.tokens.map((t) => t.path[1]))];
  b.params = [...new Set(b.tokens.map((t) => t.path[2]))];
  // A var() reference is inlined into the selector rule instead of being emitted on :root, because
  // custom properties resolve var() where they are declared. That keeps subtree overrides working.
  b.value = (name, param) => {
    const t = b.tokens.find((x) => x.path[1] === name && x.path[2] === param);
    if (!t) return null;
    return isRef(t) ? t.node.$value : `var(${cssName(t)})`;
  };
  b.block = (name, indent = '  ') =>
    b.params
      .map((p) => [p, b.value(name, p)])
      .filter(([, v]) => v !== null)
      .map(([p, v]) => `${indent}--tr-${b.prefix}-${p}: ${v};`)
      .join('\n');
}
const bundle = (g) => BUNDLES.find((b) => b.group === g);

const rootDecls = all.filter((t) => !(BUNDLES.some((b) => b.group === t.path[0]) && isRef(t))).map((t) => `  ${cssName(t)}: ${valueOf(t)};`);

const realismPresets = all.filter((t) => t.path[0] === 'realism' && t.path[1] !== 'default').map((t) => t.path[1]);
const depthTokens = all.filter((t) => t.path[0] === 'depth' && t.node.$extensions?.[EXT]?.level !== undefined);

const registered = [
  { name: '--tr-light-angle', syntax: '<angle>', initial: source.light.angle.$value },
  { name: '--tr-light-elevation', syntax: '<angle>', initial: source.light.elevation.$value },
  { name: '--tr-realism', syntax: '<number>', initial: String(source.realism.default.$value) },
];

const globalCss = `/* Trompe design tokens. Generated from tokens/trompe.tokens.json. Do not edit. */
${registered.map((r) => `@property ${r.name} { syntax: '${r.syntax}'; inherits: true; initial-value: ${r.initial}; }`).join('\n')}

:where(:root) {
  color-scheme: light dark;
${rootDecls.join('\n')}
  --tr-realism-max: 1;
  /* Dark surfaces barely show shadows, so raised faces also get lighter: 0 in light themes, 1 in dark. */
  --tr-lift: 0;
}
@media (prefers-color-scheme: dark) {
  :where(:root) { --tr-lift: 1; }
}

/* Sensible page defaults (zero specificity, so any page CSS wins). */
:where(html) { color: var(--tr-color-ink); background-color: var(--tr-color-canvas); }

/* Themes: set data-tr-theme on any element. Default follows prefers-color-scheme. */
:where([data-tr-theme='light']) { color-scheme: light; --tr-lift: 0; }
:where([data-tr-theme='dark']) { color-scheme: dark; --tr-lift: 1; }

/* Realism presets on any container: data-tr-realism="${realismPresets.join('|')}". */
${realismPresets.map((p) => `:where([data-tr-realism='${p}']) { --tr-realism: var(--tr-realism-${p}); }`).join('\n')}
${BUNDLES.map(
  (b) => `
/* ${b.group} on any container: data-tr-${b.attr}="${b.names.join('|')}". */
${b.names.map((n) => `:where([data-tr-${b.attr}='${n}']) {\n${b.block(n)}\n}`).join('\n')}`,
).join('\n')}

/* Accessibility: users who ask for more contrast get less realism and stronger edges. */
@media (prefers-contrast: more) {
  :where(:root) { --tr-realism-max: var(--tr-realism-soft); --tr-color-edge: light-dark(oklch(35% 0.01 260), oklch(85% 0.01 260)); }
}
`;

const hostBundleCss = `${BUNDLES.map((b) => b.names.map((n) => `:host([${b.attr}='${n}']) {\n${b.block(n)}\n}`).join('\n')).join('\n')}
${realismPresets.map((p) => `:host([realism='${p}']) { --tr-realism: var(--tr-realism-${p}); }`).join('\n')}
`;

// Fallbacks used when nothing above a component sets a material (plastic).
const mat = bundle('material');
const materialDefaults = Object.fromEntries(mat.params.map((p) => [p, mat.value('plastic', p)]));

const flat = all.map((t) => ({
  name: t.path.join('.'),
  cssVariable: cssName(t),
  type: t.type,
  value: t.node.$value,
  ...(dark(t) !== undefined ? { darkValue: dark(t) } : {}),
  ...(t.node.$description ? { description: t.node.$description } : {}),
}));

const depthLevels = depthTokens.map((t) => ({
  level: t.node.$extensions[EXT].level,
  name: t.path[1],
  cssVariable: cssName(t),
  description: t.node.$description,
}));

const describeBundle = (b) => ({
  description: source[b.group].$description,
  attribute: b.attr,
  containerAttribute: `data-tr-${b.attr}`,
  variablePrefix: `--tr-${b.prefix}-`,
  values: Object.fromEntries(b.names.map((n) => [n, source[b.group][n].$description ?? ''])),
  parameters: Object.fromEntries(
    b.params.map((p) => {
      const first = b.tokens.find((t) => t.path[2] === p);
      return [p, { type: first.type, description: first.node.$description ?? '' }];
    }),
  ),
});

const tokensJson = {
  description:
    'Flat, resolved list of every Trompe design token, plus the bundles (material, finish, profile) that components read. Each cssVariable can be read or overridden with CSS. Values containing light-dark() switch with the color scheme (set data-tr-theme="light|dark" on any element).',
  material: describeBundle(mat),
  finish: describeBundle(bundle('finish')),
  profile: describeBundle(bundle('profile')),
  realismPresets: Object.fromEntries(realismPresets.map((p) => [p, source.realism[p].$value])),
  depthLevels,
  depthUnit: source.depth.unit.$value,
  depthCurve: source.depth.curve.$value,
  light: { angle: source.light.angle.$description, elevation: source.light.elevation.$description },
  tokens: flat,
};

const q = (s) => JSON.stringify(s);
const union = (xs) => xs.map(q).join(' | ');
const namesConst = (b) =>
  `/** Every ${b.group} name: the ${b.attr} attribute or data-tr-${b.attr}. */
export const ${b.group === 'finish' ? 'finishes' : b.group + 's'} = ${JSON.stringify(b.names)} as const;`;

const ts = `// Generated by scripts/build-tokens.mjs from tokens/trompe.tokens.json. Do not edit.

/** Global token stylesheet: custom properties on :root, themes, realism presets, container bundles. */
export const globalCss = ${q(globalCss)};

/** Per-component bundle rules: :host([material]), :host([finish]), :host([profile]), :host([realism]). */
export const hostBundleCss = ${q(hostBundleCss)};

/** Plastic fallbacks used when nothing above a component sets a material. */
export const materialDefaults = ${JSON.stringify(materialDefaults, null, 2)} as const;

${BUNDLES.map(namesConst).join('\n\n')}
export type Material = (typeof materials)[number];
export type Finish = (typeof finishes)[number];
export type Profile = (typeof profiles)[number];

/** Realism presets, ordered from flat to real. */
export const realismPresets = ${JSON.stringify(Object.fromEntries(realismPresets.map((p) => [p, source.realism[p].$value])))} as const;
export type Realism = keyof typeof realismPresets;

/** Depth levels: negative values are recessed, positive values are raised. */
export const depthLevels = ${JSON.stringify(depthLevels.map((d) => d.level))} as const;
export type Depth = (typeof depthLevels)[number];

/** Every token name in dot notation, e.g. "color.surface". */
export type TokenName = ${union(flat.map((t) => t.name))};

/** Every CSS custom property Trompe defines, e.g. "--tr-color-surface". */
export type CssVariable = ${union(flat.map((t) => t.cssVariable))};

/** Token metadata for tooling. */
export const tokens = ${JSON.stringify(flat, null, 2)} as const;
`;

writeFileSync(resolve(outDir, 'tokens.ts'), ts);
writeFileSync(resolve(outDir, 'tokens.css'), globalCss);
writeFileSync(resolve(outDir, 'tokens.json'), JSON.stringify(tokensJson, null, 2) + '\n');
console.log(
  `tokens: ${flat.length} tokens; ${BUNDLES.map((b) => `${b.names.length} ${b.group}s`).join(', ')} -> src/generated/`,
);

// Skins are built from the same source so bundle names stay in sync.
const { buildSkins } = await import('./build-skins.mjs');
const skinNames = buildSkins(root, source);
console.log(`skins: ${skinNames.join(', ')} -> src/generated/skins*`);
