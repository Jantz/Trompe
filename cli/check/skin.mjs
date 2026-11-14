// Validates a skin file (skins/<name>.skin.json) against the format the build script accepts,
// the token/bundle vocabulary in tokens.json, and WCAG contrast of its colour pairs.
import { finding } from './rules.mjs';
import { suggest } from './data.mjs';
import { parseColor, themed, contrast } from './color.mjs';

const ELEMENT_KEYS = new Set(['material', 'finish', 'profile', 'vars', 'style']);

/** Colour pairs a skin must keep readable: [foreground token, background token, minimum, why]. */
const PAIRS = [ // [fg, bg, min, why, severity]
  ['color.ink', 'color.surface', 4.5, 'body text on surfaces'],
  ['color.ink', 'color.canvas', 4.5, 'body text on the page'],
  ['color.ink-muted', 'color.surface', 4.5, 'secondary text on surfaces'],
  ['color.accent-ink', 'color.accent', 4.5, 'text on accent fills'],
  ['color.danger-ink', 'color.danger', 4.5, 'text on danger fills'],
  ['color.edge', 'color.canvas', 3, 'control boundaries (WCAG 1.4.11; fills or rims can also carry the boundary)', 'warning'],
  ['color.focus', 'color.canvas', 3, 'focus ring'],
];

