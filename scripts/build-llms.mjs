#!/usr/bin/env node
// Generates agent-facing docs from the machine-readable sources:
//   custom-elements.json  (elements: attributes, events, slots, parts, css props, examples, roles)
//   src/generated/tokens.json (material / finish / profile / realism / depth model, every token)
//   src/generated/skins.json  (complete visual styles), when present
//
// Outputs at the package root:
//   llms.txt       concise index: everything an agent needs to write correct markup
//   llms-full.txt  everything: full descriptions, properties, methods, every token, skin details

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const pkg = readJson('package.json');
const manifest = readJson('custom-elements.json');
const tokens = readJson('src/generated/tokens.json');
const skins = existsSync(resolve(root, 'src/generated/skins.json')) ? readJson('src/generated/skins.json') : null;

/** Attributes every Trompe element inherits from TrompeElement. Documented once in the model section. */
const SHARED = ['material', 'finish', 'profile', 'realism', 'depth'];

const elements = manifest.modules
  .flatMap((m) => (m.declarations ?? []).map((d) => ({ ...d, modulePath: m.path })))
  .filter((d) => d.customElement && d.tagName)
  .sort((a, b) => a.tagName.localeCompare(b.tagName));

const cleanType = (t) => (t?.text ?? '').replace(/\s*\|\s*undefined\b/g, '').trim();
const oneLine = (s) => (s ?? '').replace(/\s*\n\s*/g, ' ').trim();
const isPublic = (m) => !m.privacy || m.privacy === 'public';
const formAssociated = (el) => (el.members ?? []).some((m) => m.static && m.name === 'formAssociated');
const isStub = (el) => !el.summary && !el.description;
/** ARIA widget roles: elements with these take focus and respond to input. */
const WIDGET_ROLES = new Set(['button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem']);
/** Interactive = a widget role, or a form-associated control (text fields delegate focus inward). */
const isInteractive = (el) => (el.role ? WIDGET_ROLES.has(el.role) : formAssociated(el));

/**
 * The package specifier that loads (and defines) an element, e.g. `trompe/components/radio-group`.
 * Checked against package.json "exports" so the docs never print a path that does not resolve.
 */
