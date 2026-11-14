import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Orientation, Size } from '../../internal/types.js';

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex], [contenteditable=""], [contenteditable="true"]';
const TEXT_INPUT = /^(text|search|email|url|tel|password|number|date|time|datetime-local|month|week)$/;

/**
 * A strip that groups controls, following the WAI-ARIA APG toolbar pattern: the whole toolbar is
 * one Tab stop, and arrow keys (Left/Right, or Up/Down when vertical) move focus between its
 * controls, with Home/End jumping to the ends. Focus is remembered when you leave and come back.
 * Text fields keep their arrow keys for the caret, and controls that handle arrows themselves
 * (a slider, a segmented control) keep them too.
 *
 * Looks: `tray` (default) is a recessed tray the controls sit in, `bar` is a raised strip, and
 * `flush` has no surface of its own. Slot an `<hr>` or `role="separator"` element for an engraved
 * divider between groups.
 *
 * @summary Toolbar (APG) with roving focus across its controls.
 * @tag tr-toolbar
 * @role toolbar
 *
 * @slot - Controls: tr-button, tr-segmented, tr-input, native buttons, separators.
 *
 * @csspart strip - The toolbar surface.
 *
 * @cssprop --tr-toolbar-gap - Space between controls. Defaults to 0.375em.
 * @cssprop --tr-toolbar-padding - Inner padding. Defaults to 0.375em.
 * @cssprop --tr-toolbar-radius - Corner radius. Defaults to --tr-radius-md plus the padding.
 *
 * @example <tr-toolbar label="Formatting"><tr-button toggle aria-label="Bold">B</tr-button><tr-button toggle aria-label="Italic">I</tr-button><hr><tr-button>Share</tr-button></tr-toolbar>
 * @example <tr-toolbar variant="bar" orientation="vertical" label="Tools">…</tr-toolbar>
 */
