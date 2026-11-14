/**
 * Tiny vector glyph renderers for tr-display: 7-segment, 14-segment (starburst) and 5x8 dot
 * matrix. Each produces SVG path data for a whole line of text, so a display is two path
 * elements (unlit "ghost" cells and lit glyphs) however many characters it shows.
 */

export type SegmentFont = '7seg' | '14seg';

/** One character cell of a segment display. */
export interface Cell {
  ch: string;
  dp: boolean;
  colon: boolean;
}

const n = (v: number) => Math.round(v * 100) / 100;

function poly(points: Array<[number, number]>, dx: number): string {
  return 'M' + points.map(([x, y]) => `${n(x + dx)} ${n(y)}`).join('L') + 'Z';
}

function hseg(x1: number, x2: number, y: number, t: number): Array<[number, number]> {
  const h = t / 2;
  return [
    [x1, y],
    [x1 + h, y - h],
    [x2 - h, y - h],
    [x2, y],
    [x2 - h, y + h],
    [x1 + h, y + h],
  ];
}

function vseg(x: number, y1: number, y2: number, t: number): Array<[number, number]> {
  const h = t / 2;
  return [
    [x, y1],
    [x + h, y1 + h],
    [x + h, y2 - h],
    [x, y2],
    [x - h, y2 - h],
    [x - h, y1 + h],
  ];
}

function dot(cx: number, cy: number, r: number, dx: number): string {
  const x = n(cx + dx - r);
  return `M${x} ${n(cy)}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0Z`;
}

interface FontGeometry {
  advance: number;
  colonAdvance: number;
  height: number;
  segs: Record<string, Array<[number, number]>>;
  dp: [number, number, number];
  colon: [number, number, number, number];
  map: Record<string, string>;
}

// 7-segment: centre lines at x 2/10, y 2/10/18.
const G7 = (() => {
  const L = 2, R = 10, T = 2, M = 10, B = 18, t = 2.3, g = 0.32;
  return {
    advance: 14,
    colonAdvance: 6,
    height: 20,
    segs: {
      a: hseg(L + g, R - g, T, t),
      b: vseg(R, T + g, M - g, t),
      c: vseg(R, M + g, B - g, t),
      d: hseg(L + g, R - g, B, t),
      e: vseg(L, M + g, B - g, t),
      f: vseg(L, T + g, M - g, t),
      g: hseg(L + g, R - g, M, t),
    },
    dp: [R + 2.5, B + 0.2, 1.2],
    colon: [3, 7, 13, 1.2],
    map: {
      '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc',
      '8': 'abcdefg', '9': 'abcdfg', A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg',
      G: 'acdef', H: 'bcefg', I: 'ef', J: 'bcde', K: 'befg', L: 'def', M: 'aceg', N: 'ceg', O: 'abcdef', P: 'abefg',
      Q: 'abcfg', R: 'eg', S: 'acdfg', T: 'defg', U: 'bcdef', V: 'cde', W: 'bdf', X: 'bcefg', Y: 'bcdfg', Z: 'abdeg',
      c: 'deg', h: 'cefg', o: 'cdeg', u: 'cde', i: 'e', '-': 'g', _: 'd', '=': 'dg', '°': 'abfg', '"': 'bf', "'": 'b',
      '[': 'adef', ']': 'abcd', '(': 'adef', ')': 'abcd', '?': 'abeg', '!': 'bc',
    },
  } satisfies FontGeometry;
})();