function importPath(el) {
  const rel = el.modulePath.replace(/^(src|dist)\//, '').replace(/\.(ts|js)$/, '');
  const name = rel.split('/').at(-1);
  const key = `./components/${name}`;
  const entry = pkg.exports[key] ?? pkg.exports['./components/*'];
  const target = (typeof entry === 'string' ? entry : entry?.default)?.replaceAll('*', name);
  if (target !== `./dist/${rel}.js`) {
    throw new Error(`build-llms: trompe/components/${name} resolves to ${target}, not ./dist/${rel}.js (<${el.tagName}>). Add an explicit "${key}" entry to package.json "exports".`);
  }
  return `trompe/components/${name}`;
}

function attrLine(a) {
  const type = cleanType(a.type);
  const def = a.default !== undefined ? ` = ${a.default}` : '';
  const desc = oneLine(a.description);
  return `- \`${a.name}\`${type ? `: ${type}` : ''}${def}${desc ? ` — ${desc}` : ''}`;
}

const listLine = (label, items, fmt) => (items?.length ? [`${label}:`, ...items.map(fmt)] : []);

function elementSection(el, full) {
  const tags = [];
  if (el.role) tags.push(`role="${el.role}" (${isInteractive(el) ? 'interactive' : 'non-interactive'})`);
  else if (isInteractive(el)) tags.push('interactive, no host role (focus is delegated to an inner native control)');
  else tags.push('non-interactive, no role');
  if (formAssociated(el)) tags.push('form-associated');
  if (isStub(el)) tags.push('placeholder: not documented yet');
  const out = [`### <${el.tagName}>${el.summary ? ` — ${oneLine(el.summary)}` : ''}`, '', `${tags.join(', ')}. Import: \`${importPath(el)}\` (class ${el.name}).`];
  if (el.description) out.push('', full ? el.description : oneLine(el.description));

  const attrs = (el.attributes ?? []).filter((a) => full || !SHARED.includes(a.name));
  const shared = (el.attributes ?? []).filter((a) => SHARED.includes(a.name)).map((a) => a.name);
  out.push('');
  const sharedText = `the shared surface attributes ${shared.map((s) => `\`${s}\``).join(', ')} (see "Surface model")`;
  if (attrs.length) {
    out.push(...listLine('Attributes', attrs, attrLine));
    if (!full && shared.length) out.push(`- plus ${sharedText}`);
  } else {
    out.push(shared.length ? `Attributes: only ${sharedText}.` : 'Attributes: none.');
  }

  if (full) {
    const attrFields = new Set((el.attributes ?? []).map((a) => a.fieldName));
    const props = (el.members ?? []).filter((m) => m.kind === 'field' && isPublic(m) && !m.static && !attrFields.has(m.name));
    out.push(...listLine('Properties (JS only)', props, (m) => `- \`${m.name}\`${cleanType(m.type) ? `: ${cleanType(m.type)}` : ''}${m.readonly ? ' (readonly)' : ''}${m.description ? ` — ${oneLine(m.description)}` : ''}`));
    const methods = (el.members ?? []).filter((m) => m.kind === 'method' && isPublic(m) && !m.static && !/Callback$/.test(m.name));
    out.push(
      ...listLine('Methods', methods, (m) => {
        const params = (m.parameters ?? []).map((p) => `${p.name}${p.optional || p.default !== undefined ? '?' : ''}${p.type ? `: ${cleanType(p.type)}` : ''}`).join(', ');
        return `- \`${m.name}(${params})\`${m.return?.type?.text ? `: ${m.return.type.text}` : ''}${m.description ? ` — ${oneLine(m.description)}` : ''}`;
      }),
    );
  }
  out.push(...listLine('Events', el.events, (e) => `- \`${e.name}\`${e.description ? ` — ${oneLine(e.description)}` : ''}`));
  out.push(...listLine('Slots', el.slots, (s) => `- ${s.name ? `\`${s.name}\`` : '(default)'}${s.description ? ` — ${oneLine(s.description)}` : ''}`));
  out.push(...listLine('CSS parts', el.cssParts, (p) => `- \`${p.name}\`${p.description ? ` — ${oneLine(p.description)}` : ''}`));
  out.push(...listLine('CSS custom properties', el.cssProperties, (p) => `- \`${p.name}\`${p.description ? ` — ${oneLine(p.description)}` : ''}`));
  if (el.examples?.length) out.push('Examples:', '```html', ...el.examples, '```');
  return out.join('\n');
}

const bundleSection = (key, full) => {
  const b = tokens[key];
  const lines = [
    `**${key}** — attribute \`${b.attribute}\` on an element, \`${b.containerAttribute}\` on any container. ${full ? b.description : ''}`.trim(),
    ...Object.entries(b.values).map(([n, d]) => `- \`${n}\`${d ? ` — ${d}` : ''}`),
  ];
  if (full) {
    lines.push(`Parameters (CSS variables ${b.variablePrefix}<param>, set them directly for a custom ${key}):`);
    lines.push(...Object.entries(b.parameters).map(([p, v]) => `- \`${b.variablePrefix}${p}\` (${v.type})${v.description ? ` — ${v.description}` : ''}`));
  } else {
    lines.push(`Custom ${key}: set \`${Object.keys(b.parameters).map((p) => b.variablePrefix + p).join('`, `')}\`.`);
  }
  return lines.join('\n');
};

