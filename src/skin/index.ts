/**
 * trompe/skin: author, generate, validate and apply skins at runtime.
 *
 *   import { skinFromDescription, applySkin } from 'trompe/skin';
 *   const { skin, notes } = skinFromDescription('walnut and brass, amber accent, low evening light');
 *   applySkin(skin);
 *   document.body.dataset.trSkin = skin.name;
 *
 * The same compiler builds trompe/skins.css, so runtime and build output are identical.
 */
export type { Skin, SkinElement, SkinTexture } from './types.js';
export { compileSkin, tokenVariable, bundleDeclarations, textureDeclarations, type CompileOptions } from './compile.js';
export { applySkin, type AppliedSkin } from './apply.js';
export { textures, textureDescriptions, textureCss, textureSpread, textureDefaultStrength, isTexture, type Texture, type TextureOptions, type TextureCss } from './textures.js';
export { materialPresets, materialPreset, presetSpec, type MaterialPreset, type MaterialFamily } from './presets.js';
export { paletteTokens, paletteFromTokens, CONTRAST_PAIRS, type PaletteInput } from './palette.js';
export { validateSkin, fixContrast, contrastReport, resolveColor, setSkinPath, surfaceRange, type SkinFinding } from './validate.js';
export { skinFromDescription, describeVocabulary, MOTION as motionFeels, type DescribeResult, type DescribeOptions } from './describe.js';
export { parseColor, formatOklch, contrast, ensureContrast, toHex, toGamut, inGamut, luminance, themed, type Oklch } from './color.js';
export { elementTags, type ElementTag } from '../generated/elements.js';
