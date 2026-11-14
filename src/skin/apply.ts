/**
 * Runtime skins: apply a skin object to a document or shadow root without a build step, and
 * update it live (Trompe's components install the token stylesheet themselves). Useful for user-chosen themes, white-labelling and editors like the Studio.
 */
import { compileSkin, type CompileOptions } from './compile.js';
import type { Skin } from './types.js';

export interface AppliedSkin {
  /** Recompiles and swaps the CSS in place. Cheap enough to call on every slider input. */
  update(skin: Skin): void;
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
export function applySkin(skin: Skin, options: CompileOptions & { root?: Document | ShadowRoot } = {}): AppliedSkin {
  const root = options.root ?? document;
  const sheet = new CSSStyleSheet();
  let css = compileSkin(skin, options);
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return {
    update(next: Skin) {
      const nextCss = compileSkin(next, options);
      if (nextCss === css) return;
      css = nextCss;
      sheet.replaceSync(css);
    },
    get css() {
      return css;
    },
    remove() {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet);
    },
  };
}