function modelSection(full) {
  const realism = Object.entries(tokens.realismPresets).map(([n, v]) => `\`${n}\` (${v})`).join(', ');
  const depth = tokens.depthLevels.map((d) => `- \`${d.level}\` ${d.name} — ${d.description}`).join('\n');
  return `## Surface model

Every element is geometry; how it looks comes from five orthogonal axes. Each can be set on the element
(attribute) or on any ancestor (data-tr-* attribute), and inherits down the tree. Explicit element
attributes win over containers.

${bundleSection('material', full)}

${bundleSection('finish', full)}

${bundleSection('profile', full)}

**realism** — attribute \`realism\` or container \`data-tr-realism\`: ${realism}. Scales every shadow, highlight
and texture from flat (0) to photographic (1); it is also the CSS variable \`--tr-realism\` (any number 0..1).
\`prefers-contrast: more\` caps it automatically.

**depth** — attribute \`depth\` (number): resting height of a surface. Shadow length is
\`--tr-depth-unit\` (${tokens.depthUnit}) × level^\`--tr-depth-curve\` (${tokens.depthCurve}).
${depth}

**light** — one global light; every shadow and highlight agrees with it.
- \`--tr-light-angle\` — ${tokens.light.angle}
- \`--tr-light-elevation\` — ${tokens.light.elevation}`;
}

const theming = `## Theming recipe

1. Load the components: \`import 'trompe'\` (all) or \`import 'trompe/components/<name>'\`; or the single-file
   bundle \`<script type="module" src="https://cdn.jsdelivr.net/npm/${pkg.name}/dist/trompe.bundle.js"></script>\`.
   Elements install the token stylesheet themselves; \`trompe/tokens.css\` is the same CSS for SSR/static pages.
2. Color scheme: follows \`prefers-color-scheme\`. Force it with \`data-tr-theme="light|dark"\` on any element.
3. Style a whole region at once with container attributes, e.g.
   \`<section data-tr-material="metal" data-tr-finish="brushed" data-tr-realism="real">\`.
4. Override tokens with plain CSS on any selector (all Trompe rules use :where(), so yours win):
   \`.studio { --tr-color-accent: oklch(70% 0.18 145); --tr-light-angle: 300deg; --tr-radius-md: 4px; }\`
5. Invent a material by setting its parameters: \`.walnut { --tr-m-base: oklch(45% 0.06 55); --tr-m-specular: 0.3; --tr-m-roughness: 0.6; --tr-m-grain: 0.25; }\`
6. Deep styling: \`::part(<name>)\` and the per-element CSS custom properties listed below.
${skins ? '7. Or apply a complete skin (see "Skins").' : ''}
Accessibility is built in: roles, keyboard support (APG patterns), focus rings, forced-colors and
prefers-reduced-motion/transparency/contrast handling. Give icon-only controls an \`aria-label\`.
Interactive elements fire native, bubbling \`input\`/\`change\`/\`click\` events, so every framework's
normal event syntax works (React \`onInput\`, Vue \`@change\`, Svelte \`onchange\`).`;

function skinsSection(full) {
  if (!skins?.skins?.length) return '';
  const lines = [
    '## Skins',
    '',
    skins.description,
    'Load all skins with `import \'trompe/skins.css\'` (or `<link rel="stylesheet" href=".../dist/skins.css">`), or one with `trompe/skins/<name>.css`, then put `data-tr-skin="<name>"` on any container (e.g. <body>).',
    '',
  ];
  for (const s of skins.skins) {
    lines.push(`- \`${s.name}\`${s.colorScheme ? ` (${s.colorScheme})` : ''} — ${s.description}`);
    if (full) {
      if (s.tokens) lines.push(`  - tokens: ${Object.entries(s.tokens).map(([k, v]) => `${k}=${v}`).join('; ')}`);
      for (const [sel, e] of Object.entries(s.elements ?? {})) {
        const parts = Object.entries(e)
          .map(([k, v]) => (typeof v === 'object' ? `${k} {${Object.entries(v).map(([a, b]) => `${a}: ${b}`).join('; ')}}` : `${k}=${v}`))
          .join(', ');
        lines.push(`  - ${sel === '*' ? 'all elements' : sel}: ${parts}`);
      }
    }
  }
  lines.push(
    '',
    '### Making a new skin',
    '',
    'Generate a complete, contrast-checked skin from plain language, then edit the JSON if needed:',
    '`npx trompe skin "walnut panels with brushed brass knobs, amber accent, low evening light" --name library --out skins/library.skin.json --css library.css`',
    '(add `--format json` to get `{skin, notes, findings}`; `npx trompe skin vocab` lists every word it understands).',
    'In code: `import { skinFromDescription, validateSkin, fixContrast, compileSkin, applySkin } from \'trompe/skin\'`.',
    'Skin JSON: `{ name, description, colorScheme, tokens: { "color.accent": …, "light.angle": …, "realism.default": … }, elements: { "<tag>|*": { material, finish, profile, texture, vars: { "--tr-m-base": … }, style } } }`.',
    'Textures: wood, leather, linen, felt, stone, marble, paper, terrazzo, carbon, knurl (or `{ name, scale, strength }`); their relief follows the skin light.',
    'Validate with `npx trompe skin check <file> --fix` or `npx trompe check <file>`.',
  );
  return lines.join('\n');
}

