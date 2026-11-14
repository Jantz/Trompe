/**
 * Procedural surface textures for skins: wood, leather, linen, felt, stone, paper, terrazzo,
 * carbon fibre and knurling. Each is a tiny SVG (feTurbulence noise, optionally lit with
 * feDiffuseLighting from the skin's light direction) encoded as a data URI, so there are no image
 * files and nothing to download. A texture is a neutral grey relief that is blended over the
 * material's base colour, so the same "wood" becomes walnut, oak or ebony depending on --tr-m-base.
 *
 * Apply one in a skin with `"texture": "wood"` (or `{ "name": "wood", "scale": 1.5, "strength": 0.8 }`)
 * on an element entry, or directly with the --tr-m-texture, --tr-m-texture-size and
 * --tr-m-texture-blend custom properties.
 */

export const textures = ['wood', 'leather', 'linen', 'felt', 'stone', 'paper', 'terrazzo', 'carbon', 'knurl'] as const;
export type Texture = (typeof textures)[number];

export const textureDescriptions: Record<Texture, string> = {
  wood: 'Long-grain wood figure with growth bands and pores. Tint with --tr-m-base: dark brown for walnut, honey for oak, near-black for ebony.',
  leather: 'Pebbled hide with a lit, embossed grain.',
  linen: 'Woven threads in a fine plain weave, like bookcloth or a linen-wrapped case.',
  felt: 'Dense matted fibres with a soft, diffuse surface, like a desk mat or baize.',
  stone: 'Cast concrete or honed stone: cloudy tone with small pits.',
  paper: 'Cotton paper fibres. Subtler than the default grain, with a gentle tooth.',
  terrazzo: 'Polished chips of light and dark aggregate.',
  carbon: 'Woven carbon fibre twill.',
  knurl: 'Machined diamond knurling, for grips and dials.',
};

export interface TextureOptions {
  /** Size multiplier of the tile, 0.25..4. Default 1. */
  scale?: number;
  /** Relief contrast, 0..1. Default depends on the texture. */
  strength?: number;
  /** Light direction (CSS angle in degrees, 0 = from the top, clockwise) used to light reliefs. Default 330. */
  lightAngle?: number;
  /** Light height in degrees. Default 55. */
  lightElevation?: number;
  /** Noise seed, to vary the pattern. Default 7. */
  seed?: number;
}

export interface TextureCss {
  /** Value for --tr-m-texture: a url() image. */
  image: string;
  /** Value for --tr-m-texture-size. */
  size: string;
  /** Value for --tr-m-texture-blend. */
  blend: string;
}

interface Recipe {
  w: number;
  h: number;
  strength: number;
  blend: string;
  /** Returns the SVG body (inside <svg>) for a tile, given relief strength k and SVG light azimuth/elevation. */
  body: (k: number, az: number, el: number, seed: number) => string;
}

const f = (n: number) => String(Number(n.toFixed(4)));

/**
 * A filter that maps the red channel of its input to a height field, lights it from (az, el)
 * and re-centres the result on 50% grey with contrast k, so overlay/hard-light blends are neutral
 * on flat areas.
 */
const lit = (input: string, scale: number, k: number, az: number, el: number) => {
  const flat = Math.sin((el * Math.PI) / 180);
  return `<feColorMatrix in='${input}' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='h'/>
<feDiffuseLighting in='h' surfaceScale='${f(scale)}' diffuseConstant='1' lighting-color='#fff'><feDistantLight azimuth='${f(az)}' elevation='${f(el)}'/></feDiffuseLighting>
<feColorMatrix type='matrix' values='${f(k)} 0 0 0 ${f(0.5 - k * flat)} ${f(k)} 0 0 0 ${f(0.5 - k * flat)} ${f(k)} 0 0 0 ${f(0.5 - k * flat)} 0 0 0 0 1'/>`;
};

/** Tone from the red channel: grey = 0.5 + (r - 0.5) * k * 2. */
const tone = (input: string, k: number, result = '') =>
  `<feColorMatrix in='${input}' type='matrix' values='${f(2 * k)} 0 0 0 ${f(0.5 - k)} ${f(2 * k)} 0 0 0 ${f(0.5 - k)} ${f(2 * k)} 0 0 0 ${f(0.5 - k)} 0 0 0 0 1'${result ? ` result='${result}'` : ''}/>`;

