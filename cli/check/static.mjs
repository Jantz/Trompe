// Static rules: parse the markup, compare it with custom-elements.json, tokens.json and skins.json.
import { elements, attr, inherited, textOf, lineCol, EXPR, MARK, TEXT } from './markup.mjs';
import { finding } from './rules.mjs';
import { suggest } from './data.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const GLOBAL_ATTRS = new Set([
  'id', 'class', 'style', 'slot', 'part', 'exportparts', 'title', 'lang', 'dir', 'hidden', 'tabindex', 'role',
  'inert', 'autofocus', 'nonce', 'popover', 'popovertarget', 'popovertargetaction', 'draggable', 'contenteditable',
  'spellcheck', 'translate', 'accesskey', 'enterkeyhint', 'inputmode', 'is', 'form', 'itemprop', 'itemscope',
  'itemtype', 'itemid', 'itemref', 'key', 'ref', 'command', 'commandfor', 'interestfor', 'writingsuggestions', 'autocapitalize',
  // React (parse5 lowercases attribute names)
  'classname', 'htmlfor', 'dangerouslysetinnerhtml', 'suppresshydrationwarning', 'suppresscontenteditablewarning',
]);
const INTERACTIVE_ROLES = new Set(['button', 'checkbox', 'switch', 'radio', 'slider', 'tab', 'combobox', 'menuitem', 'option', 'textbox', 'spinbutton']);
const NAME_FROM_CONTENT = new Set(['button', 'checkbox', 'switch', 'radio', 'tab', 'menuitem', 'option']);
const NATIVE_INTERACTIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);
const isFrameworkBinding = (n) => /^(:|@|#|\.|\?|v-|bind:|on:|use:|class:|style:|let:|transition:|in:|out:|animate:|x-|hx-)/.test(n);
const isDynamic = (v) => v != null && (v.includes(EXPR) || v.includes(MARK) || v.includes(TEXT) || /\{\{|\$\{/.test(v));
// Words agents reach for from other design systems, mapped to Trompe's values.
const SYNONYMS = { primary: 'accent', secondary: 'neutral', default: 'neutral', destructive: 'danger', error: 'danger', warning: 'danger',
  small: 'sm', medium: 'md', large: 'lg', s: 'sm', m: 'md', l: 'lg', round: 'circle', rounded: 'pill', square: 'rect', metallic: 'metal', steel: 'metal', aluminium: 'metal', aluminum: 'metal', frosted: 'glass', shiny: 'gloss', glossy: 'gloss', polished: 'mirror', realistic: 'real', subtle: 'soft',
  etched: 'engraved', debossed: 'engraved', carved: 'engraved', inset: 'engraved', raised: 'embossed', backlit: 'lit', glow: 'lit', glowing: 'lit', outline: 'printed', flat: 'printed' };
const pick = (value, values) => (values.includes(SYNONYMS[value?.toLowerCase()]) ? SYNONYMS[value.toLowerCase()] : suggest(value, values));
const CONTAINER_ENUMS = { 'data-tr-material': 'material', 'data-tr-finish': 'finish', 'data-tr-profile': 'profile', 'data-tr-realism': 'realism', 'data-tr-theme': 'theme' };

const FRAMEWORK_FILE = /\.(vue|svelte|jsx|tsx)$/i;
const isNumeric = (t) => t.kind === 'number' || (t.kind === 'enum' && t.values.every((v) => /^-?\d+(\.\d+)?$/.test(v)));

export function checkMarkup(file, src, data, abs) {
  const out = [];
  const els = elements(file, src);
  const at = (offset) => (offset == null ? {} : lineCol(src, offset));
  const push = (id, offset, props) => out.push(finding(id, { file, ...at(offset), ...props }));

  const ids = new Set(els.map((e) => attr(e, 'id')).filter(Boolean));
  const labelFor = new Set(els.filter((e) => e.tag === 'label').map((e) => attr(e, 'for')).filter(Boolean));
  const definedVars = new Set([...src.matchAll(/(--tr-[\w-]+)\s*:/g)].map((m) => m[1]));
  const depths = new Map(), realisms = new Map();

  for (const el of els) {
    const def = data.elements.get(el.tag);
    const isTr = el.tag.startsWith('tr-');

    // TR001
    if (isTr && !def) {
      const s = suggest(el.tag, data.elements.keys());
      push('TR001', el.nameStart, {
        element: el.tag,
        message: `<${el.tag}> is not a Trompe element.${s ? ` Did you mean <${s}>?` : ''}`,
        expected: s ? [s] : undefined,
        fix: s ? { kind: 'rename-element', from: el.tag, to: s } : undefined,
        _edits: s ? [el.nameStart, el.endTagNameStart].filter((x) => x != null).map((start) => ({ start, end: start + el.tag.length, text: s })) : undefined,
      });
      continue;
    }

    // Container attributes on any element: data-tr-skin / material / finish / ...
    for (const [name, a] of el.attrs) {
      if (isDynamic(a.value)) continue;
      if (name === 'data-tr-skin' && !data.enums.skin.includes(a.value) && !data.localSkins?.has(a.value)) {
        const s = suggest(a.value, [...data.enums.skin, ...(data.localSkins ?? [])]);
        push('TR006', a.start, {
          element: el.tag, attribute: name, value: a.value,
          message: `There is no skin called "${a.value}".${s ? ` Did you mean "${s}"?` : ''}`,
          expected: [...data.enums.skin, ...(data.localSkins ?? [])],
          fix: s ? { kind: 'set-attribute', name, value: s } : undefined,
          _edits: s ? [{ start: a.start, end: a.end, text: `${name}="${s}"` }] : undefined,
        });
      }
      const group = CONTAINER_ENUMS[name];
      if (group && !data.enums[group].includes(a.value)) {
        const s = pick(a.value, data.enums[group]);
        push('TR003', a.start, {
          element: el.tag, attribute: name, value: a.value,
          message: `${name}="${a.value}" is not a valid ${group}.`,
          expected: data.enums[group],
          fix: s ? { kind: 'set-attribute', name, value: s } : undefined,
          _edits: s ? [{ start: a.start, end: a.end, text: `${name}="${s}"` }] : undefined,
        });
      }
    }

    // Style attribute rules apply to everything; most only matter on tr-* elements.
    const style = attr(el, 'style');
    if (style && !isDynamic(style)) checkStyle(el, style, isTr, def);

    if (!isTr) {
      if (NATIVE_INTERACTIVE.has(el.tag)) checkNested(el);
      continue;
    }

    // TR002 / TR003 / TR004
    for (const [name, a] of el.attrs) {
      if (name.includes(EXPR) || name.includes(MARK)) continue; // ${on ? 'checked' : ''}: written by the expression
      if (GLOBAL_ATTRS.has(name) || name.startsWith('aria-') || name.startsWith('data-') || name.startsWith('on') || name.startsWith('xmlns') || isFrameworkBinding(name)) continue;
      const decl = def.attrs.get(name);
      if (!decl && def.props?.has(name)) continue; // a JS property written in JSX (valueText)
      if (!decl) {
        const s = suggest(name, def.attrs.keys());
        push('TR002', a.start, {
          element: el.tag, attribute: name,
          message: `<${el.tag}> has no "${name}" attribute.${s ? ` Did you mean "${s}"?` : ''}`,
          expected: s ? [s] : [...def.attrs.keys()],
          fix: s ? { kind: 'rename-attribute', from: name, to: s } : undefined,
          _edits: s ? [{ start: a.start, end: a.start + name.length, text: s }] : undefined,
        });
        continue;
      }
      if (decl.parsed.kind === 'boolean' && a.value != null && (a.value.includes(EXPR) || /\$\{/.test(a.value)) && !a.value.includes(MARK)) {
        // pressed="${done}" in a template string writes pressed="false", which is still on.
        push('TR004', a.start, {
          element: el.tag, attribute: name, value: a.value, severity: 'warning',
          message: `${name}="\${…}" sets the attribute whatever the value is, and ${name}="false" is still on. Write \${done ? '${name}' : ''} in a template string, ?${name}=\${done} in Lit, or set the .${decl.fieldName ?? name} property.`,
        });
        continue;
      }
      if (isDynamic(a.value)) continue;
      const t = decl.parsed;
      if (t.kind === 'enum' && !t.values.includes(a.value)) {
        const s = pick(a.value, t.values);
        push('TR003', a.start, {
          element: el.tag, attribute: name, value: a.value,
          message: `${name}="${a.value}" is not valid on <${el.tag}>.${s ? ` Use ${name}="${s}".` : ''}`,
          expected: t.values,
          fix: s ? { kind: 'set-attribute', name, value: s } : undefined,
          _edits: s ? [{ start: a.start, end: a.end, text: `${name}="${s}"` }] : undefined,
        });
      } else if (t.kind === 'number' && a.value.trim() !== '' && !Number.isFinite(Number(a.value))) {
        push('TR003', a.start, { element: el.tag, attribute: name, value: a.value, message: `${name} must be a number.` });
      } else if (FRAMEWORK_FILE.test(file) && decl.fieldName === name && isNumeric(t) && Number.isFinite(Number(a.value))) {
        // Frameworks set a known property as a property: max="100" would hand the element the string "100".
        const vue = /\.vue$/i.test(file);
        const text = vue ? `:${name}="${a.value}"` : `${name}={${a.value}}`;
        push('TR019', a.start, {
          element: el.tag, attribute: name, value: a.value,
          message: `${name}="${a.value}" passes a string; ${name} is a number property. Write ${text}.`,
          fix: { kind: 'set-attribute', name, value: a.value },
          _edits: [{ start: a.start, end: a.end, text }],
        });
      } else if (t.kind === 'boolean' && /^false$/i.test(a.value)) {
        push('TR004', a.start, {
          element: el.tag, attribute: name, value: a.value,
          message: `${name}="false" still turns ${name} on. Remove the attribute to turn it off.`,
          fix: { kind: 'remove-attribute', name },
          _edits: [{ start: a.start - (/\s/.test(src[a.start - 1]) ? 1 : 0), end: a.end, text: '' }],
        });
      }
    }

    // TR005 accessible name
    const role = def.role;
    const interactive = INTERACTIVE_ROLES.has(role) || ['tr-input', 'tr-textarea', 'tr-select'].includes(el.tag);
    if (interactive && !el.attrs.has('separator') && attr(el, 'role') !== 'separator' && attr(el, 'aria-hidden') !== 'true' && !hasName(el, def, role)) {
      push('TR005', el.nameStart, {
        element: el.tag,
        message: `<${el.tag}> has no accessible name. ${def.attrs.has('label') ? 'Add label="…", ' : 'Add visible text, '}aria-label="…" or aria-labelledby.`,
      });
    }
    // TR018 label in name: aria-label overrides the visible text, so it must contain it.
    const ariaLabel = attr(el, 'aria-label');
    if (interactive && ariaLabel && !isDynamic(ariaLabel) && NAME_FROM_CONTENT.has(role)) {
      const visible = textOf(el.node);
      const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (!visible.includes(TEXT) && !isDynamic(visible) && norm(visible) && !norm(ariaLabel).includes(norm(visible))) {
        push('TR018', el.attrs.get('aria-label').start, {
          element: el.tag, attribute: 'aria-label', value: ariaLabel,
          message: `aria-label="${ariaLabel}" hides the visible text "${visible.trim().replace(/\s+/g, ' ')}". Start the label with the visible words (or drop aria-label and let the text name it).`,
        });
      }
    }
    // Images are named by label, name (tr-avatar) or ARIA, and hidden by aria-hidden or `decorative`.
    const imgNamed = ['label', 'aria-label', 'aria-labelledby'].some((a) => attr(el, a)) || (def.attrs.has('name') && attr(el, 'name'));
    const imgHidden = attr(el, 'aria-hidden') === 'true' || (def.attrs.has('decorative') && el.attrs.has('decorative') && attr(el, 'decorative') !== 'false');
    if (role === 'img' && !imgNamed && !imgHidden) {
      const fix = def.attrs.has('name') ? 'Add name="…"' : 'Add label="…"';
      const hide = def.attrs.has('decorative') ? 'decorative' : 'aria-hidden="true"';
      push('TR005', el.nameStart, { element: el.tag, severity: 'warning', message: `<${el.tag}> conveys something but has no name. ${fix}, or ${hide} if it only decorates.` });
    }
    if (interactive) checkNested(el);

    // TR011 glass on glass
    if (inherited(el, 'material', 'data-tr-material') === 'glass' && el.parent && inherited(el.parent, 'material', 'data-tr-material') === 'glass' && (attr(el, 'material') === 'glass')) {
      push('TR011', el.nameStart, { element: el.tag, message: `Glass <${el.tag}> sits on another glass surface. Use a solid material for the inner element.` });
    }

    const d = attr(el, 'depth');
    if (d && Number(d) > 0) depths.set(d, depths.get(d) ?? el);
    const rl = attr(el, 'realism');
    if (rl) realisms.set(rl, realisms.get(rl) ?? el);
  }

  for (const el of els) {
    const rl = attr(el, 'data-tr-realism');
    if (rl) realisms.set(rl, realisms.get(rl) ?? el);
  }
  if (depths.size > 3) {
    const el = [...depths.values()][3];
    push('TR012', el.nameStart, { element: el.tag, message: `This view uses ${depths.size} raised depths (${[...depths.keys()].sort().join(', ')}). Keep it to three.` });
  }
  if (realisms.size > 2) {
    const el = [...realisms.values()][2];
    push('TR013', el.nameStart, { element: el.tag, message: `This view mixes ${realisms.size} realism levels (${[...realisms.keys()].join(', ')}). Pick one, two at most.` });
  }

  // TR015 skin stylesheet
  const skinUser = els.find((e) => e.attrs.has('data-tr-skin'));
  const loadsSkins = (text) => /skins(\/[\w-]+)?\.css|trompe\.bundle|\/skins\//.test(text);
  const linked = () => els.filter((e) => e.tag === 'link' && /stylesheet/.test(attr(e, 'rel') ?? '') && attr(e, 'href') && !/^[a-z]+:|^\/\//i.test(attr(e, 'href')))
    .some((e) => { const p = abs && resolve(dirname(abs), attr(e, 'href').split(/[?#]/)[0]); return p && existsSync(p) && loadsSkins(readFileSync(p, 'utf8')); });
  if (skinUser && /\.html?$/i.test(file) && /<html[\s>]|<!doctype/i.test(src) && !loadsSkins(src) && !linked() && !data.projectLoadsSkins) {
    push('TR015', skinUser.attrs.get('data-tr-skin').start, { element: skinUser.tag, message: 'data-tr-skin has no effect until the page loads trompe/skins.css or trompe/skins/<name>.css.' });
  }

  // CSS in <style> blocks
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) out.push(...checkCss(file, src, m[1], m.index + m[0].indexOf('>') + 1, data, definedVars));
  return out;

  function hasName(el, def, role) {
    if (attr(el, 'aria-label')?.trim() || attr(el, 'aria-labelledby')) return true;
    if (def.attrs.has('label') && attr(el, 'label')?.trim()) return true;
    if (attr(el, 'id') && labelFor.has(attr(el, 'id'))) return true;
    for (let p = el.parent; p; p = p.parent) if (p.tag === 'label') return true;
    if (NAME_FROM_CONTENT.has(role) || el.tag === 'tr-button') {
      const t = textOf(el.node);
      if (t.trim()) return true;
    }
    if ([...el.attrs.keys()].some((n) => isFrameworkBinding(n) && /label/i.test(n))) return true;
    return false;
  }

  function checkNested(el) {
    for (let p = el.parent; p; p = p.parent) {
      const pdef = data.elements.get(p.tag);
      const pInteractive = NATIVE_INTERACTIVE.has(p.tag) || (pdef && ['button', 'checkbox', 'switch', 'radio', 'slider', 'tab', 'menuitem', 'option'].includes(pdef.role));
      if (pInteractive && !(p.tag === 'a' && !attr(p, 'href'))) {
        push('TR014', el.nameStart, { element: el.tag, message: `<${el.tag}> is inside <${p.tag}>. Interactive elements cannot be nested; move it out.` });
        return;
      }
    }
  }

  function checkStyle(el, style, isTr, def) {
    const a = el.attrs.get('style');
    const decls = style.split(';').map((s) => s.trim()).filter(Boolean);
    for (const decl of decls) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const value = decl.slice(i + 1).trim();
      if (isTr && (prop === 'box-shadow' || prop === 'text-shadow' || (prop === 'filter' && /drop-shadow/.test(value)) || (/^background(-image)?$/.test(prop) && /gradient\(/.test(value)))) {
        push('TR007', a.start, { element: el.tag, message: `style="${prop}: …" on <${el.tag}> bypasses Trompe's light model. Use depth, material, finish, profile or a skin.` });
      }
      if (prop.startsWith('--_')) push('TR009', a.start, { element: el.tag, message: `${prop} is private to Trompe's components. Use a public --tr-* variable or attribute.` });
      if ((prop === '--tr-light-angle' || prop === '--tr-light-elevation') && !['html', 'body'].includes(el.tag) && !el.attrs.has('data-tr-skin') && !el.attrs.has('data-tr-scene')) {
        push('TR010', a.start, { element: el.tag, message: `${prop} is set on <${el.tag}>. Set the light once per scene (on :root, <body>, or a container marked data-tr-scene).` });
      }
      if (prop.startsWith('--tr-') && isTr && !known(prop, def)) {
        const s = suggest(prop, [...(def?.cssProperties ?? []), ...data.bundleVars, ...data.tokenVars]);
        push('TR017', a.start, { element: el.tag, message: `${prop} is not read by <${el.tag}> or any token.${s ? ` Did you mean ${s}?` : ''}`, expected: s ? [s] : undefined });
      }
    }
    for (const m of style.matchAll(/var\(\s*(--tr-[\w-]+)/g)) {
      if (!known(m[1]) && !definedVars.has(m[1])) {
        const s = suggest(m[1], [...data.tokenVars, ...data.bundleVars, ...data.componentVars]);
        push('TR008', a.start, { element: el.tag, message: `${m[1]} is not a Trompe token.${s ? ` Did you mean ${s}?` : ''}`, expected: s ? [s] : undefined });
      }
    }
  }

  function known(v, def) {
    return data.tokenVars.has(v) || data.bundleVars.has(v) || (def ? def.cssProperties.has(v) : data.componentVars.has(v));
  }
}

/** Rules that apply to CSS text (a .css file or a <style> block). */
export function checkCss(file, src, css, base, data, definedVars = new Set()) {
  const out = [];
  const at = (i) => lineCol(src, base + i);
  const declared = new Set([...definedVars, ...[...css.matchAll(/(--tr-[\w-]+)\s*:/g)].map((m) => m[1])]);
  for (const m of css.matchAll(/var\(\s*(--tr-[\w-]+)/g)) {
    const v = m[1];
    if (data.tokenVars.has(v) || data.bundleVars.has(v) || data.componentVars.has(v) || declared.has(v)) continue;
    const s = suggest(v, [...data.tokenVars, ...data.bundleVars, ...data.componentVars]);
    out.push(finding('TR008', { file, ...at(m.index), message: `${v} is not a Trompe token.${s ? ` Did you mean ${s}?` : ''}`, expected: s ? [s] : undefined }));
  }
  for (const m of css.matchAll(/(tr-[a-z-]+)::part\(\s*([\w-]+)\s*\)/g)) {
    const def = data.elements.get(m[1]);
    if (def && !def.parts.has(m[2])) {
      const s = suggest(m[2], def.parts);
      out.push(finding('TR016', { file, ...at(m.index), element: m[1], message: `<${m[1]}> has no part "${m[2]}".${s ? ` Did you mean "${s}"?` : ''}`, expected: [...def.parts] }));
    }
  }
  for (const m of css.matchAll(/(^|[;{\s])(--_[\w-]+)\s*:/g)) {
    const open = css.lastIndexOf('{', m.index + 1), close = css.lastIndexOf('}', open);
    if (!/\btr-[a-z]/.test(css.slice(close + 1, open))) continue;
    out.push(finding('TR009', { file, ...at(m.index + m[1].length), message: `${m[2]} is private to Trompe's components.` }));
  }
  return out;
}