// 14-segment starburst: centre lines at x 2/7/12, y 2/10/18.
const G14 = (() => {
  const L = 2, C = 7, R = 12, T = 2, M = 10, B = 18, t = 1.8, g = 0.3;
  const x0 = L + t / 2 + g, x1 = C - t / 2 - g, y0 = T + t / 2 + g, y1 = M - t / 2 - g;
  const dw = 1.05, dh = 1.7;
  const tl: Array<[number, number]> = [
    [x0, y0],
    [x0 + dw, y0],
    [x1, y1 - dh],
    [x1, y1],
    [x1 - dw, y1],
    [x0, y0 + dh],
  ];
  const mx = (p: Array<[number, number]>) => p.map(([x, y]) => [2 * C - x, y] as [number, number]);
  const my = (p: Array<[number, number]>) => p.map(([x, y]) => [x, 2 * M - y] as [number, number]);
  return {
    advance: 16,
    colonAdvance: 6,
    height: 20,
    segs: {
      a: hseg(L + g, R - g, T, t),
      b: vseg(R, T + g, M - g, t),
      c: vseg(R, M + g, B - g, t),
      d: hseg(L + g, R - g, B, t),
      e: vseg(L, M + g, B - g, t),
      f: vseg(L, T + g, M - g, t),
      g1: hseg(L + g, C - g, M, t),
      g2: hseg(C + g, R - g, M, t),
      tc: vseg(C, T + g, M - g, t),
      bc: vseg(C, M + g, B - g, t),
      tl,
      tr: mx(tl),
      bl: my(tl),
      br: mx(my(tl)),
    },
    dp: [R + 2.3, B + 0.2, 1.1],
    colon: [3, 7, 13, 1.1],
    map: {
      '0': 'a b c d e f tr bl', '1': 'b c tr', '2': 'a b d e g1 g2', '3': 'a b c d g2', '4': 'b c f g1 g2',
      '5': 'a c d f g1 g2', '6': 'a c d e f g1 g2', '7': 'a b c', '8': 'a b c d e f g1 g2', '9': 'a b c d f g1 g2',
      A: 'a b c e f g1 g2', B: 'a b c d g2 tc bc', C: 'a d e f', D: 'a b c d tc bc', E: 'a d e f g1 g2',
      F: 'a e f g1', G: 'a c d e f g2', H: 'b c e f g1 g2', I: 'a d tc bc', J: 'b c d e', K: 'e f g1 tr br',
      L: 'd e f', M: 'b c e f tl tr', N: 'b c e f tl br', O: 'a b c d e f', P: 'a b e f g1 g2',
      Q: 'a b c d e f br', R: 'a b e f g1 g2 br', S: 'a c d f g1 g2', T: 'a tc bc', U: 'b c d e f',
      V: 'e f bl tr', W: 'b c e f bl br', X: 'tl tr bl br', Y: 'tl tr bc', Z: 'a d tr bl',
      '-': 'g1 g2', '+': 'g1 g2 tc bc', '*': 'g1 g2 tl tc tr bl bc br', '/': 'tr bl', '\\': 'tl br', _: 'd',
      '=': 'd g1 g2', '<': 'tr br', '>': 'tl bl', '(': 'tr br', ')': 'tl bl', '[': 'a d e f', ']': 'a b c d',
      "'": 'tc', '"': 'f tc', '°': 'a b f g1 g2', '?': 'a b g2 bc', '!': 'b c', '#': 'b c d g1 g2 tc bc',
      $: 'a c d f g1 g2 tc bc', '%': 'c f g1 g2 tr bl', '@': 'a b d e f g2 tc', '|': 'tc bc', '&': 'a d e g1 tl tr br',
    },
  } satisfies FontGeometry;
})();

const FONTS: Record<SegmentFont, FontGeometry> = { '7seg': G7, '14seg': G14 };

/** Splits text into segment cells: "." and "," become the previous cell's decimal point. */
export function toCells(text: string): Cell[] {
  const cells: Cell[] = [];
  for (const ch of text) {
    const last = cells[cells.length - 1];
    if ((ch === '.' || ch === ',') && last && !last.colon && !last.dp) {
      last.dp = true;
      continue;
    }
    if (ch === ':') cells.push({ ch, dp: false, colon: true });
    else cells.push({ ch: ch === '.' || ch === ',' ? ' ' : ch, dp: ch === '.' || ch === ',', colon: false });
  }
  return cells;
}

export const blankCell = (): Cell => ({ ch: ' ', dp: false, colon: false });