const filter = (w: number, h: number, inner: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><filter id='t' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>${inner}</filter><rect width='100%' height='100%' filter='url(#t)'/></svg>`;

const RECIPES: Record<Texture, Recipe> = {
  wood: {
    w: 640,
    h: 320,
    strength: 0.45,
    blend: 'soft-light',
    body: (k, _az, _el, seed) =>
      filter(
        640,
        320,
        `<feTurbulence type='fractalNoise' baseFrequency='0.0028 0.075' numOctaves='4' seed='${seed}' stitchTiles='stitch' result='n'/>
<feComponentTransfer in='n' result='b'><feFuncR type='table' tableValues='0.5 0.15 0.62 0.3 0.75 0.2 0.58 0.38 0.85 0.25 0.6 0.42 0.5'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.012 0.9' numOctaves='2' seed='${seed + 3}' stitchTiles='stitch' result='p'/>
<feComposite in='b' in2='p' operator='arithmetic' k1='0' k2='0.82' k3='0.3' k4='-0.08' result='w'/>
${tone('w', k)}`,
      ),
  },
  leather: {
    w: 220,
    h: 220,
    strength: 0.5,
    blend: 'hard-light',
    body: (k, az, el, seed) =>
      filter(
        220,
        220,
        `<feTurbulence type='turbulence' baseFrequency='0.085' numOctaves='3' seed='${seed}' stitchTiles='stitch' result='n'/>
<feComponentTransfer in='n' result='c'><feFuncR type='gamma' amplitude='1' exponent='0.55' offset='0'/></feComponentTransfer>
${lit('c', 2.2, k, az, el)}`,
      ),
  },
  linen: {
    w: 180,
    h: 180,
    strength: 0.4,
    blend: 'hard-light',
    body: (k, az, el, seed) =>
      filter(
        180,
        180,
        `<feTurbulence type='fractalNoise' baseFrequency='0.9 0.014' numOctaves='2' seed='${seed}' stitchTiles='stitch' result='v'/>
<feTurbulence type='fractalNoise' baseFrequency='0.014 0.9' numOctaves='2' seed='${seed + 1}' stitchTiles='stitch' result='u'/>
<feComposite in='v' in2='u' operator='arithmetic' k2='0.5' k3='0.5' result='x'/>
${lit('x', 1.6, k, az, el)}`,
      ),
  },
  felt: {
    w: 200,
    h: 200,
    strength: 0.3,
    blend: 'hard-light',
    body: (k, az, el, seed) =>
      filter(
        200,
        200,
        `<feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='4' seed='${seed}' stitchTiles='stitch' result='n'/>
${lit('n', 0.9, k, az, el)}`,
      ),
  },
  stone: {
    w: 320,
    h: 320,
    strength: 0.38,
    blend: 'hard-light',
    body: (k, az, el, seed) =>
      filter(
        320,
        320,
        `<feTurbulence type='fractalNoise' baseFrequency='0.018' numOctaves='5' seed='${seed}' stitchTiles='stitch' result='n'/>
<feTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='2' seed='${seed + 5}' stitchTiles='stitch' result='q'/>
<feComponentTransfer in='q' result='pits'><feFuncR type='discrete' tableValues='0 1 1 1 1 1 1 1 1 1'/></feComponentTransfer>
<feComposite in='n' in2='pits' operator='arithmetic' k1='0.7' k2='0.3' k3='0' k4='0' result='s'/>
${lit('s', 1.4, k, az, el)}`,
      ),
  },
  paper: {
    w: 240,
    h: 240,
    strength: 0.22,
    blend: 'hard-light',
    body: (k, az, el, seed) =>
      filter(
        240,
        240,
        `<feTurbulence type='fractalNoise' baseFrequency='0.04 0.06' numOctaves='3' seed='${seed}' stitchTiles='stitch' result='a'/>
<feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2' seed='${seed + 2}' stitchTiles='stitch' result='b'/>
<feComposite in='a' in2='b' operator='arithmetic' k2='0.6' k3='0.4' result='p'/>
${lit('p', 1.2, k, az, el)}`,
      ),
  },
  terrazzo: {
    w: 360,
    h: 360,
    strength: 0.42,
    blend: 'hard-light',
    body: (k, _az, _el, seed) =>
      filter(
        360,
        360,
        `<feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='2' seed='${seed}' stitchTiles='stitch' result='a'/>
<feComponentTransfer in='a' result='chips'><feFuncR type='discrete' tableValues='0.5 0.5 0.5 0.5 0.9 0.5 0.5 0.1 0.5 0.5 0.5 0.75 0.5 0.5'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.13' numOctaves='2' seed='${seed + 9}' stitchTiles='stitch' result='b'/>
<feComponentTransfer in='b' result='fine'><feFuncR type='discrete' tableValues='0.5 0.5 0.5 0.2 0.5 0.5 0.8 0.5 0.5'/></feComponentTransfer>
<feComposite in='chips' in2='fine' operator='arithmetic' k2='0.6' k3='0.4' result='t'/>
${tone('t', k)}`,
      ),
  },
  carbon: {
    w: 12,
    h: 12,
    strength: 0.55,
    blend: 'hard-light',
    body: (k) => {
      const hi = (0.5 + k * 0.5).toFixed(3);
      const lo = (0.5 - k * 0.5).toFixed(3);
      const g = (v: string) => `rgb(${Math.round(+v * 255)},${Math.round(+v * 255)},${Math.round(+v * 255)})`;
      return `<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'><defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='${g(lo)}'/><stop offset='.5' stop-color='${g(hi)}'/><stop offset='1' stop-color='${g(lo)}'/></linearGradient><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${g(lo)}'/><stop offset='.5' stop-color='${g(hi)}'/><stop offset='1' stop-color='${g(lo)}'/></linearGradient></defs><rect width='6' height='6' fill='url(#a)'/><rect x='6' width='6' height='6' fill='url(#b)'/><rect y='6' width='6' height='6' fill='url(#b)'/><rect x='6' y='6' width='6' height='6' fill='url(#a)'/></svg>`;
    },
  },
  knurl: {
    w: 8,
    h: 8,
    strength: 0.6,
    blend: 'hard-light',
    body: (k, az) => {
      // A pyramid per cell: four facets lit by their angle to the light.
      const rad = (az * Math.PI) / 180;
      const lx = Math.cos(rad);
      const ly = Math.sin(rad);
      const shade = (nx: number, ny: number) => {
        const v = 0.5 + k * 0.5 * (nx * lx + ny * ly);
        const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
        return `rgb(${c},${c},${c})`;
      };
      return `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M0 0L8 0L4 4Z' fill='${shade(0, -1)}'/><path d='M8 0L8 8L4 4Z' fill='${shade(1, 0)}'/><path d='M8 8L0 8L4 4Z' fill='${shade(0, 1)}'/><path d='M0 8L0 0L4 4Z' fill='${shade(-1, 0)}'/></svg>`;
    },
  },
};

