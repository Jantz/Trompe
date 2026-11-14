import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { anchorTo, byId, ensureId, type Placement } from '../menu/position.js';

let current: TrTooltip | null = null;
let lastHiddenAt = -Infinity;

/**
 * A small label plate that floats next to a control and says what it does. Inverted against the
 * page (a dark plate on light themes, a light one on dark) with crisp lettering, it rises to
 * depth 3 in the top layer. Follows the WAI-ARIA APG tooltip pattern: it shows on hover after a
 * short delay and at once on keyboard focus, hides on Escape, blur and pointer leave, and stays
 * while the pointer is over it (WCAG 1.4.13). The anchor gets aria-describedby pointing at it.
 *
 * The anchor is the element whose id is in `for`, or else the tooltip's previous element sibling.
 * Only one tooltip shows at a time; moving between anchors skips the delay.
 *
 * @summary Hover and focus description for a control (role="tooltip"), in the top layer.
 * @tag tr-tooltip
 * @role tooltip
 *
 * @slot - The tooltip text. Keep it short and non-interactive.
 *
 * @csspart plate - The floating plate.
 *
 * @cssprop --tr-tooltip-max-width - Maximum width before text wraps. Defaults to 20em.
 * @cssprop --tr-tooltip-base - Plate color. Defaults to the page ink color (an inverted plate).
 * @cssprop --tr-tooltip-ink - Text color. Defaults to the canvas color.
 * @cssprop --tr-tooltip-radius - Corner radius. Defaults to --tr-radius-sm.
 *
 * @fires open - The tooltip appeared.
 * @fires close - The tooltip disappeared.
 *
 * @example
 * <tr-button id="save" shape="circle" aria-label="Save">💾</tr-button>
 * <tr-tooltip for="save">Save (Ctrl+S)</tr-tooltip>
 * @example <tr-button>Share</tr-button><tr-tooltip placement="bottom">Copy a link to this page</tr-tooltip>
 */
