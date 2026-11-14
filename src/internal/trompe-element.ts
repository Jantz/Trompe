import { LitElement, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { globalCss, type Depth, type Finish, type Material, type Profile, type Realism } from '../generated/tokens.js';
import { hostStyles, surfaceStyles, focusStyles } from '../styles/surface.js';
import { autoViewTransitions, isReplayingLook, notePainted } from '../interaction/smooth.js';
import { reducedMotion } from '../interaction/motion.js';

/**
 * data-tr-motion="reduce" on an ancestor must calm CSS motion inside shadow roots too, where an
 * ancestor selector cannot reach. Each Trompe element mirrors it as data-tr-reduced on itself
 * (hostStyles then drops its transitions and animations), and one observer keeps every
 * connected element in step when the attribute changes.
 */
const connected = new Set<HTMLElement>();
let motionWatch: MutationObserver | null = null;
function syncReduced(el: HTMLElement): void {
  el.toggleAttribute('data-tr-reduced', reducedMotion(el) && !matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Page-level motion: the light and realism glide to new values instead of jumping, and page-wide
 * look changes (theme, skin, material) cross-fade as View Transitions (see interaction/smooth.ts).
 */
const motionCss = `
:where(:root) {
  transition:
    --tr-light-angle var(--tr-motion-duration-lift, 240ms) ease-out,
    --tr-light-elevation var(--tr-motion-duration-lift, 240ms) ease-out,
    --tr-realism var(--tr-motion-duration-lift, 240ms) ease-out;
}
::view-transition-group(*),
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: var(--tr-motion-duration-lift, 240ms);
  animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1);
}
:root[data-tr-vt-reduced]::view-transition-group(*),
:root[data-tr-vt-reduced]::view-transition-old(*),
:root[data-tr-vt-reduced]::view-transition-new(*) {
  animation-duration: 120ms;
}
@media (prefers-reduced-motion: reduce) {
  :where(:root) { transition: none; }
}
`;

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
      // Resolved on each host (sibling-index() is per element), so textures start at a different spot.
      { name: '--_tr-tex-i', syntax: '<integer>', inherits: true, initialValue: '0' },
      { name: '--tr-light-elevation', syntax: '<angle>', inherits: true, initialValue: '55deg' },
      { name: '--tr-realism', syntax: '<number>', inherits: true, initialValue: '0.65' },
      // Internal: the current depth level of a surface. Registered so press/hover animate smoothly.
      { name: '--_tr-z', syntax: '<number>', inherits: false, initialValue: '0' },
      // Internal: a switch slot's inner glow when on. Registered so it fades with the throw.
      { name: '--_on-glow', syntax: '<number>', inherits: false, initialValue: '0' },
      // Internal: how selected a row's plate is (0..1). Registered so the selected tint fades.
      { name: '--_sel', syntax: '<number>', inherits: false, initialValue: '0' },
      // Internal: progress fraction (tr-progress), meter level (tr-meter) and fill colour
      // (tr-progress, tr-slider). Registered so value and tone changes animate.
      { name: '--_pv', syntax: '<number>', inherits: true, initialValue: '0' },
      { name: '--_mv', syntax: '<number>', inherits: true, initialValue: '0' },
      { name: '--_fill', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      // Internal: badge tone colours. Registered so tone changes fade.
      { name: '--_tone', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      { name: '--_tone-ink', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      { name: '--_eb', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      { name: '--_ei', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      { name: '--_ee', syntax: '<color>', inherits: true, initialValue: 'transparent' },
      // Internal: an avatar's status lamp colour. Registered so status changes fade.
      { name: '--_lamp', syntax: '<color>', inherits: false, initialValue: 'transparent' },
    ];
    // A surface texture belongs to the element it is set on: a wood panel must not turn every
    // control inside it into wood. Universal syntax, so it takes no initial value.
    try {
      CSS.registerProperty({ name: '--tr-m-texture', syntax: '*', inherits: false });
    } catch {
      /* already registered */
    }
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
    sheet.replaceSync(globalCss + motionCss);
    doc.adoptedStyleSheets = [sheet, ...doc.adoptedStyleSheets];
  } catch {
    const style = doc.createElement('style');
    style.dataset.trompe = 'tokens';
    style.textContent = globalCss + motionCss;
    doc.head.prepend(style);
  }
  autoViewTransitions(doc);
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

  /** Look attributes replayed for a View Transition must not overwrite the property that was set. */
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (isReplayingLook()) return;
    super.attributeChangedCallback(name, old, value);
  }

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

  override connectedCallback(): void {
    super.connectedCallback();
    connected.add(this);
    syncReduced(this);
    if (!motionWatch && typeof MutationObserver !== 'undefined') {
      motionWatch = new MutationObserver(() => connected.forEach(syncReduced));
      motionWatch.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-tr-motion'] });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    connected.delete(this);
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => notePainted(this));
  }

  /**
   * Sets (or removes, for null) an ARIA attribute on the host. Real attributes rather than
   * ElementInternals reflection, so every assistive technology and test tool sees them.
   */
  protected aria(name: `aria-${string}`, value: string | null): void {
    if (value === null) this.removeAttribute(name);
    else if (this.getAttribute(name) !== value) this.setAttribute(name, value);
  }
}
