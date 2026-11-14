import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compileSkin,
  contrast,
  describeVocabulary,
  ensureContrast,
  fixContrast,
  materialPresets,
  paletteFromTokens,
  paletteTokens,
  parseColor,
  skinFromDescription,
  textureCss,
  textures,
  validateSkin,
  type Skin,
} from '../../src/skin/index.js';

const root = resolve(__dirname, '../..');
const bundled: Skin[] = readdirSync(resolve(root, 'skins'))
  .filter((f) => f.endsWith('.skin.json'))
  .map((f) => JSON.parse(readFileSync(resolve(root, 'skins', f), 'utf8')));
const errors = (s: Skin) => validateSkin(s).filter((f) => f.severity === 'error');

describe('colour', () => {
  it('matches WCAG reference contrast', () => {
    expect(contrast(parseColor('#000')!, parseColor('#fff')!).toFixed(2)).toBe('21.00');
    expect(contrast(parseColor('#767676')!, parseColor('white')!).toFixed(2)).toBe('4.54');
  });
  it('ensureContrast reaches the target and keeps the hue', () => {
    const bg = parseColor('oklch(60% 0.15 250)')!;
    const fg = ensureContrast(parseColor('oklch(70% 0.1 250)')!, bg, 4.5);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(fg.h - 250)).toBeLessThan(1);
  });
});

describe('compiler', () => {
  it('compiles every bundled skin to scoped CSS identical to the build output', () => {
    for (const skin of bundled) {
      const built = readFileSync(resolve(root, 'src/generated/skins', `${skin.name}.css`), 'utf8');
      expect(built.split('\n').slice(1).join('\n')).toBe(compileSkin(skin));
    }
  });
  it('honours a custom scope and emits texture variables', () => {
    const css = compileSkin(
      { name: 'x', colorScheme: 'light', tokens: {}, elements: { 'tr-panel': { material: 'plastic', texture: { name: 'wood', scale: 2 } } } },
      { scope: ':root' },
    );
    expect(css).toContain(':root');
    expect(css).not.toContain("data-tr-skin='x'");
    expect(css).toMatch(/--tr-m-texture: url\("data:image\/svg\+xml,/);
    expect(css).toContain('--tr-m-texture-size:');
  });
});

describe('textures', () => {
  it('produces deterministic, light-dependent SVG for every texture', () => {
    for (const t of textures) {
      const a = textureCss(t, { lightAngle: 330 });
      expect(a.image.startsWith('url("data:image/svg+xml,')).toBe(true);
      expect(textureCss(t, { lightAngle: 330 }).image).toBe(a.image);
      expect(a.size).toMatch(/^\d+(\.\d+)?px \d+(\.\d+)?px$/);
    }
    expect(textureCss('leather', { lightAngle: 0 }).image).not.toBe(textureCss('leather', { lightAngle: 180 }).image);
  });
  it('stays in sync with the list trompe check accepts', () => {
    const src = readFileSync(resolve(root, 'cli/check/skin.mjs'), 'utf8');
    const list = JSON.parse(src.match(/const TEXTURES = (\[[^\]]*\])/)![1]!.replace(/'/g, '"'));
    expect(list).toEqual(['none', ...textures]);
  });
});

describe('validation', () => {
  it('passes every bundled skin', () => {
    for (const skin of bundled) expect(errors(skin), skin.name).toEqual([]);
  });
  it('finds and fixes unreadable text', () => {
    const skin: Skin = { name: 'bad', colorScheme: 'light', tokens: { 'color.ink': 'oklch(85% 0 0)' }, elements: {} };
    expect(errors(skin).some((f) => f.path === 'tokens.color.ink')).toBe(true);
    const { skin: fixed, changed } = fixContrast(skin);
    expect(changed).toContain('tokens.color.ink');
    expect(errors(fixed)).toEqual([]);
  });
  it('rejects unknown vocabulary', () => {
    const skin = { name: 'v', colorScheme: 'light', tokens: {}, elements: { 'tr-button': { material: 'unobtainium', texture: 'plaid' } } } as unknown as Skin;
    const paths = errors(skin).map((f) => f.path);
    expect(paths).toContain('elements.tr-button.material');
    expect(paths).toContain('elements.tr-button.texture');
  });
});

describe('material presets', () => {
  it('every preset is valid and keeps its ink readable on its own base', () => {
    for (const p of materialPresets) {
      const skin: Skin = { name: 'p', colorScheme: 'light', tokens: {}, elements: { 'tr-panel': p.spec } };
      expect(errors(skin), p.id).toEqual([]);
      const base = p.spec.vars?.['--tr-m-base'];
      const ink = p.spec.vars?.['--tr-m-ink'];
      if (base && ink) expect(contrast(parseColor(ink)!, parseColor(base)!), p.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('palette', () => {
  it('generates passing palettes in both schemes and reads them back', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const hue of [20, 140, 260]) {
        const tokens = paletteTokens({ scheme, hue, tint: 0.6, accentHue: (hue + 180) % 360, accentChroma: 0.16, crispness: 0.5 });
        expect(errors({ name: 'pal', colorScheme: scheme, tokens, elements: {} }), `${scheme} ${hue}`).toEqual([]);
        expect(Math.abs(paletteFromTokens(tokens, scheme).hue - hue)).toBeLessThan(2);
      }
    }
  });
});

describe('describe to skin', () => {
  const prompts = [
    'walnut panels with brushed brass knobs, amber accent, low evening light',
    'clinical white ceramic, mint accent, rounded, calm motion',
    'cyberpunk dark carbon fibre with neon magenta accent, sharp corners, snappy',
    'scandinavian oak and linen, soft and flat, light',
    'black leather and chrome, automotive, dramatic light',
    'playful candy plastic, bouncy, very rounded',
    'a retro 70s kitchen with orange and cream enamel',
    '',
  ];
  it('always yields a valid, deterministic skin', () => {
    for (const p of prompts) {
      const a = skinFromDescription(p, { name: 'gen' });
      expect(errors(a.skin), p).toEqual([]);
      expect(a.skin.name).toBe('gen');
      expect(skinFromDescription(p, { name: 'gen' }).skin).toEqual(a.skin);
      expect(() => compileSkin(a.skin)).not.toThrow();
    }
  });
  it('maps materials to the roles they are described for', () => {
    const { skin, notes } = skinFromDescription('walnut panels with brushed brass knobs, amber accent, low evening light');
    const panel = skin.elements['tr-panel']!;
    const texName = typeof panel.texture === 'object' ? panel.texture.name : panel.texture;
    expect(texName).toBe('wood');
    expect(skin.elements['tr-knob']?.material).toBe('metal');
    expect(notes.length).toBeGreaterThan(2);
  });
  it('reads the colour scheme', () => {
    expect(skinFromDescription('dark graphite').skin.colorScheme).toBe('dark');
    expect(skinFromDescription('light paper').skin.colorScheme).toBe('light');
  });
  it('publishes its vocabulary', () => {
    expect(describeVocabulary.moods.length).toBeGreaterThan(10);
    expect(describeVocabulary.materials).toEqual(expect.arrayContaining(materialPresets.map((p) => p.id)));
  });
});