export function checkSkin(file, src, data) {
  const out = [];
  const push = (id, props) => out.push(finding(id, { file, line: props.line ?? 1, column: 1, ...props }));
  const lineOf = (needle) => {
    const i = src.indexOf(needle);
    return i < 0 ? 1 : src.slice(0, i).split('\n').length;
  };

  let skin;
  try {
    skin = JSON.parse(src);
  } catch (e) {
    push('TR201', { message: `Not valid JSON: ${e.message}` });
    return out;
  }

  if (typeof skin.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(skin.name)) push('TR201', { line: lineOf('"name"'), message: '"name" must be a lowercase kebab-case string; it becomes data-tr-skin="<name>".' });
  if (typeof skin.description !== 'string' || skin.description.length < 20) push('TR201', { severity: 'warning', line: lineOf('"description"'), message: '"description" should say what the skin looks like in a sentence; agents choose skins by it.' });
  if (!['light', 'dark'].includes(skin.colorScheme)) push('TR201', { line: lineOf('"colorScheme"'), message: '"colorScheme" must be "light" or "dark".', expected: ['light', 'dark'] });
  if (skin.tokens !== undefined && (typeof skin.tokens !== 'object' || Array.isArray(skin.tokens))) push('TR201', { message: '"tokens" must be an object of token name → value.' });
  if (skin.elements !== undefined && (typeof skin.elements !== 'object' || Array.isArray(skin.elements))) push('TR201', { message: '"elements" must be an object keyed by tag name or "*".' });
  for (const k of Object.keys(skin)) {
    if (!['name', 'description', 'colorScheme', 'tokens', 'elements', '$schema', 'extends'].includes(k)) push('TR201', { severity: 'warning', line: lineOf(`"${k}"`), message: `Unknown top-level key "${k}" is ignored by the build.` });
  }

  const tokens = skin.tokens ?? {};
  for (const [name, value] of Object.entries(tokens)) {
    if (!data.tokenByName.has(name)) {
      const s = suggest(name, data.tokenByName.keys());
      push('TR202', { line: lineOf(`"${name}"`), message: `"${name}" is not a Trompe token.${s ? ` Did you mean "${s}"?` : ''}`, expected: s ? [s] : undefined });
      continue;
    }
    const t = data.tokenByName.get(name);
    if (t.type === 'color' && typeof value === 'string' && !/var\(|color-mix|light-dark/.test(value) && !parseColor(value)) {
      push('TR202', { severity: 'warning', line: lineOf(`"${name}"`), message: `"${name}": could not read "${value}" as a colour; contrast was not checked.` });
    }
  }

  const enums = { material: data.enums.material, finish: data.enums.finish, profile: data.enums.profile };
  for (const [tag, conf] of Object.entries(skin.elements ?? {})) {
    if (tag !== '*' && !data.elements.has(tag)) {
      const s = suggest(tag, data.elements.keys());
      push('TR202', { line: lineOf(`"${tag}"`), message: `"${tag}" is not a Trompe element.${s ? ` Did you mean "${s}"?` : ''}` });
      continue;
    }
    for (const [k, v] of Object.entries(conf ?? {})) {
      if (!ELEMENT_KEYS.has(k)) { push('TR201', { line: lineOf(`"${k}"`), message: `"${tag}.${k}" is not a skin element key. Use material, finish, profile, vars or style.` }); continue; }
      if (enums[k] && !enums[k].includes(v)) {
        push('TR202', { line: lineOf(`"${v}"`), message: `"${tag}.${k}": "${v}" is not a ${k}.`, expected: enums[k] });
      }
      if (k === 'vars') for (const name of Object.keys(v)) {
        if (!data.bundleVars.has(name) && !data.tokenVars.has(name)) push('TR202', { line: lineOf(`"${name}"`), message: `"${tag}.vars": ${name} is not a material/finish/profile parameter. vars takes --tr-m-*, --tr-f-*, --tr-p-*.`, expected: suggest(name, data.bundleVars) ? [suggest(name, data.bundleVars)] : undefined });
      }
      if (k === 'style') for (const name of Object.keys(v)) {
        const def = data.elements.get(tag);
        const ok = data.tokenVars.has(name) || (def ? def.cssProperties.has(name) : data.componentVars.has(name));
        if (!ok) push('TR202', { severity: 'warning', line: lineOf(`"${name}"`), message: `"${tag}.style": ${name} is not read by ${tag === '*' ? 'any element' : `<${tag}>`}.` });
      }
    }
  }

  // Contrast: skin values over defaults for the skin's colour scheme.
  const scheme = skin.colorScheme === 'dark' ? 'dark' : 'light';
  const resolve = (name) => {
    const v = tokens[name] ?? (scheme === 'dark' ? data.tokenByName.get(name)?.darkValue ?? data.tokenByName.get(name)?.value : data.tokenByName.get(name)?.value);
    return parseColor(themed(v)[scheme]);
  };
  const canvas = resolve('color.canvas') ?? [1, 1, 1, 1];
  for (const [fg, bg, min, why, severity] of PAIRS) {
    if (!(fg in tokens) && !(bg in tokens)) continue; // only judge what the skin changed
    const F = resolve(fg), B = resolve(bg);
    if (!F || !B) continue;
    const ratio = contrast(F, B, canvas);
    if (ratio < min) push('TR203', { severity, line: lineOf(`"${fg in tokens ? fg : bg}"`), message: `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1 for ${why}.`, value: Number(ratio.toFixed(2)) });
  }
  // Per-element material ink on base.
  const star = skin.elements?.['*']?.vars ?? {};
  for (const [tag, conf] of Object.entries(skin.elements ?? {})) {
    const vars = { ...star, ...(conf?.vars ?? {}) };
    if (!conf?.vars?.['--tr-m-ink'] && !conf?.vars?.['--tr-m-base']) continue;
    const ink = vars['--tr-m-ink'] ?? null, base = vars['--tr-m-base'] ?? null;
    if (!ink || !base) continue;
    const F = parseColor(themed(ink)[scheme]), B = parseColor(themed(base)[scheme]);
    if (!F || !B) continue;
    const ratio = contrast(F, B, canvas);
    if (ratio < 4.5) push('TR203', { line: lineOf('--tr-m-ink'), message: `${tag}: --tr-m-ink on --tr-m-base is ${ratio.toFixed(2)}:1, needs 4.5:1.`, value: Number(ratio.toFixed(2)) });
  }
  return out;
}