function tokensSection() {
  const groups = new Map();
  for (const t of tokens.tokens) {
    const g = t.name.split('.')[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const out = ['## All tokens', '', tokens.description, ''];
  for (const [g, list] of groups) {
    out.push(`### ${g}`);
    for (const t of list) {
      const dark = t.darkValue !== undefined ? ` / dark: ${t.darkValue}` : '';
      out.push(`- \`${t.cssVariable}\` (${t.type}) = ${t.value}${dark}${t.description ? ` — ${t.description}` : ''}`);
    }
    out.push('');
  }
  return out.join('\n');
}

const interactive = elements.filter(isInteractive).map((e) => `${e.tagName}${e.role ? ` (${e.role})` : ''}`);
const namedRoles = elements.filter((e) => e.role && !isInteractive(e)).map((e) => `${e.tagName} (${e.role})`);

function header(full) {
  return `# Trompe

> ${pkg.description} ${elements.length} custom elements (tag prefix \`tr-\`), version ${pkg.version}.
> Works in plain HTML and every framework (React 19, Vue 3, Svelte 5, Angular, Lit).

Install: \`npm i ${pkg.name}\`. Machine-readable sources (shipped in the package):
- \`custom-elements.json\` — Custom Elements Manifest. Type texts are expanded to literal unions (the alias is in \`type.alias\`); \`role\` marks interactive elements; \`examples\` holds markup.
- \`dist/tokens.json\` (\`trompe/tokens.json\`) — every token and the material/finish/profile/realism/depth model.${skins ? '\n- `dist/skins.json` (`trompe/skins.json`) — skins and what they set.' : ''}
- Framework typings: \`trompe/frameworks/react\`, \`trompe/frameworks/vue\`, \`trompe/frameworks/svelte\` (import once for typed tr-* props).
${full ? '' : '- `llms-full.txt` — this index plus full descriptions, JS properties, methods, every token and skin detail.\n'}
Rules for correct markup:
- Use only the attributes and values listed here; enumerated values are exact strings.
- Boolean attributes are present/absent (\`disabled\`, \`toggle\`, \`checked\`); numbers are written as strings in HTML.
- Interactive elements (they take focus and need an accessible name): ${interactive.join(', ') || 'none'}.${namedRoles.length ? `\n- Non-interactive elements with a role (give them an accessible name too, e.g. aria-label): ${namedRoles.join(', ')}.` : ''}
- Read values in event handlers from \`event.target.value\` / \`.checked\` / \`.pressed\`.
- Check your output: \`npx trompe check <files>\` (add \`--format json\` to read findings, \`--fix\` for typos, \`--render\` for contrast, axe, target size and forced colours). It validates markup (.html, .vue, .svelte, Lit html\`\`), CSS and skin files against this package, and exits 1 on errors.`;
}

function build(full) {
  return [
    header(full),
    modelSection(full),
    theming,
    skinsSection(full),
    `## Elements\n\n${elements.map((e) => elementSection(e, full)).join('\n\n')}`,
    full ? tokensSection() : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';
}

const concise = build(false);
const fullText = build(true);
writeFileSync(resolve(root, 'llms.txt'), concise);
writeFileSync(resolve(root, 'llms-full.txt'), fullText);
console.log(`llms: llms.txt ${(concise.length / 1024).toFixed(1)} KiB, llms-full.txt ${(fullText.length / 1024).toFixed(1)} KiB, ${elements.length} elements`);
