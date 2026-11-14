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

export const textures = ['wood', 'leather', 'linen', 'felt', 'stone', 'marble', 'paper', 'terrazzo', 'carbon', 'knurl'] as const;
export type Texture = (typeof textures)[number];

export const textureDescriptions: Record<Texture, string> = {
  wood: 'Long-grain wood figure with growth bands and pores. Tint with --tr-m-base: dark brown for walnut, honey for oak, near-black for ebony.',
  leather: 'Pebbled hide with a lit, embossed grain.',
  linen: 'Woven threads in a fine plain weave, like bookcloth or a linen-wrapped case.',
  felt: 'Dense matted fibres with a soft, diffuse surface, like a desk mat or baize.',
  stone: 'Cast concrete or honed stone: cloudy tone with small pits.',
  marble: 'Polished marble: branching grey veins over a soft, cloudy stone.',
  paper: 'Cotton paper fibres. Subtler than the default grain, with a gentle tooth.',
  terrazzo: 'Polished chips of light and dark aggregate.',
  carbon: 'Woven 2x2 carbon fibre twill whose tows catch the light by direction.',
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
    w: 720,
    h: 360,
    strength: 0.42,
    blend: 'soft-light',
    // Growth rings are contour lines of a smooth, mostly vertical field (as in a real plank, where
    // the saw cuts through the tree's ring cylinders). A slow warp gives the figure (cathedrals),
    // the ring profile is a soft earlywood ramp ending in a sharp latewood line, and fine pores
    // run along the grain on top.
    body: (k, _az, _el, seed) =>
      filter(
        720,
        360,
        `<feTurbulence type='fractalNoise' baseFrequency='0.0009 0.0095' numOctaves='2' seed='${seed}' stitchTiles='stitch' result='y'/>
<feTurbulence type='fractalNoise' baseFrequency='0.0028 0.0042' numOctaves='1' seed='${seed + 11}' stitchTiles='stitch' result='q'/>
<feComposite in='y' in2='q' operator='arithmetic' k2='1.25' k3='0.4' k4='-0.32' result='f'/>
<feComponentTransfer in='f' result='rings'><feFuncR type='table' tableValues='0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5 0.62 0.6 0.57 0.52 0.3 0.5'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.006 0.55' numOctaves='2' seed='${seed + 3}' stitchTiles='stitch' result='p'/>
<feComposite in='rings' in2='p' operator='arithmetic' k2='0.86' k3='0.2' k4='-0.03' result='w'/>
${tone('w', k)}`,
      ),
  },
  leather: {
    w: 260,
    h: 260,
    strength: 0.34,
    blend: 'hard-light',
    // Fine pebble grain (cells from turbulence, softened) over a few broad, shallow creases.
    body: (k, az, el, seed) =>
      filter(
        260,
        260,
        `<feTurbulence type='turbulence' baseFrequency='0.3' numOctaves='2' seed='${seed}' stitchTiles='stitch' result='n'/>
<feComponentTransfer in='n' result='c'><feFuncR type='gamma' amplitude='1' exponent='0.6' offset='0'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='2' seed='${seed + 4}' stitchTiles='stitch' result='w'/>
<feComposite in='c' in2='w' operator='arithmetic' k2='0.55' k3='0.45' result='s'/>
${lit('s', 0.9, k, az, el)}`,
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
    strength: 0.46,
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
  marble: {
    w: 640,
    h: 640,
    strength: 0.6,
    blend: 'soft-light',
    // Veins are single contour lines of smooth, warped noise fields (one bold system, one fine),
    // so they run long and sinuous like real marble, over a soft cloudy layer for depth.
    body: (k, _az, _el, seed) =>
      filter(
        640,
        640,
        `<feTurbulence type='fractalNoise' baseFrequency='0.0024 0.0042' numOctaves='4' seed='${seed}' stitchTiles='stitch' result='a'/>
<feColorMatrix in='a' type='matrix' values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1' result='ao'/>
<feComponentTransfer in='ao' result='v'><feFuncR type='table' tableValues='0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.6 0.3 0.18 0.36 0.62 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.006 0.009' numOctaves='3' seed='${seed + 5}' stitchTiles='stitch' result='b'/>
<feColorMatrix in='b' type='matrix' values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1' result='bo'/>
<feComponentTransfer in='bo' result='v2'><feFuncR type='table' tableValues='0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.66 0.48 0.68 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8 0.8'/></feComponentTransfer>
<feComposite in='v' in2='v2' operator='arithmetic' k1='1.25' k4='-0.02' result='vv'/>
<feTurbulence type='fractalNoise' baseFrequency='0.005' numOctaves='3' seed='${seed + 2}' stitchTiles='stitch' result='c'/>
<feColorMatrix in='c' type='matrix' values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1' result='co'/>
<feComposite in='vv' in2='co' operator='arithmetic' k2='0.95' k3='0.14' k4='-0.07' result='m'/>
${tone('m', k)}`,
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
    strength: 0.3,
    blend: 'hard-light',
    body: (k, _az, _el, seed) =>
      filter(
        360,
        360,
        `<feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='1' seed='${seed}' stitchTiles='stitch' result='a'/>
<feComponentTransfer in='a' result='chips'><feFuncR type='discrete' tableValues='0.5 0.5 0.5 0.5 0.5 0.5 0.95 0.95 0.95 0.95'/></feComponentTransfer>
<feTurbulence type='fractalNoise' baseFrequency='0.21' numOctaves='1' seed='${seed + 9}' stitchTiles='stitch' result='b'/>
<feComponentTransfer in='b' result='fine'><feFuncR type='discrete' tableValues='0.1 0.1 0.1 0.5 0.5 0.5 0.5 0.5 0.5 0.5'/></feComponentTransfer>
<feComposite in='chips' in2='fine' operator='arithmetic' k2='0.6' k3='0.4' result='t'/>
${tone('t', k)}`,
      ),
  },
  carbon: {
    w: 24,
    h: 24,
    strength: 0.34,
    blend: 'hard-light',
    // 2x2 twill: tows step one cell per row, so the weave reads as diagonal ribs. Each tow is a
    // little cylinder with a sheen along its length; which direction shines depends on the light.
    body: (k, az) => {
      const rad = (az * Math.PI) / 180;
      const lx = Math.abs(Math.cos(rad));
      const ly = Math.abs(Math.sin(rad));
      const g = (v: number) => {
        const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
        return `rgb(${c},${c},${c})`;
      };
      // Horizontal tows catch light coming from above/below, vertical tows light from the sides.
      const hx = 0.5 + k * (-0.2 + 0.9 * ly);
      const vx = 0.5 + k * (-0.2 + 0.9 * lx);
      const lo = 0.5 - k * 0.55;
      const grad = (id: string, horizontal: boolean, peak: number) =>
        `<linearGradient id='${id}' x1='0' y1='0' x2='${horizontal ? 0 : 1}' y2='${horizontal ? 1 : 0}'><stop offset='0' stop-color='${g(lo)}'/><stop offset='.18' stop-color='${g(peak - k * 0.2)}'/><stop offset='.42' stop-color='${g(peak)}'/><stop offset='.75' stop-color='${g(peak - k * 0.25)}'/><stop offset='1' stop-color='${g(lo + k * 0.1)}'/></linearGradient>`;
      let cells = '';
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) cells += `<rect x='${c * 6}' y='${r * 6}' width='6' height='6' fill='url(#${(c + r) % 4 < 2 ? 'h' : 'v'})'/>`;
      return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><defs>${grad('h', true, hx)}${grad('v', false, vx)}</defs>${cells}</svg>`;
    },
  },
  knurl: {
    w: 8,
    h: 8,
    strength: 0.38,
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

/**
 * How far each texture moves the lightness (OKLCH L) of a flat base, measured in Chromium at the
 * texture's default strength: [darkest, lightest] shift for bases at L = 0.15, 0.3 … 0.9, using the
 * 2nd and 98th percentile of the rendered tile. Contrast checks use it to test text against the
 * darkest and lightest parts of a textured surface, not only its base colour.
 * Re-measure (scripts in the Studio PR) when a recipe changes.
 */
const SPREAD: Record<Texture, number[][]> = {
  wood: [[0.023, 0.021], [0.055, 0.037], [0.071, 0.038], [0.075, 0.027], [0.061, 0.017], [0.031, 0.007]],
  leather: [[0.004, 0.047], [0.012, 0.033], [0.02, 0.025], [0.027, 0.017], [0.034, 0.01], [0.042, 0.004]],
  linen: [[0.01, 0.103], [0.03, 0.077], [0.05, 0.058], [0.07, 0.039], [0.088, 0.023], [0.105, 0.01]],
  felt: [[0.009, 0.065], [0.02, 0.047], [0.028, 0.034], [0.042, 0.023], [0.051, 0.014], [0.063, 0.004]],
  stone: [[0.004, 0.03], [0.008, 0.02], [0.012, 0.016], [0.017, 0.01], [0.021, 0.005], [0.025, 0.001]],
  marble: [[0.059, 0.077], [0.133, 0.146], [0.179, 0.138], [0.185, 0.108], [0.148, 0.072], [0.073, 0.029]],
  paper: [[0.004, 0.03], [0.008, 0.02], [0.012, 0.016], [0.017, 0.01], [0.021, 0.005], [0.025, 0.001]],
  terrazzo: [[0.01, 0.358], [0.034, 0.282], [0.055, 0.215], [0.077, 0.154], [0.097, 0.095], [0.117, 0.037]],
  carbon: [[0.012, 0.372], [0.038, 0.295], [0.058, 0.225], [0.084, 0.16], [0.105, 0.098], [0.128, 0.038]],
  knurl: [[0.025, 0.316], [0.065, 0.248], [0.105, 0.19], [0.146, 0.135], [0.188, 0.083], [0.229, 0.032]],
};

/** The lightness range a texture gives a base of lightness `l` (0..1): { down, up } in L units. */
export function textureSpread(name: Texture, l: number, strength?: number): { down: number; up: number } {
  const rows = SPREAD[name];
  const k = strength === undefined ? 1 : strength / RECIPES[name].strength;
  const x = Math.min(5, Math.max(0, (l - 0.15) / 0.15));
  const i = Math.min(4, Math.floor(x));
  const t = x - i;
  const lerp = (j: 0 | 1) => rows[i]![j]! * (1 - t) + rows[i + 1]![j]! * t;
  return { down: lerp(0) * k, up: lerp(1) * k };
}

/** The relief strength a texture uses when a skin does not set one. */
export function textureDefaultStrength(name: Texture): number {
  return RECIPES[name].strength;
}

/** Whether a string names a built-in texture. */
export function isTexture(name: unknown): name is Texture {
  return typeof name === 'string' && (textures as readonly string[]).includes(name);
}
