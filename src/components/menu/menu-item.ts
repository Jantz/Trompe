import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/**
 * One command in a `tr-menu`. At rest it is an engraved legend on the menu plate; when it is
 * highlighted (pointer or keyboard) it rises into a backlit key: the cap lifts off the plate, its
 * face lights from within and light spills onto the plate around it. Checkable items show a check
 * mark or a lit dot in a small recessed well, so state never relies on color.
 *
 * @summary Menu command, checkbox or radio item, or separator, for use inside tr-menu.
 * @tag tr-menu-item
 * @role menuitem
 *
 * @slot - Item label. Also the accessible name and the typeahead text.
 * @slot start - Icon before the label.
 * @slot end - Content after the label, such as a keyboard shortcut. Defaults to `shortcut`.
 * @slot submenu - A nested tr-menu, opened with ArrowRight, Enter, Space or a click.
 *
 * @csspart key - The item surface that rises when highlighted.
 * @csspart indicator - Recessed well holding the check mark or radio dot.
 * @csspart label - Wrapper around the label slot.
 * @csspart shortcut - The `shortcut` text.
 * @csspart chevron - Arrow shown when the item has a submenu.
 * @csspart separator - The engraved groove drawn when `separator` is set.
 *
 * @cssprop --tr-menu-item-highlight - Face color of the highlighted key. Defaults to --tr-color-accent.
 * @cssprop --tr-menu-item-highlight-ink - Legend color of the highlighted key. Defaults to --tr-color-accent-ink.
 * @cssprop --tr-menu-item-padding - Item padding. Defaults to 0.5em 0.75em.
 * @cssprop --tr-menu-item-radius - Corner radius of the key. Defaults to --tr-radius-sm.
 *
 * @fires select - Bubbles from the item when it is activated. `detail: { value, item, checked }`. Cancel it to keep the menu open.
 *
 * @example <tr-menu-item value="copy" shortcut="Ctrl+C">Copy</tr-menu-item>
 * @example <tr-menu-item type="checkbox" checked>Show grid</tr-menu-item>
 * @example <tr-menu-item type="radio" name="zoom" value="100" checked>100%</tr-menu-item>
 * @example <tr-menu-item separator></tr-menu-item>
 */