/** Path data for a line of segment cells. Returns the unlit (ghost) and lit paths and the viewBox width. */
export function segmentPaths(cells: Cell[], font: SegmentFont): { ghost: string; lit: string; width: number; height: number } {
  const f = FONTS[font];
  let x = 0;
  let ghost = '';
  let lit = '';
  for (const cell of cells) {
    if (cell.colon) {
      const [cx, y1, y2, r] = f.colon;
      lit += dot(cx, y1, r, x) + dot(cx, y2, r, x);
      x += f.colonAdvance;
      continue;
    }
    const on = new Set((f.map[cell.ch] ?? f.map[cell.ch.toUpperCase()] ?? '').split(font === '7seg' ? '' : ' '));
    for (const [name, pts] of Object.entries(f.segs)) {
      const d = poly(pts, x);
      if (on.has(name)) lit += d;
      else ghost += d;
    }
    const [cx, cy, r] = f.dp;
    if (cell.dp) lit += dot(cx, cy, r, x);
    else ghost += dot(cx, cy, r, x);
    x += f.advance;
  }
  return { ghost, lit, width: x, height: f.height };
}

// 5x8 dot-matrix font, ASCII 32-126: five column bytes per glyph, bit 0 = top row, bit 7 = descender.
const MATRIX =
  '0000000000' + '00005f0000' + '0007000700' + '147f147f14' + '242a7f2a12' + '2313086462' + '3649562050' + '0008070300' +
  '001c224100' + '0041221c00' + '2a1c7f1c2a' + '08083e0808' + '0080703000' + '0808080808' + '0000606000' + '2010080402' +
  '3e5149453e' + '00427f4000' + '7249494946' + '2141494d33' + '1814127f10' + '2745454539' + '3c4a494931' + '4121110907' +
  '3649494936' + '464949291e' + '0000140000' + '0040340000' + '0008142241' + '1414141414' + '0041221408' + '0201590906' +
  '3e415d594e' + '7c1211127c' + '7f49494936' + '3e41414122' + '7f4141413e' + '7f49494941' + '7f09090901' + '3e41415173' +
  '7f0808087f' + '00417f4100' + '2040413f01' + '7f08142241' + '7f40404040' + '7f021c027f' + '7f0408107f' + '3e4141413e' +
  '7f09090906' + '3e4151215e' + '7f09192946' + '2649494932' + '03017f0103' + '3f4040403f' + '1f2040201f' + '3f4038403f' +
  '6314081463' + '0304780403' + '6159494d43' + '007f414141' + '0204081020' + '004141417f' + '0402010204' + '4040404040' +
  '0003070800' + '2054547840' + '7f28444438' + '3844444428' + '384444287f' + '3854545418' + '00087e0902' + '18a4a49c78' +
  '7f08040478' + '00447d4000' + '2040403d00' + '7f10284400' + '00417f4000' + '7c04780478' + '7c08040478' + '3844444438' +
  'fc18242418' + '18242418fc' + '7c08040408' + '4854545424' + '04043f4424' + '3c4040207c' + '1c2040201c' + '3c4030403c' +
  '4428102844' + '4c9090907c' + '4464544c44' + '0008364100' + '0000770000' + '0041360800' + '0201020402';

function matrixColumns(ch: string): number[] {
  let code = ch.charCodeAt(0);
  if (ch === '°') return [0x00, 0x06, 0x09, 0x09, 0x06];
  if (code < 32 || code > 126) code = 63; // "?"
  const hex = MATRIX.slice((code - 32) * 10, (code - 32) * 10 + 10);
  return [0, 2, 4, 6, 8].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Path data for a line of 5x8 matrix characters, one zero-length subpath per dot (drawn with a
 * round or square stroke cap). Cells advance 6 columns: 5 dots and a gap.
 */
export function matrixPaths(text: string, withGhost: boolean): { ghost: string; lit: string; width: number; height: number } {
  let lit = '';
  let ghost = '';
  let x = 0;
  for (const ch of text) {
    const cols = matrixColumns(ch);
    for (let c = 0; c < 5; c++) {
      const bits = cols[c]!;
      for (let r = 0; r < 8; r++) {
        const d = `M${x + c + 0.5} ${r + 0.5}h0`;
        if (bits & (1 << r)) lit += d;
        else if (withGhost) ghost += d;
      }
    }
    x += 6;
  }
  return { ghost, lit, width: Math.max(1, x - 1), height: 8 };
}
