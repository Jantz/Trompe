import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { globalCss, type Depth, type Finish, type Material, type Profile, type Realism } from '../generated/tokens.js';
import { hostStyles, surfaceStyles, focusStyles } from '../styles/surface.js';

let installed = false;

/**
 * Installs Trompe's global token stylesheet into the document once, and registers the animatable
 * custom properties. Called automatically when any Trompe element is defined. Safe to call again.
 * Uses :where() everywhere, so any rule you write overrides it.
 */
export function installGlobalStyles(doc: Document | undefined = globalThis.document): void {
  if (installed || !doc) return;
  installed = true;
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    const props: PropertyDefinition[] = [
      { name: '--tr-light-angle', syntax: '<angle>', inherits: true, initialValue: '330deg' },
      { name: '--tr-light-elevation', syntax: '<angle>', inherits: true, initialValue: '55deg' },
      { name: '--tr-realism', syntax: '<number>', inherits: true, initialValue: '0.65' },
      // Internal: the current depth level of a surface. Registered so press/hover animate smoothly.
      { name: '--_tr-z', syntax: '<number>', inherits: false, initialValue: '0' },
    ];
    for (const p of props) {
      try {
        CSS.registerProperty(p);
      } catch {
        /* already registered (e.g. two copies of Trompe): fine */
      }
    }
  }
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(globalCss);
    doc.adoptedStyleSheets = [sheet, ...doc.adoptedStyleSheets];
  } catch {
    const style = doc.createElement('style');
    style.dataset.trompe = 'tokens';
    style.textContent = globalCss;
    doc.head.prepend(style);
  }
}

/**
 * Defines a custom element if the tag is not taken yet. Lets several bundles include Trompe.
 */
export function define(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return;
  installGlobalStyles();
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/**
 * Base class of every Trompe element: shared material, depth and realism attributes.
 */
export class TrompeElement extends LitElement {
  static override styles = [hostStyles, surfaceStyles, focusStyles];

  /**
   * Physical material of the element's surface. Unset = inherit from the nearest
   * ancestor with data-tr-material, otherwise plastic.
   */
  @property({ reflect: true }) material?: Material;

  /**
   * How the surface reflects light, overriding the material's own finish:
   * matte, satin, gloss (clear-coat), mirror (chrome), brushed, spun.
   */
  @property({ reflect: true }) finish?: Finish;

  /**
   * Cross-section of the surface: flat, convex, concave (dished), dome (spherical) or bevel
   * (chamfered edge). Unset = the component's natural shape, or data-tr-profile on an ancestor.
   */
  @property({ reflect: true }) profile?: Profile;

  /**
   * Realism preset for this element and its children. Unset = inherit
   * (--tr-realism, default "tactile").
   */
  @property({ reflect: true }) realism?: Realism;

  /**
   * Resting depth level, -2 (well) to 4 (overlay). Each component has its own default.
   */
  @property({ type: Number, reflect: true }) depth?: Depth;

  /**
   * Sets (or removes, for null) an ARIA attribute on the host. Real attributes rather than
   * ElementInternals reflection, so every assistive technology and test tool sees them.
   */
  protected aria(name: `aria-${string}`, value: string | null): void {
    if (value === null) this.removeAttribute(name);
    else if (this.getAttribute(name) !== value) this.setAttribute(name, value);
  }
}
