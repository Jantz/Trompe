/**
 * Runtime skins: apply a skin object to a document or shadow root without a build step, and
 * update it live (Trompe's components install the token stylesheet themselves). Useful for user-chosen themes, white-labelling and editors like the Studio.
 */
import { compileSkin, type CompileOptions } from './compile.js';
import type { Skin } from './types.js';

export interface AppliedSkin {
  /**
   * Recompiles and swaps the CSS in place. Cheap enough to call on every slider input. Options
   * given here apply to this compile only (e.g. textureLight while dragging the light).
   */
  update(skin: Skin, options?: Partial<CompileOptions>): void;
  /** The CSS currently applied. */
  readonly css: string;
  /** Removes the skin's stylesheet. */
  remove(): void;
}

/**
 * Compiles a skin and adopts it as a stylesheet on `root` (default: document). Elements inside a
 * container with data-tr-skin="<skin.name>" (or matching `options.scope`) take it on.
 *
 * @example
 *   const applied = applySkin(mySkin);
 *   document.body.dataset.trSkin = mySkin.name;
 *   applied.update({ ...mySkin, tokens: { ...mySkin.tokens, 'color.accent': 'oklch(60% 0.2 150)' } });
 */
export function applySkin(skin: Skin, options: CompileOptions & { root?: Document | ShadowRoot; rasterize?: boolean } = {}): AppliedSkin {
  const root = options.root ?? document;
  const sheet = new CSSStyleSheet();
  let css = compileSkin(skin, options);
  const raster = options.rasterize !== false && typeof document !== 'undefined' && typeof URL.createObjectURL === 'function';
  const install = () => sheet.replaceSync(raster ? swapTextures(css, () => install()) : css);
  install();
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return {
    update(next: Skin, once?: Partial<CompileOptions>) {
      const nextCss = compileSkin(next, once ? { ...options, ...once } : options);
      if (nextCss === css) return;
      css = nextCss;
      install();
    },
    get css() {
      return css;
    },
    remove() {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
    },
  };
}

/*
 * Textures are SVG filters (tiny, resolution-free, and lit from the skin's light), but a browser
 * re-runs the filter whenever it repaints the tile. At runtime each texture is rendered to a
 * bitmap once and the stylesheet points at that instead, so repaints (and live edits that do not
 * change the texture) cost no filter work. Until a bitmap is ready the SVG is used as is.
 */
const rasters = new Map<string, string | null>(); // svg url() -> blob url() (null: pending or failed)
let rasterOk: boolean | undefined;
const SVG_URL = /url\("data:image\/svg\+xml,[^"]*"\)/g;

function swapTextures(css: string, onReady: () => void): string {
  if (rasterOk === false) return css;
  return css.replace(SVG_URL, (m) => {
    const hit = rasters.get(m);
    if (hit) return hit;
    if (hit === undefined) {
      rasters.set(m, null);
      void rasterize(m).then((u) => {
        if (!u) return;
        rasters.set(m, u);
        onReady();
      });
    }
    return m;
  });
}

async function rasterize(cssUrl: string): Promise<string | undefined> {
  try {
    const src = cssUrl.slice(5, -2);
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(2, Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1)));
    const w = img.naturalWidth || 256;
    const h = img.naturalHeight || 256;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w * scale, h * scale);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return undefined;
    const url = URL.createObjectURL(blob);
    if (rasterOk === undefined) {
      // Some sandboxes refuse blob: images; keep the SVGs there.
      const probe = new Image();
      probe.src = url;
      rasterOk = await probe.decode().then(() => true, () => false);
    }
    return rasterOk ? `url("${url}")` : undefined;
  } catch {
    return undefined;
  }
}
