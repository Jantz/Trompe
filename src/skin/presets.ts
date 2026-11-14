/**
 * A library of real-world material recipes built from Trompe's primitives (material + finish +
 * texture + a few parameters). They are starting points: the Studio and the skin generator expand
 * a preset into an element entry, which you can then tune. Nothing here is a new primitive, so
 * every preset works anywhere a skin works.
 */
import type { SkinElement } from './types.js';

export type MaterialFamily = 'plastic' | 'metal' | 'glass' | 'wood' | 'leather' | 'textile' | 'mineral' | 'paper' | 'composite';

export interface MaterialPreset {
  /** Kebab-case id, e.g. "walnut". */
  id: string;
  /** Human label. */
  label: string;
  family: MaterialFamily;
  /** One line on what it looks like. */
  description: string;
  /** Words that select it in plain-language descriptions. */
  keywords: string[];
  /** Whether it reads well as large surfaces (panels, cards) and/or as small controls. */
  use: { surfaces: boolean; controls: boolean };
  /** The element entry it expands to. */
  spec: SkinElement;
}

const v = (base: string, ink: string, extra: Record<string, string> = {}) => ({ '--tr-m-base': base, '--tr-m-ink': ink, ...extra });

export const materialPresets: MaterialPreset[] = [
  // Plastics
  { id: 'satin-plastic', label: 'Satin plastic', family: 'plastic', description: 'Moulded plastic with a soft sheen in the skin surface colour.', keywords: ['plastic', 'satin', 'product', 'neutral'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'satin' } },
  { id: 'lacquer', label: 'Oxblood lacquer', family: 'plastic', description: 'Deep red clear-coated lacquer with a crisp window reflection.', keywords: ['lacquer', 'lacquered', 'oxblood', 'piano', 'enamel'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'gloss', vars: v('oklch(40% 0.13 22)', 'oklch(97% 0.01 30)') } },
  { id: 'candy', label: 'Candy plastic', family: 'plastic', description: 'Saturated glossy toy plastic.', keywords: ['candy', 'toy', 'playful', 'glossy', 'bubbly'], use: { surfaces: false, controls: true }, spec: { material: 'plastic', finish: 'gloss', profile: 'dome', vars: v('oklch(56% 0.2 15)', 'oklch(99% 0.01 15)') } },
  { id: 'soft-touch', label: 'Soft-touch rubber', family: 'plastic', description: 'Dark matte rubberised coating.', keywords: ['rubber', 'soft-touch', 'rubberized', 'rubberised', 'grippy', 'silicone'], use: { surfaces: true, controls: true }, spec: { material: 'rubber', finish: 'satin' } },
  { id: 'ceramic', label: 'Glazed ceramic', family: 'mineral', description: 'White glazed ceramic: smooth, cool and glossy.', keywords: ['ceramic', 'porcelain', 'glazed', 'clinical', 'appliance'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'gloss', vars: v('oklch(96% 0.006 90)', 'oklch(24% 0.012 260)', { '--tr-m-grain': '0' }) } },

  // Metals
  { id: 'aluminium', label: 'Brushed aluminium', family: 'metal', description: 'Bead-blasted then brushed silver aluminium.', keywords: ['aluminium', 'aluminum', 'brushed', 'silver', 'steel', 'metal', 'metallic'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'brushed' } },
  { id: 'anodized-black', label: 'Black anodized', family: 'metal', description: 'Black-anodized brushed aluminium, like pro equipment.', keywords: ['anodized', 'anodised', 'black-metal', 'pro', 'rack', 'gear'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'brushed', vars: v('oklch(30% 0.005 260)', 'oklch(93% 0.006 80)') } },
  { id: 'anodized-blue', label: 'Blue anodized', family: 'metal', description: 'Satin blue anodized aluminium.', keywords: ['anodized-blue', 'cobalt'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'satin', vars: v('oklch(46% 0.11 255)', 'oklch(98% 0.01 255)') } },
  { id: 'titanium', label: 'Titanium', family: 'metal', description: 'Warm grey bead-blasted titanium with a soft satin sheen.', keywords: ['titanium', 'graphite', 'pewter'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'satin', vars: v('oklch(68% 0.008 70)', 'oklch(20% 0.01 70)') } },
  { id: 'gunmetal', label: 'Gunmetal', family: 'metal', description: 'Dark blued steel with spun reflections on round parts.', keywords: ['gunmetal', 'iron', 'blued', 'industrial', 'machined'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'spun', vars: v('oklch(38% 0.012 250)', 'oklch(95% 0.005 250)') } },
  { id: 'brass', label: 'Brushed brass', family: 'metal', description: 'Warm brushed brass, like instrument trim.', keywords: ['brass', 'bronze', 'golden', 'warm-metal', 'nautical'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'brushed', vars: v('oklch(76% 0.1 85)', 'oklch(22% 0.04 70)') } },
  { id: 'copper', label: 'Copper', family: 'metal', description: 'Brushed rose copper.', keywords: ['copper', 'rose-gold', 'rosegold'], use: { surfaces: true, controls: true }, spec: { material: 'metal', finish: 'brushed', vars: v('oklch(66% 0.11 48)', 'oklch(16% 0.03 40)') } },
  { id: 'gold', label: 'Polished gold', family: 'metal', description: 'Mirror-polished yellow gold.', keywords: ['gold', 'gilded', 'luxury', 'jewellery', 'jewelry'], use: { surfaces: false, controls: true }, spec: { material: 'chrome', finish: 'mirror', vars: v('oklch(82% 0.12 85)', 'oklch(20% 0.04 70)') } },
  { id: 'chrome', label: 'Chrome', family: 'metal', description: 'Polished chrome reflecting sky, horizon and ground.', keywords: ['chrome', 'chromed', 'mirror', 'polished', 'y2k', 'millennium'], use: { surfaces: false, controls: true }, spec: { material: 'chrome', finish: 'mirror' } },
  { id: 'knurled-steel', label: 'Knurled steel', family: 'metal', description: 'Machined steel with diamond knurling, for grips.', keywords: ['knurled', 'knurl', 'grip', 'rugged', 'tool'], use: { surfaces: false, controls: true }, spec: { material: 'metal', finish: 'satin', texture: { name: 'knurl', scale: 0.75, strength: 0.24 }, vars: v('oklch(72% 0.006 250)', 'oklch(18% 0.01 250)') } },

  // Glass
  { id: 'frosted-glass', label: 'Frosted glass', family: 'glass', description: 'Translucent blurred glass. Put it over an image or a gradient.', keywords: ['glass', 'frosted', 'translucent', 'acrylic', 'blur'], use: { surfaces: true, controls: true }, spec: { material: 'glass', finish: 'satin' } },
  { id: 'smoked-glass', label: 'Smoked glass', family: 'glass', description: 'Dark tinted glass with a glossy edge.', keywords: ['smoked', 'tinted', 'smoky'], use: { surfaces: true, controls: true }, spec: { material: 'glass', finish: 'gloss', vars: v('oklch(22% 0.01 260 / 0.72)', 'oklch(97% 0.005 260)') } },

  // Wood
  { id: 'walnut', label: 'Walnut', family: 'wood', description: 'Oiled American walnut: dark chocolate grain with a low sheen.', keywords: ['walnut', 'wood', 'wooden', 'timber', 'mid-century', 'midcentury', 'hifi'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'satin', texture: 'wood', vars: v('oklch(40% 0.055 50)', 'oklch(95% 0.012 80)', { '--tr-m-specular': '0.35', '--tr-m-grain': '0' }) } },
  { id: 'oak', label: 'White oak', family: 'wood', description: 'Pale limed oak with a matte oil finish.', keywords: ['oak', 'birch', 'ash', 'scandinavian', 'nordic', 'blonde-wood', 'light-wood'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'matte', texture: 'wood', vars: v('oklch(80% 0.05 78)', 'oklch(24% 0.03 60)', { '--tr-m-grain': '0' }) } },
  { id: 'ebony', label: 'Piano ebony', family: 'wood', description: 'Near-black ebony under a deep clear coat.', keywords: ['ebony', 'piano-black', 'rosewood'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'gloss', texture: { name: 'wood', strength: 0.3 }, vars: v('oklch(22% 0.012 40)', 'oklch(94% 0.008 80)', { '--tr-m-grain': '0' }) } },

  // Leather and textiles
  { id: 'saddle-leather', label: 'Saddle leather', family: 'leather', description: 'Tan full-grain leather with a pebbled surface.', keywords: ['leather', 'saddle', 'tan', 'cognac', 'equestrian', 'library', 'study'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'satin', texture: 'leather', vars: v('oklch(52% 0.1 52)', 'oklch(97% 0.012 70)', { '--tr-m-specular': '0.3', '--tr-m-grain': '0' }) } },
  { id: 'black-leather', label: 'Black leather', family: 'leather', description: 'Supple black leather, like a watch strap or car interior.', keywords: ['black-leather', 'automotive', 'car', 'upholstery'], use: { surfaces: true, controls: true }, spec: { material: 'rubber', finish: 'satin', texture: 'leather', vars: v('oklch(25% 0.008 260)', 'oklch(94% 0.006 80)') } },
  { id: 'linen', label: 'Linen', family: 'textile', description: 'Natural linen bookcloth.', keywords: ['linen', 'fabric', 'cloth', 'bookcloth', 'canvas', 'textile', 'woven'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'matte', texture: 'linen', vars: v('oklch(88% 0.022 85)', 'oklch(25% 0.02 70)', { '--tr-m-grain': '0' }) } },
  { id: 'felt', label: 'Green baize', family: 'textile', description: 'Dense green felt, like a card table or desk pad.', keywords: ['felt', 'baize', 'billiard', 'pool', 'casino', 'wool'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'matte', texture: 'felt', vars: v('oklch(42% 0.085 155)', 'oklch(96% 0.01 150)', { '--tr-m-grain': '0' }) } },
  { id: 'charcoal-felt', label: 'Charcoal felt', family: 'textile', description: 'Grey wool felt.', keywords: ['grey-felt', 'gray-felt', 'charcoal-felt', 'acoustic'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'matte', texture: 'felt', vars: v('oklch(38% 0.006 260)', 'oklch(95% 0.005 260)', { '--tr-m-grain': '0' }) } },

  // Minerals and composites
  { id: 'concrete', label: 'Concrete', family: 'mineral', description: 'Cast concrete with a cloudy tone and small pits.', keywords: ['concrete', 'cement', 'brutalist', 'brutal', 'stone', 'industrial'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'matte', texture: 'stone', vars: v('oklch(72% 0.006 80)', 'oklch(20% 0.01 80)', { '--tr-m-grain': '0' }) } },
  { id: 'slate', label: 'Slate', family: 'mineral', description: 'Honed dark slate.', keywords: ['slate', 'basalt', 'granite'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'satin', texture: { name: 'stone', strength: 0.3 }, vars: v('oklch(34% 0.012 240)', 'oklch(95% 0.006 240)', { '--tr-m-grain': '0' }) } },
  { id: 'marble', label: 'Carrara marble', family: 'mineral', description: 'Polished white marble with soft grey veins.', keywords: ['marble', 'carrara', 'calacatta', 'veined'], use: { surfaces: true, controls: false }, spec: { material: 'plastic', finish: 'gloss', texture: 'marble', vars: v('oklch(94% 0.004 90)', 'oklch(22% 0.01 260)') } },
  { id: 'nero-marble', label: 'Black marble', family: 'mineral', description: 'Polished black marble with pale veins.', keywords: ['nero', 'marquina', 'black-marble'], use: { surfaces: true, controls: false }, spec: { material: 'plastic', finish: 'gloss', texture: { name: 'marble', strength: 0.45 }, vars: v('oklch(24% 0.006 260)', 'oklch(94% 0.004 90)') } },
  { id: 'terrazzo', label: 'Terrazzo', family: 'mineral', description: 'Polished terrazzo with light and dark chips.', keywords: ['terrazzo', 'speckled', 'chips'], use: { surfaces: true, controls: false }, spec: { material: 'plastic', finish: 'satin', texture: 'terrazzo', vars: v('oklch(91% 0.012 60)', 'oklch(24% 0.02 40)', { '--tr-m-grain': '0' }) } },
  { id: 'carbon', label: 'Carbon fibre', family: 'composite', description: 'Woven carbon fibre twill under clear coat.', keywords: ['carbon', 'carbon-fibre', 'carbon-fiber', 'racing', 'motorsport', 'performance'], use: { surfaces: true, controls: true }, spec: { material: 'plastic', finish: 'gloss', texture: { name: 'carbon', scale: 0.8, strength: 0.26 }, vars: v('oklch(27% 0.005 260)', 'oklch(95% 0.005 260)', { '--tr-m-grain': '0' }) } },

  // Paper
  { id: 'paper', label: 'Cotton paper', family: 'paper', description: 'Matte cotton paper with fibre grain.', keywords: ['paper', 'notebook', 'stationery', 'editorial', 'print'], use: { surfaces: true, controls: true }, spec: { material: 'paper', finish: 'matte', texture: 'paper' } },
  { id: 'kraft', label: 'Kraft card', family: 'paper', description: 'Brown kraft card stock.', keywords: ['kraft', 'cardboard', 'card', 'recycled', 'packaging'], use: { surfaces: true, controls: false }, spec: { material: 'paper', finish: 'matte', texture: 'paper', vars: v('oklch(68% 0.06 68)', 'oklch(18% 0.03 60)') } },
];

/** Looks up a preset by id. */
export function materialPreset(id: string): MaterialPreset | undefined {
  return materialPresets.find((p) => p.id === id);
}

/** Deep copy of a preset's element entry, ready to edit. */
export function presetSpec(id: string): SkinElement | undefined {
  const p = materialPreset(id);
  return p ? (JSON.parse(JSON.stringify(p.spec)) as SkinElement) : undefined;
}