export class TrToolbar extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_gap: var(--tr-toolbar-gap, 0.375em);
        --_pad: var(--tr-toolbar-padding, 0.375em);
        display: flex;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .strip {
        display: flex;
        /* a broad content surface: tame clear-coat and mirror reflections so text stays legible */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        flex-wrap: wrap;
        align-items: center;
        gap: var(--_gap);
        flex: 1;
        min-width: 0;
        padding: var(--_pad);
        border-radius: var(--tr-toolbar-radius, calc(var(--tr-radius-md, 10px) + var(--_pad)));
      }
      :host([variant='tray']) .strip {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) calc(6% + var(--tr-lift, 0) * 10%));
      }
      :host([variant='bar']) .strip {
        --_tr-z: 1;
      }
      :host([variant='flush']) .strip {
        background: none;
        border-color: transparent;
        box-shadow: none;
        padding: 0;
      }
      :host([variant='flush']) .strip::before {
        display: none;
      }
      :host([orientation='vertical']) {
        display: inline-flex;
      }
      :host([orientation='vertical']) .strip {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      /* an engraved divider: a cut with the light catching its far wall */
      ::slotted(hr),
      ::slotted([role='separator']) {
        align-self: stretch;
        flex: none;
        width: 0;
        height: auto;
        margin: 0.2em calc(var(--_gap) * 0.5);
        border: 0;
        border-inline-start: 1px solid color-mix(in oklch, var(--_sh, #000) calc(18% + var(--_r) * 20%), transparent);
        border-inline-end: 1px solid color-mix(in oklch, var(--_hl, #fff) calc(var(--_r) * 55%), transparent);
      }
      :host([orientation='vertical']) ::slotted(hr),
      :host([orientation='vertical']) ::slotted([role='separator']) {
        width: auto;
        height: 0;
        margin: calc(var(--_gap) * 0.5) 0.2em;
        border-inline: 0;
        border-top: 1px solid color-mix(in oklch, var(--_sh, #000) calc(18% + var(--_r) * 20%), transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--_hl, #fff) calc(var(--_r) * 55%), transparent);
      }
      ::slotted(tr-input) {
        flex: 1 1 10em;
        min-width: 8em;
      }
      :host([orientation='vertical']) ::slotted(tr-input) {
        flex: none;
      }
      ::slotted([data-tr-spacer]) {
        flex: 1;
      }
      @media (forced-colors: active) {
        ::slotted(hr) {
          border-color: CanvasText;
        }
      }
    `,
  ];

  /** Accessible name of the toolbar. */
  @property() label = '';

  /** Layout direction; also decides which arrow keys move focus. */
  @property({ reflect: true }) orientation: Orientation = 'horizontal';

  /** Surface: recessed tray, raised bar, or none. */
  @property({ reflect: true }) variant: 'tray' | 'bar' | 'flush' = 'tray';

  /** Scales the toolbar's contents. */
  @property({ reflect: true }) size: Size = 'md';

  private current: HTMLElement | null = null;
  private observer?: MutationObserver;

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('focusin', this.onFocusIn);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'toolbar');
    this.observer = new MutationObserver(() => this.syncTabStops());
    this.observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'aria-disabled'] });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  protected override render() {
    return html`<div part="strip" class="strip surface"><slot @slotchange=${this.syncTabStops}></slot></div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-orientation', this.orientation === 'vertical' ? 'vertical' : null);
    if (this.label) this.aria('aria-label', this.label);
  }

  /** The controls focus moves between, in order. Disabled controls are skipped. */
  get items(): HTMLElement[] {
    return [...this.children].filter((el): el is HTMLElement => {
      if (!(el instanceof HTMLElement) || el.hidden) return false;
      if (el.matches('hr, [role="separator"]')) return false;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
      // Trompe controls and anything natively focusable count as one stop each
      return el.localName.startsWith('tr-') || el.matches(FOCUSABLE);
    });
  }

  private syncTabStops = (): void => {
    const items = this.items;
    if (!items.length) return;
    if (!this.current || !items.includes(this.current)) this.current = items[0]!;
    for (const el of items) el.setAttribute('tabindex', el === this.current ? '0' : '-1');
  };

  private itemOf(target: EventTarget | null): HTMLElement | undefined {
    const items = this.items;
    let node = target as Node | null;
    while (node && node !== this) {
      if (items.includes(node as HTMLElement)) return node as HTMLElement;
      node = node.parentNode ?? (node as ShadowRoot).host ?? null;
    }
    return undefined;
  }

  private onFocusIn = (e: FocusEvent): void => {
    const item = this.itemOf(e.target);
    if (!item || item === this.current) return;
    this.current = item;
    this.syncTabStops();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const vertical = this.orientation === 'vertical';
    const rtl = getComputedStyle(this).direction === 'rtl';
    const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const prev = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
    if (![next, prev, 'Home', 'End'].includes(e.key)) return;
    // text entry keeps its caret keys
    const origin = e.composedPath()[0] as HTMLElement;
    if (origin instanceof HTMLTextAreaElement || origin?.isContentEditable) return;
    if (origin instanceof HTMLInputElement && TEXT_INPUT.test(origin.type)) return;
    // widgets that use the arrows on this axis themselves
    const role = origin?.getAttribute?.('role') ?? '';
    if (/^(slider|spinbutton|radio|tab|option|menuitem\w*)$/.test(role) && e.key !== 'Home' && e.key !== 'End') return;
    const items = this.items;
    const item = this.itemOf(e.target);
    if (!item) return;
    const i = items.indexOf(item);
    let target: HTMLElement | undefined;
    if (e.key === next) target = items[Math.min(items.length - 1, i + 1)];
    else if (e.key === prev) target = items[Math.max(0, i - 1)];
    else if (e.key === 'Home') target = items[0];
    else target = items[items.length - 1];
    e.preventDefault();
    if (!target || target === item) return;
    this.current = target;
    this.syncTabStops();
    target.focus();
  };
}

define('tr-toolbar', TrToolbar);

declare global {
  interface HTMLElementTagNameMap {
    'tr-toolbar': TrToolbar;
  }
}