const encode = (svg: string) =>
  `url("data:image/svg+xml,${svg.replace(/\n/g, '').replace(/"/g, "'").replace(/[<>#%{}]/g, (c) => encodeURIComponent(c))}")`;

/**
 * Builds the CSS values for a texture. The relief is lit from the given light direction, so
 * embossed textures (leather, linen, stone, knurl) catch the light on the same side as the
 * surfaces they sit on.
 */
export function textureCss(name: Texture, options: TextureOptions = {}): TextureCss {
  const r = RECIPES[name];
  if (!r) throw new Error(`unknown texture "${name}". Use one of: ${textures.join(', ')}`);
  const scale = Math.min(4, Math.max(0.25, options.scale ?? 1));
  const k = Math.min(1, Math.max(0, options.strength ?? r.strength));
  // CSS light angle: 0 = from the top, clockwise. SVG azimuth: 0 = from +x (right), clockwise (y down).
  const az = (((options.lightAngle ?? 330) - 90) % 360 + 360) % 360;
  const el = Math.min(85, Math.max(10, options.lightElevation ?? 55));
  const seed = options.seed ?? 7;
  return {
    image: encode(r.body(k, az, el, seed)),
    size: `${f(r.w * scale)}px ${f(r.h * scale)}px`,
    blend: r.blend,
  };
}

/** Whether a string names a built-in texture. */
export function isTexture(name: unknown): name is Texture {
  return typeof name === 'string' && (textures as readonly string[]).includes(name);
}
