import type { Finish, Material, Profile, TokenName } from '../generated/tokens.js';
import type { Texture } from './textures.js';

/** A texture on a skin element: a name, or a name with tile scale and relief strength. */
export type SkinTexture = Texture | 'none' | { name: Texture; scale?: number; strength?: number; seed?: number };

/**
 * What a skin sets on one element type (or on every element, under "*").
 * Anything set explicitly on an element in markup (material="chrome", style="--tr-m-base: …") still wins.
 */
export interface SkinElement {
  /** Material bundle: plastic, metal, chrome, glass, paper, rubber. */
  material?: Material;
  /** Finish bundle, overriding how the material reflects light. */
  finish?: Finish;
  /** Cross-section: flat, convex, concave, dome, bevel. */
  profile?: Profile;
  /** Procedural surface texture blended over the material's base colour. */
  texture?: SkinTexture;
  /** Material, finish and profile parameters: --tr-m-*, --tr-f-*, --tr-p-* (custom materials). */
  vars?: Record<string, string>;
  /** Component CSS properties and tokens set on the element, e.g. --tr-button-radius. */
  style?: Record<string, string>;
}

/**
 * A complete visual style, applied with data-tr-skin="<name>" on any container.
 * The JSON form of this interface is the skins/<name>.skin.json file format.
 */
export interface Skin {
  /** Lowercase kebab-case; becomes data-tr-skin="<name>". */
  name: string;
  /** One sentence on what the skin looks like. Agents choose skins by it. */
  description: string;
  /** Whether the skin is a light or a dark interface. */
  colorScheme?: 'light' | 'dark';
  /** Token overrides by dot name, e.g. "color.accent", "light.angle", "radius.md", "realism.default". */
  tokens?: Partial<Record<TokenName, string | number>> & Record<string, string | number>;
  /** Per-element defaults, keyed by tag name or "*" for every Trompe element. */
  elements?: Record<string, SkinElement>;
}