export class TrMenuItem extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 0;
        --_curve-default: 0.3;
        --_hi: var(--tr-menu-item-highlight, var(--tr-color-accent));
        --_hi-ink: var(--tr-menu-item-highlight-ink, var(--tr-color-accent-ink));
        display: block;
        position: relative;
        outline: none;
        cursor: default;
        user-select: none;
        -webkit-user-select: none;
        /* inherits the plate's legend color from tr-menu */
        color: inherit;
      }
      :host([separator]) {
        padding: 0.3em 0.4em;
      }
      .groove {
        display: block;
        height: 0;
        border-top: 1px solid color-mix(in oklch, var(--tr-color-shadow) calc(18% + var(--_r) * 22%), transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--tr-color-highlight, #fff) calc(var(--_r) * 55%), transparent);
      }
      .glow {
        position: absolute;
        inset: 2px 4px;
        border-radius: var(--tr-menu-item-radius, var(--tr-radius-sm, 6px));
        background: var(--_hi);
        filter: blur(calc(4px + var(--_r) * 6px));
        opacity: 0;
        transition: opacity var(--tr-motion-duration-release, 160ms);
        pointer-events: none;
      }
      .key {
        --_tr-z: 0;
        --_base: transparent;
        --_ink: currentColor;
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-height: 2.25em;
        padding: var(--tr-menu-item-padding, 0.45em 0.75em);
        border-radius: var(--tr-menu-item-radius, var(--tr-radius-sm, 6px));
        line-height: 1.25;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      /* at rest the item is only a legend on the plate: no cap, no rim, no shadow */
      :host(:not(:focus):not([data-expanded])) .key,
      :host([disabled]) .key {
        background: none;
        border-color: transparent;
        box-shadow: none;
        text-shadow: none;
        backdrop-filter: none;
      }
      :host(:not(:focus):not([data-expanded])) .key::before,
      :host([disabled]) .key::before {
        display: none;
      }
      /* highlighted: the key rises and lights from inside */
      :host(:focus:not([disabled])) .key,
      :host([data-expanded]:not([disabled])) .key {
        --_tr-z: 1;
        --_base: var(--_hi);
        --_ink: var(--_hi-ink);
        --_edge: color-mix(in oklch, var(--_hi), var(--tr-color-shadow) 25%);
        /* light passing through a translucent cap, brightest under the legend */
        --_layer: radial-gradient(
          ellipse 70% 120% at 50% 110%,
          color-mix(in oklch, var(--tr-color-highlight, #fff) calc(var(--_r) * 34%), transparent),
          transparent 70%
        );
        translate: 0 calc(var(--_sy) * -0.5px);
      }
      :host(:focus:not([disabled])) .glow,
      :host([data-expanded]:not([disabled])) .glow {
        opacity: calc(var(--_r) * 0.55);
      }
      :host([disabled]) {
        opacity: 0.45;
      }
      :host([disabled]:focus) .key {
        background: color-mix(in oklch, currentColor 9%, transparent);
      }
      :host(:active:not([disabled])) .key {
        --_tr-z: -0.5;
        translate: 0 calc(var(--_sy) * 0.5px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .ind {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--tr-color-well) 70%, transparent);
        --_ink: currentColor;
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 1.05em;
        height: 1.05em;
        border-radius: 0.25em;
        text-shadow: none;
        backdrop-filter: none;
      }
      :host([type='radio']) .ind {
        border-radius: 50%;
      }
      .ind svg {
        width: 0.8em;
        height: 0.8em;
        opacity: 0;
        transform: scale(0.6);
        transition: opacity var(--tr-motion-duration-release, 160ms), transform var(--tr-motion-duration-release, 160ms);
      }
      :host([checked]) .ind svg {
        opacity: 1;
        transform: none;
      }
      .dot {
        width: 0.45em;
        height: 0.45em;
        border-radius: 50%;
        background: currentColor;
        opacity: 0;
        transform: scale(0.4);
        transition: opacity var(--tr-motion-duration-release, 160ms), transform var(--tr-motion-duration-release, 160ms);
      }
      :host([checked]) .dot {
        opacity: 1;
        transform: none;
        box-shadow: 0 0 calc(var(--_r) * 5px) currentColor;
      }
      .spacer {
        flex: none;
        width: 1.05em;
      }
      .spacer:not(.on) {
        display: none;
      }
      .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      ::slotted([slot='start']),
      ::slotted(svg) {
        flex: none;
      }
      .shortcut,
      ::slotted([slot='end']) {
        margin-inline-start: 1.5em;
        font: inherit;
        font-size: 0.85em;
        letter-spacing: 0.04em;
        opacity: 0.72;
      }
      .chevron {
        flex: none;
        width: 0.75em;
        height: 0.75em;
        margin-inline-start: 0.75em;
        opacity: 0.8;
      }
      :host(:dir(rtl)) .chevron {
        transform: scaleX(-1);
      }
      @media (pointer: coarse) {
        .key {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        :host(:focus) .key,
        :host([data-expanded]) .key {
          background: Highlight;
          color: HighlightText;
          forced-color-adjust: none;
        }
        .glow {
          display: none;
        }
        .groove {
          border-color: CanvasText;
          border-bottom: 0;
        }
      }
    `,
  ];

  /** Kind of item: a plain command, a checkbox (independent toggle) or a radio (one of a group). */
  @property({ reflect: true }) type: 'normal' | 'checkbox' | 'radio' = 'normal';

  /** Whether a checkbox or radio item is checked. Exposed as aria-checked. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Disables the item. It stays focusable (as APG recommends) but cannot be activated. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Value reported by the `select` event. Defaults to the item's text. */
  @property() value = '';

  /** Radio group name. Radio items with the same name in one menu are mutually exclusive. Without a name, a group runs between separators. */
  @property({ reflect: true }) name = '';

  /** Renders the item as a separator (role="separator", not focusable). */
  @property({ type: Boolean, reflect: true }) separator = false;

  /** Keyboard shortcut hint shown at the end of the item, for example "Ctrl+S". Display only. */
  @property() shortcut = '';

  @state() private hasSubmenu = false;
  @state() private indent = false;

  /** The item's label text, used for typeahead and as the default value. */
  get text(): string {
    let t = '';
    for (const n of this.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
      // Slotted extras and a nested submenu (even before it is given slot="submenu") are not the label.
      else if (n instanceof Element && !n.slot && n.localName !== 'tr-menu') t += n.textContent;
    }
    return t.replace(/\s+/g, ' ').trim();
  }

  /** The value the item reports: `value`, or its text. */
  get resolvedValue(): string {
    return this.value || this.text;
  }

  /** The nested submenu, if any. */
  get submenu(): HTMLElement | null {
    return this.querySelector(':scope > tr-menu');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRole();
    this.hasSubmenu = !!this.submenu;
  }

  protected override render() {
    if (this.separator) return html`<span part="separator" class="groove"></span>`;
    const checkable = this.type === 'checkbox' || this.type === 'radio';
    return html`<span class="glow" aria-hidden="true"></span>
      <span part="key" class="key surface">
        ${checkable
          ? html`<span part="indicator" class="ind surface" aria-hidden="true">
              ${this.type === 'radio'
                ? html`<span class="dot"></span>`
                : html`<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.4l2.3 2.3 4.7-5"/></svg>`}
            </span>`
          : html`<span class="spacer ${this.indent ? 'on' : ''}" aria-hidden="true"></span>`}
        <slot name="start"></slot>
        <span part="label" class="label"><slot></slot></span>
        <slot name="end">${this.shortcut ? html`<span part="shortcut" class="shortcut">${this.shortcut}</span>` : nothing}</slot>
        ${this.hasSubmenu
          ? html`<svg part="chevron" class="chevron" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>`
          : nothing}
      </span>
      <slot name="submenu" @slotchange=${this.onSubmenuChange}></slot>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('type') || changed.has('separator') || changed.has('checked') || changed.has('disabled') || changed.has('hasSubmenu')) {
      this.syncRole();
    }
  }

  /** Called by tr-menu: reserve the indicator column so labels line up with checkable siblings. */
  setIndent(on: boolean): void {
    this.indent = on;
  }

  private onSubmenuChange = (): void => {
    this.hasSubmenu = !!this.submenu;
  };

  private syncRole(): void {
    if (this.separator) {
      this.setAttribute('role', 'separator');
      this.removeAttribute('tabindex');
      this.aria('aria-checked', null);
      this.aria('aria-disabled', null);
      return;
    }
    const role = this.type === 'checkbox' ? 'menuitemcheckbox' : this.type === 'radio' ? 'menuitemradio' : 'menuitem';
    this.setAttribute('role', role);
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
    this.aria('aria-checked', this.type === 'normal' ? null : String(this.checked));
    this.aria('aria-disabled', this.disabled ? 'true' : null);
    this.aria('aria-haspopup', this.hasSubmenu ? 'menu' : null);
    if (this.hasSubmenu) {
      this.aria('aria-expanded', this.hasAttribute('data-expanded') ? 'true' : 'false');
      // A submenu's items are descendants: name the item from its own label only.
      if (!this.hasAttribute('aria-label') || this.dataset.trAutoLabel !== undefined) {
        this.setAttribute('aria-label', this.text);
        this.dataset.trAutoLabel = '';
      }
    }
  }
}

define('tr-menu-item', TrMenuItem);

declare global {
  interface HTMLElementTagNameMap {
    'tr-menu-item': TrMenuItem;
  }
}
