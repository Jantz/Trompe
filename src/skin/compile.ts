/**
 * The skin compiler: turns a skin (skins/<name>.skin.json) into CSS. The package build uses this
 * same function to produce trompe/skins.css, and the Studio uses it to restyle its preview on
 * every edit, so what you see while editing is byte-for-byte what ships.
 */
import { tokens } from '../generated/tokens.js';
import { elementTags } from '../generated/elements.js';
import { isTexture, textureCss } from './textures.js';
import type { Skin, SkinElement, SkinTexture } from './types.js';

export interface CompileOptions {
  /**
   * Selector the skin is scoped to. Default `:where([data-tr-skin='<name>'])`. Pass e.g. `:root`
   * to apply a skin to a whole page without the attribute.
   */
  scope?: string;
  /** Element tags that "*" expands to. Default: every element Trompe defines. */
  tags?: readonly string[];
  /**
   * Light used to bake texture relief, instead of the skin's own light.angle/light.elevation.
   * Editors pass the previous light while the user drags the light, so textures are not
   * regenerated on every pointer move.
   */
  textureLight?: { angle: number; elevation: number };
}

const GROUPS = { material: 'm', finish: 'f', profile: 'p' } as const;
type Group = keyof typeof GROUPS;

interface TokenMeta {
  name: string;
  cssVariable: string;
  value: unknown;
  darkValue?: unknown;
}
const meta = tokens as unknown as readonly TokenMeta[];
const byName = new Map(meta.map((t) => [t.name, t]));

/** CSS variable for a token path, e.g. "color.accent" -> --tr-color-accent, "realism.default" -> --tr-realism. */
export function tokenVariable(path: string): string {
  if (path === 'realism') return '--tr-realism';
  return byName.get(path)?.cssVariable ?? `--tr-${path.split('.').join('-')}`;
}

/** The --tr-m-*, --tr-f-* or --tr-p-* declarations a named bundle sets. */
export function bundleDeclarations(group: Group, name: string): string[] {
  const prefix = `${group}.${name}.`;
  const set = meta.filter((t) => t.name.startsWith(prefix));
  if (!set.length) throw new Error(`unknown ${group} "${name}"`);
  return set.map((t) => {
    const param = t.name.slice(prefix.length);
    const v = String(t.value);
    const value = v.startsWith('var(') && t.darkValue === undefined ? v : `var(${t.cssVariable})`;
    return `--tr-${GROUPS[group]}-${param}: ${value};`;
  });
}

const angle = (v: unknown, fallback: number) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

/** Declarations for a texture entry: --tr-m-texture, --tr-m-texture-size, --tr-m-texture-blend. */
export function textureDeclarations(texture: SkinTexture, skin?: Pick<Skin, 'tokens'>, light?: CompileOptions['textureLight']): string[] {
  if (texture === 'none') return ['--tr-m-texture: none;'];
  const spec = typeof texture === 'string' ? { name: texture } : texture;
  if (!isTexture(spec.name)) throw new Error(`unknown texture "${String(spec.name)}"`);
  const t = textureCss(spec.name, {
    ...spec,
    lightAngle: light?.angle ?? angle(skin?.tokens?.['light.angle'], 330),
    lightElevation: light?.elevation ?? angle(skin?.tokens?.['light.elevation'], 55),
  });
  return [`--tr-m-texture: ${t.image};`, `--tr-m-texture-size: ${t.size};`, `--tr-m-texture-blend: ${t.blend};`];
}

const decls = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}: ${v};`);

/** Compiles a skin to CSS. Throws on unknown materials, finishes, profiles or textures. */
export function compileSkin(skin: Skin, options: CompileOptions = {}): string {
  const scope = options.scope ?? `:where([data-tr-skin='${skin.name}'])`;
  const allTags = (options.tags ?? elementTags).join(', ');
  const out = [`/* Trompe skin "${skin.name}": ${skin.description} */`];

  const rootDecls: string[] = [];
  if (skin.colorScheme) rootDecls.push(`color-scheme: ${skin.colorScheme};`, `--tr-lift: ${skin.colorScheme === 'dark' ? 1 : 0};`);
  for (const [path, value] of Object.entries(skin.tokens ?? {})) rootDecls.push(`${tokenVariable(path)}: ${value};`);
  rootDecls.push('color: var(--tr-color-ink);');
  out.push(`${scope} {\n  ${rootDecls.join('\n  ')}\n}`);

  for (const [el, spec] of Object.entries(skin.elements ?? {}) as [string, SkinElement][]) {
    const target = el === '*' ? `:is(${allTags})` : el;
    for (const group of Object.keys(GROUPS) as Group[]) {
      const extra =
        group === 'material'
          ? [...decls(spec.vars ?? {}), ...(spec.texture ? textureDeclarations(spec.texture, skin, options.textureLight) : [])]
          : [];
      if (!spec[group] && !extra.length) continue;
      const body = [...(spec[group] ? bundleDeclarations(group, spec[group]!) : []), ...extra];
      out.push(`${scope} :where(${target}:not([${group}])) {\n  ${body.join('\n  ')}\n}`);
    }
    if (spec.style) out.push(`${scope} :where(${target}) {\n  ${decls(spec.style).join('\n  ')}\n}`);
  }
  if (!options.scope) {
    // Upgrade cloak: a page whose <html> or <body> wears this skin stays transparent until its
    // custom elements are defined (at most 1.2s), then fades in, so nothing jumps while they render.
    out.push(
      `:where(html, body)${scope} {\n  transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;\n}`,
      `:where(html, body)${scope}:has(:not(:defined)) {\n  opacity: 0;\n  animation: tr-uncloak 0s 1.2s forwards;\n}`,
      `@keyframes tr-uncloak {\n  to {\n    opacity: 1;\n  }\n}`,
    );
  }
  return out.join('\n') + '\n';
}
