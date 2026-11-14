// Turns source files into parse5 trees with positions in the original file.
// Supports .html/.htm, .vue (template), .svelte, and Lit html`` literals in .js/.ts/.mjs/.jsx/.tsx.
import { parse, parseFragment } from 'parse5';
import { extname } from 'node:path';

export const EXPR = '⁣expr⁣'; // placeholder for template expressions

/** Returns markup regions: { offset, text, fragment } where offset is into the original source. */
export function regions(file, src) {
  const ext = extname(file).toLowerCase();
  if (ext === '.html' || ext === '.htm') return [{ offset: 0, text: src, fragment: !/<html[\s>]|<!doctype/i.test(src) }];
  if (ext === '.vue') {
    const m = src.match(/<template[^>]*>([\s\S]*)<\/template>/i);
    if (!m) return [];
    const start = m.index + m[0].indexOf('>') + 1;
    return [{ offset: start, text: blankExpressions(m[1], /\{\{[\s\S]*?\}\}/g), fragment: true }];
  }
  if (ext === '.svelte') {
    const text = blankBlocks(src, /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi);
    return [{ offset: 0, text: blankExpressions(text, /\{[^{}]*\}/g), fragment: true }];
  }
  if (['.js', '.mjs', '.ts', '.mts', '.jsx', '.tsx'].includes(ext)) {
    const out = [];
    const re = /\bhtml`/g;
    let m;
    while ((m = re.exec(src))) {
      const start = m.index + m[0].length;
      const end = findTemplateEnd(src, start);
      if (end < 0) break;
      out.push({ offset: start, text: blankTemplateExprs(src.slice(start, end)), fragment: true });
      re.lastIndex = end + 1;
    }
    return out;
  }
  return [];
}

// Replace matches with a same-length placeholder so offsets stay valid.
function blankExpressions(text, re) {
  return text.replace(re, (s) => (s.length >= EXPR.length ? EXPR + ' '.repeat(s.length - EXPR.length) : s));
}
function blankBlocks(text, re) {
  return text.replace(re, (s) => s.replace(/[^\n]/g, ' '));
}
function findTemplateEnd(src, i) {
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (depth === 0 && c === '`') return i;
    if (c === '$' && src[i + 1] === '{') { depth++; i++; continue; }
    if (depth > 0 && c === '}') depth--;
    if (depth > 0 && c === '`') { const e = findTemplateEnd(src, i + 1); if (e < 0) return -1; i = e; }
  }
  return -1;
}
function blankTemplateExprs(text) {
  let out = '', i = 0;
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1, j = i + 2;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const len = j - i;
      out += len >= EXPR.length ? EXPR + ' '.repeat(len - EXPR.length) : 'x'.repeat(len);
      i = j;
    } else out += text[i++];
  }
  return out;
}

// Frameworks allow <tr-knob ... />. HTML does not, so expand those to <tr-knob ...></tr-knob>
// and keep a list of insertions to map parse5 offsets back to the original source.
function expandSelfClosing(region) {
  const inserts = [];
  let added = 0;
  const text = region.text.replace(/<([a-z][\w]*-[\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/>/g, (m, tag, attrs, at) => {
    const rep = `<${tag}${attrs}></${tag}>`;
    // The original "<tag attrs" prefix maps 1:1; the rest is replaced.
    const keep = 1 + tag.length + attrs.length;
    inserts.push({ at: at + added + keep, len: rep.length - m.length, origAt: at + keep });
    added += rep.length - m.length;
    return rep;
  });
  const toOrig = (i) => {
    let delta = 0;
    for (const ins of inserts) {
      if (i < ins.at) break;
      if (i < ins.at + ins.len) return ins.origAt + region.offset;
      delta += ins.len;
    }
    return i - delta + region.offset;
  };
  return { ...region, text, toOrig };
}

/** Line/column (1-based) of an offset in the original source. */
export function lineCol(src, offset) {
  let line = 1, last = -1;
  for (let i = 0; i < offset && i < src.length; i++) if (src.charCodeAt(i) === 10) { line++; last = i; }
  return { line, column: offset - last };
}

/**
 * Parses a file and returns a flat list of element records:
 * { tag, attrs: Map<name, {value, start, end}>, start, nameStart, end, endTagStart, parent, text, node }
 * Offsets are into the original source.
 */
export function elements(file, src) {
  const out = [];
  for (const raw of regions(file, src)) {
    const r = /\.html?$/i.test(file) ? { ...raw, toOrig: (i) => i + raw.offset } : expandSelfClosing(raw);
    const tree = (r.fragment ? parseFragment : parse)(r.text, { sourceCodeLocationInfo: true });
    walk(tree, null, r.toOrig, out);
  }
  return out;
}

function walk(node, parent, map, out) {
  for (const child of node.childNodes ?? []) {
    if (!child.tagName) continue;
    const loc = child.sourceCodeLocation;
    const attrs = new Map();
    for (const a of child.attrs ?? []) {
      const al = loc?.attrs?.[a.name];
      attrs.set(a.name, { value: a.value, start: al ? map(al.startOffset) : undefined, end: al ? map(al.endOffset) : undefined });
    }
    const rec = {
      tag: child.tagName,
      attrs,
      start: loc ? map(loc.startOffset) : undefined,
      nameStart: loc?.startTag ? map(loc.startTag.startOffset + 1) : undefined,
      endTagNameStart: loc?.endTag && map(loc.endTag.startOffset) !== map(loc.endTag.startOffset + 2) - 2 ? undefined : loc?.endTag ? map(loc.endTag.startOffset + 2) : undefined,
      parent,
      node: child,
    };
    out.push(rec);
    const content = child.tagName === 'template' && child.content ? child.content : child;
    walk(content, rec, map, out);
  }
}

/** Visible text inside a node, ignoring <svg> titles-less content and comments. */
export function textOf(node) {
  let s = '';
  for (const c of node.childNodes ?? []) {
    if (c.nodeName === '#text') s += c.value;
    else if (c.tagName && c.tagName !== 'svg' && c.tagName !== 'template' && c.tagName !== 'script' && c.tagName !== 'style') {
      if (c.attrs?.some((a) => a.name === 'aria-hidden' && a.value === 'true')) continue;
      if (c.attrs?.some((a) => a.name === 'slot' && ['start', 'end', 'icon', 'prefix', 'suffix'].includes(a.value)) && !textOf(c).trim()) continue;
      s += textOf(c);
    } else if (c.tagName === 'svg') {
      const title = (c.childNodes ?? []).find((x) => x.tagName === 'title');
      if (title) s += textOf(title);
    }
  }
  return s;
}

export function attr(rec, name) {
  return rec.attrs.get(name)?.value;
}

/** Nearest ancestor (or self) value of an attribute, also checking a data-tr-* container form. */
export function inherited(rec, name, containerName) {
  for (let r = rec; r; r = r.parent) {
    if (r.attrs.has(name) && r.tag.startsWith('tr-')) return r.attrs.get(name).value;
    if (containerName && r.attrs.has(containerName)) return r.attrs.get(containerName).value;
  }
  return undefined;
}
