// Custom Elements Manifest analyzer plugin for Trompe.
//
// Makes custom-elements.json self-sufficient for agents, linters and type generators:
//   1. Expands Trompe's shared type aliases (Material, Finish, Profile, Realism, Depth, Size, Tone,
//      Orientation, and any other string-literal alias exported from src/internal/types.ts) into
//      explicit literal unions, so `type.text` alone tells a tool every allowed value. The alias
//      name is kept in `type.alias`.
//   2. Records the custom JSDoc `@role` tag as `role` on the class declaration (the ARIA role the
//      host element takes, e.g. "button", "switch", "slider"; absent for non-interactive elements).
//   3. Collects every `@example` tag into `examples` (array of HTML strings).
//   4. Treats Trompe's `define('tr-x', Class)` helper like `customElements.define()`, so elements
//      without an explicit @tag still get a tagName and a custom-element-definition export.
//   5. Drops phantom events the analyzer infers from `new Event(variable)` in shared helpers
//      (FormControl.emit), which would otherwise show up as an event literally named "type".
//   6. Rewrites module paths from src/**/*.ts to the published dist/**/*.js files.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Collects alias name -> array of literal source texts (e.g. "'metal'", "-2"). */
export function loadAliases() {
  const aliases = {};
  const tokensPath = resolve(root, 'src/generated/tokens.json');
  if (existsSync(tokensPath)) {
    const t = JSON.parse(readFileSync(tokensPath, 'utf8'));
    const str = (xs) => xs.map((x) => `'${x}'`);
    if (t.material) aliases.Material = str(Object.keys(t.material.values));
    if (t.finish) aliases.Finish = str(Object.keys(t.finish.values));
    if (t.profile) aliases.Profile = str(Object.keys(t.profile.values));
    if (t.realismPresets) aliases.Realism = str(Object.keys(t.realismPresets));
    if (t.depthLevels) aliases.Depth = t.depthLevels.map((d) => String(d.level));
  }
  // Pure string-literal unions declared in src/internal/types.ts (Size, Tone, Orientation, ...).
  const typesPath = resolve(root, 'src/internal/types.ts');
  if (existsSync(typesPath)) {
    const src = readFileSync(typesPath, 'utf8');
    const re = /export\s+type\s+([A-Z]\w*)\s*=\s*([^;]+);/g;
    for (const m of src.matchAll(re)) {
      const parts = m[2].split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length && parts.every((p) => /^(['"]).*\1$/.test(p) || /^-?\d+(\.\d+)?$/.test(p))) {
        aliases[m[1]] = parts.map((p) => p.replace(/^"(.*)"$/, "'$1'"));
      }
    }
  }
  return aliases;
}

/** Replaces alias identifiers in a type text with their literal unions. */
export function expandTypeText(text, aliases) {
  const names = Object.keys(aliases);
  if (!names.length) return { text, used: [] };
  const used = [];
  const re = new RegExp(`(?<![\\w'".-])(${names.join('|')})(?![\\w'"-])`, 'g');
  const out = text.replace(re, (name) => {
    used.push(name);
    return aliases[name].join(' | ');
  });
  return { text: out, used };
}

const toDist = (p) =>
  typeof p === 'string' ? p.replace(/^\/?src\//, 'dist/').replace(/\.ts$/, '.js') : p;

export function trompePlugin() {
  const aliases = loadAliases();
  /** module path -> [{ tag, className }] from define() calls */
  const defines = new Map();
  /** module path -> Set of class names that dispatch events with a non-literal type */
  const dynamicEventNames = new Map();

  const tagText = (ts, tag) => (ts.getTextOfJSDocComment(tag.comment) ?? '').trim();

  return {
    name: 'trompe',
    analyzePhase({ ts, node, moduleDoc }) {
      // 2 + 3: @role and @example on classes.
      if (ts.isClassDeclaration(node) && node.name) {
        const classDoc = moduleDoc.declarations.find((d) => d.name === node.name.text);
        if (!classDoc) return;
        for (const tag of ts.getJSDocTags(node)) {
          const name = tag.tagName.text;
          if (name === 'role') {
            const role = tagText(ts, tag);
            if (role) classDoc.role = role;
          } else if (name === 'example') {
            const example = tagText(ts, tag);
            if (example) (classDoc.examples ??= []).push(example);
          }
        }
      }
      // 4: define('tr-x', Class)
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'define' &&
        node.arguments.length >= 2 &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        ts.isIdentifier(node.arguments[1])
      ) {
        const list = defines.get(moduleDoc.path) ?? [];
        list.push({ tag: node.arguments[0].text, className: node.arguments[1].text });
        defines.set(moduleDoc.path, list);
      }
      // 5: dispatchEvent(new Event(type)) with a variable event type.
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^(Custom)?Event$/.test(node.expression.text) &&
        node.arguments?.[0] &&
        ts.isIdentifier(node.arguments[0])
      ) {
        let cls = node.parent;
        while (cls && !ts.isClassDeclaration(cls)) cls = cls.parent;
        if (cls?.name) {
          const key = `${moduleDoc.path}#${cls.name.text}`;
          const set = dynamicEventNames.get(key) ?? new Set();
          set.add(node.arguments[0].text);
          dynamicEventNames.set(key, set);
        }
      }
    },

    moduleLinkPhase({ moduleDoc }) {
      for (const decl of moduleDoc.declarations ?? []) {
        const phantom = dynamicEventNames.get(`${moduleDoc.path}#${decl.name}`);
        if (phantom && decl.events) {
          decl.events = decl.events.filter((e) => e.description || !phantom.has(e.name));
          if (!decl.events.length) delete decl.events;
        }
      }
      for (const { tag, className } of defines.get(moduleDoc.path) ?? []) {
        const decl = moduleDoc.declarations?.find((d) => d.name === className);
        if (!decl) continue;
        decl.tagName ??= tag;
        decl.customElement = true;
        moduleDoc.exports ??= [];
        if (!moduleDoc.exports.some((e) => e.kind === 'custom-element-definition' && e.name === tag)) {
          moduleDoc.exports.push({
            kind: 'custom-element-definition',
            name: tag,
            declaration: { name: className, module: moduleDoc.path },
          });
        }
      }
    },

    packageLinkPhase({ customElementsManifest }) {
      const expand = (type) => {
        if (!type?.text) return;
        const { text, used } = expandTypeText(type.text, aliases);
        if (used.length) {
          type.alias = type.text;
          type.text = text;
        }
      };
      const fixRef = (ref) => {
        if (ref?.module) ref.module = toDist(ref.module);
      };
      for (const mod of customElementsManifest.modules) {
        mod.path = toDist(mod.path);
        for (const decl of mod.declarations ?? []) {
          fixRef(decl.superclass);
          for (const m of decl.mixins ?? []) fixRef(m);
          for (const list of [decl.members, decl.attributes, decl.events]) {
            for (const item of list ?? []) {
              expand(item.type);
              expand(item.return?.type);
              for (const p of item.parameters ?? []) expand(p.type);
              fixRef(item.inheritedFrom);
            }
          }
          for (const p of decl.parameters ?? []) expand(p.type);
          expand(decl.return?.type);
          expand(decl.type);
        }
        for (const exp of mod.exports ?? []) fixRef(exp.declaration);
      }
    },
  };
}
