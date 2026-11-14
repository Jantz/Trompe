// Builds Trompe skins from skins/*.skin.json. Called by scripts/build-tokens.mjs.
//
// A skin is a complete visual style an agent can apply with one attribute: data-tr-skin="<name>"
// on any container (usually <html> or <body>). It overrides tokens (colors, light, realism, radii)
// and gives each element type default material / finish / profile bundles. Anything set
// explicitly on an element (material="chrome", style="--tr-m-base: ...") still wins.
//
// Skin JSON shape:
// {
//   "name": "studio",
//   "description": "...",
//   "colorScheme": "dark" | "light",
//   "tokens": { "color.canvas": "oklch(...)", "realism.default": 1, "light.angle": "0deg", ... },
//   "elements": {
//     "*":        { "material": "plastic", "finish": "satin", "profile": "convex", "vars": { "--tr-m-base": "..." } },
//     "tr-panel": { "material": "metal", "finish": "brushed", "profile": "bevel", "vars": { ... } }
//   }
// }

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function buildSkins(root, source) {
  const dir = resolve(root, 'skins');
  const outDir = resolve(root, 'src/generated');
  mkdirSync(resolve(outDir, 'skins'), { recursive: true });

  const bundleGroups = { material: 'm', finish: 'f', profile: 'p' };
  const tokenVar = (path) =>
    path === 'realism.default' || path === 'realism' ? '--tr-realism' : `--tr-${path.split('.').join('-')}`;

  const bundleDecls = (group, name) => {
    const set = source[group]?.[name];
    if (!set) throw new Error(`unknown ${group} "${name}"`);
    return Object.entries(set)
      .filter(([k]) => !k.startsWith('$'))
      .map(([param, t]) => {
        const v = String(t.$value);
        const dark = t.$extensions?.['dev.trompe']?.dark;
        const value = v.startsWith('var(') && dark === undefined ? v : `var(--tr-${group}-${name}-${param})`;
        return `--tr-${bundleGroups[group]}-${param}: ${value};`;
      });
  };

  // Every element tag Trompe defines, found by scanning define('tr-…') calls.
  const compDir = resolve(root, 'src/components');
  const tags = [];
  for (const d of readdirSync(compDir)) {
    for (const f of readdirSync(resolve(compDir, d)).filter((x) => x.endsWith('.ts'))) {
      for (const m of readFileSync(resolve(compDir, d, f), 'utf8').matchAll(/define\('(tr-[a-z-]+)'/g)) tags.push(m[1]);
    }
  }
  const allTags = [...new Set(tags)].sort().join(', ');

  const files = readdirSync(dir).filter((f) => f.endsWith('.skin.json')).sort();
  const skins = files.map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
  const all = [];
  const meta = [];

  for (const skin of skins) {
    const scope = `:where([data-tr-skin='${skin.name}'])`;
    const out = [`/* Trompe skin "${skin.name}": ${skin.description} */`];
    const rootDecls = [];
    if (skin.colorScheme) {
      rootDecls.push(`color-scheme: ${skin.colorScheme};`, `--tr-lift: ${skin.colorScheme === 'dark' ? 1 : 0};`);
    }
    for (const [path, value] of Object.entries(skin.tokens ?? {})) rootDecls.push(`${tokenVar(path)}: ${value};`);
    rootDecls.push('color: var(--tr-color-ink);');
    out.push(`${scope} {\n  ${rootDecls.join('\n  ')}\n}`);

    for (const [el, spec] of Object.entries(skin.elements ?? {})) {
      const target = el === '*' ? `:is(${allTags})` : el;
      for (const group of Object.keys(bundleGroups)) {
        const extra = group === 'material' ? Object.entries(spec.vars ?? {}).map(([k, v]) => `${k}: ${v};`) : [];
        if (!spec[group] && !extra.length) continue;
        const decls = [...(spec[group] ? bundleDecls(group, spec[group]) : []), ...extra];
        out.push(`${scope} :where(${target}:not([${group}])) {\n  ${decls.join('\n  ')}\n}`);
      }
      if (spec.style) out.push(`${scope} :where(${target}) {\n  ${Object.entries(spec.style).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n}`);
    }
    const css = out.join('\n') + '\n';
    writeFileSync(resolve(outDir, 'skins', `${skin.name}.css`), `/* Generated from skins/${skin.name}.skin.json. Do not edit. */\n${css}`);
    all.push(css);
    meta.push({ name: skin.name, description: skin.description, colorScheme: skin.colorScheme ?? null, tokens: skin.tokens ?? {}, elements: skin.elements ?? {} });
  }

  writeFileSync(resolve(outDir, 'skins.css'), `/* Trompe skins. Generated from skins/*.skin.json. Do not edit. */\n${all.join('\n')}`);
  writeFileSync(
    resolve(outDir, 'skins.json'),
    JSON.stringify(
      {
        description:
          'Complete visual styles. Apply with data-tr-skin="<name>" on any container after loading trompe/skins.css (or trompe/skins/<name>.css). Explicit attributes on elements still win.',
        skins: meta,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    resolve(outDir, 'skins.ts'),
    `// Generated from skins/*.skin.json. Do not edit.\nexport const skinCss = ${JSON.stringify(all.join('\n'))};\nexport const skins = ${JSON.stringify(skins.map((s) => s.name))} as const;\nexport type Skin = (typeof skins)[number];\n`,
  );
  return skins.map((s) => s.name);
}