export class TrTooltip extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 3;
        --_curve-default: 0.2;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        overflow: visible;
        width: max-content;
        max-width: min(var(--tr-tooltip-max-width, 20em), calc(100vw - 16px));
        font-size: 0.8125rem;
        pointer-events: auto;
        opacity: 0;
        transform: scale(0.94);
        transition:
          opacity 90ms ease-in,
          transform 90ms ease-in,
          display 90ms allow-discrete,
          overlay 90ms allow-discrete;
      }
      :host(:popover-open) {
        opacity: 1;
        transform: none;
        transition:
          opacity 140ms ease-out,
          transform 200ms var(--tr-motion-easing-spring, cubic-bezier(0.2, 0.9, 0.3, 1.2)),
          display 140ms allow-discrete,
          overlay 140ms allow-discrete;
      }
      @starting-style {
        :host(:popover-open) {
          opacity: 0;
          transform: scale(0.92);
        }
      }
      :host(:not([popover])) {
        display: none;
      }
      .plate.surface {
        /* a printed label plate: keeps the material's sheen but drops grain lines and mirror bands that fight small text */
        --_brush: 0;
        --_spin: 0;
        --_mirror: 0;
        --_rg: calc(var(--_r) * (2 - var(--_r)) * 0.5);
      }
      .plate {
        --_tr-z: var(--_depth);
        --_base: var(--tr-tooltip-base, var(--tr-color-ink));
        --_ink: var(--tr-tooltip-ink, var(--tr-color-canvas));
        --_edge: color-mix(in oklch, var(--_base), var(--tr-color-shadow) 30%);
        display: block;
        padding: 0.4em 0.7em 0.42em;
        border-radius: var(--tr-tooltip-radius, var(--tr-radius-sm, 6px));
        font-weight: 500;
        line-height: 1.35;
        letter-spacing: 0.01em;
        text-wrap: balance;
      }
      @media (prefers-reduced-motion: reduce) {
        :host,
        :host(:popover-open) {
          transform: none;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        .plate {
          background-color: oklch(from var(--_face) l c h / 1);
        }
      }
      @media (forced-colors: active) {
        .plate {
          background: Canvas;
          color: CanvasText;
        }
      }
    `,
  ];

  /** Id of the element this tooltip describes (same document or shadow root). Defaults to the previous element sibling. */
  @property({ attribute: 'for' }) htmlFor = '';

  /** Side of the anchor to appear on. Flips automatically when there is no room. */
  @property({ reflect: true }) placement: Placement = 'top';

  /** Hover delay before showing, in ms. */
  @property({ type: Number, attribute: 'show-delay' }) showDelay = 500;

  /** Delay before hiding after the pointer leaves, in ms. */
  @property({ type: Number, attribute: 'hide-delay' }) hideDelay = 120;

  /** Whether the tooltip is showing. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Stops the tooltip from showing (the description is kept). */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private anchorEl: HTMLElement | null = null;
  private timer = 0;
  private unplace: (() => void) | null = null;

  constructor() {
    super();
    this.addEventListener('pointerenter', () => this.clear());
    this.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && this.schedule(false));
  }

  /** The element this tooltip describes. */
  get anchor(): HTMLElement | null {
    return this.anchorEl;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
    this.setAttribute('role', 'tooltip');
    ensureId(this, 'tr-tooltip');
    queueMicrotask(() => this.wire());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clear();
    // The browser hides a removed popover before this runs, so hide() -> sync() would see it
    // closed already and skip the cleanup. Release everything an open tooltip holds directly.
    const wasOpen = this.open;
    this.open = false;
    this.release();
    this.unwire();
    if (wasOpen) this.dispatchEvent(new Event('close'));
  }

  protected override render() {
    return html`<span part="plate" class="plate surface"><slot></slot></span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('htmlFor') && changed.get('htmlFor') !== undefined) this.wire();
    if (changed.has('open')) this.sync();
  }

  /** Shows the tooltip now. */
  show(): void {
    this.clear();
    this.open = true;
    this.sync();
  }

  /** Hides the tooltip now. */
  hide(): void {
    this.clear();
    this.open = false;
    this.sync();
  }

  private sync(): void {
    let shown = false;
    try {
      shown = this.matches(':popover-open');
    } catch {
      /* no popover support */
    }
    if (this.open && !shown) {
      if (this.disabled || !this.isConnected) {
        this.open = false;
        return;
      }
      if (!this.anchorEl) this.wire();
      if (current && current !== this) current.hide();
      current = this;
      try {
        this.showPopover();
      } catch {
        return;
      }
      this.unplace?.();
      this.unplace = this.anchorEl ? anchorTo(this, this.anchorEl, this.placement, 8) : null;
      document.addEventListener('keydown', this.onDocKeyDown, true);
      this.dispatchEvent(new Event('open'));
    } else if (!this.open && shown) {
      try {
        this.hidePopover();
      } catch {
        /* already hidden */
      }
      this.release();
      lastHiddenAt = performance.now();
      this.dispatchEvent(new Event('close'));
    }
  }

  /** Drops what an open tooltip holds: placement, the shared `current` slot, the Escape listener. */
  private release(): void {
    this.unplace?.();
    this.unplace = null;
    if (current === this) current = null;
    document.removeEventListener('keydown', this.onDocKeyDown, true);
  }

  private clear(): void {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  private schedule(show: boolean): void {
    this.clear();
    if (show === this.open) return;
    // Moving straight from one tooltip to the next skips the delay.
    const warm = !!current || performance.now() - lastHiddenAt < 400;
    const delay = show ? (warm ? 0 : this.showDelay) : this.hideDelay;
    if (delay <= 0) {
      if (show) this.show();
      else this.hide();
      return;
    }
    this.timer = window.setTimeout(() => (show ? this.show() : this.hide()), delay);
  }

  private wire(): void {
    this.unwire();
    const a = byId(this, this.htmlFor) ?? (this.previousElementSibling as HTMLElement | null);
    if (!a) return;
    this.anchorEl = a;
    const ids = (a.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(this.id)) a.setAttribute('aria-describedby', [...ids, this.id].join(' '));
    a.addEventListener('pointerenter', this.onEnter);
    a.addEventListener('pointerleave', this.onLeave);
    a.addEventListener('pointerdown', this.onDown);
    a.addEventListener('focusin', this.onFocusIn);
    a.addEventListener('focusout', this.onFocusOut);
  }

  private unwire(): void {
    const a = this.anchorEl;
    if (!a) return;
    const ids = (a.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== this.id);
    if (ids.length) a.setAttribute('aria-describedby', ids.join(' '));
    else a.removeAttribute('aria-describedby');
    a.removeEventListener('pointerenter', this.onEnter);
    a.removeEventListener('pointerleave', this.onLeave);
    a.removeEventListener('pointerdown', this.onDown);
    a.removeEventListener('focusin', this.onFocusIn);
    a.removeEventListener('focusout', this.onFocusOut);
    this.anchorEl = null;
  }

  private onEnter = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' && !this.disabled) this.schedule(true);
  };

  private onLeave = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') this.schedule(false);
  };

  private onDown = (): void => this.hide();

  private onFocusIn = (e: FocusEvent): void => {
    if (this.disabled) return;
    const el = e.composedPath()[0];
    let visible = true;
    try {
      visible = el instanceof Element && el.matches(':focus-visible');
    } catch {
      /* old engines: show on any focus */
    }
    if (visible) this.show();
  };

  private onFocusOut = (): void => this.hide();

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.open) return;
    // Dismiss only the tooltip: do not let the same Escape close a dialog or menu behind it.
    e.preventDefault();
    e.stopPropagation();
    this.hide();
  };
}

define('tr-tooltip', TrTooltip);

declare global {
  interface HTMLElementTagNameMap {
    'tr-tooltip': TrTooltip;
  }
}
