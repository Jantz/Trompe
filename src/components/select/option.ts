import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

let nextId = 0;

/**
 * One choice of a `tr-select` or `tr-segmented`. Its parent decides how it looks and behaves:
 *
 * - In `tr-select` it is a listbox row (role="option"). The row under the keyboard or pointer
 *   is backlit and lifts slightly; the selected row carries a check mark.
 * - In `tr-segmented` it is a mechanical key (role="radio"). The selected key stays latched
 *   down and its indicator lamp fills and lights; the others stand raised with a hollow lamp.
 *
 * The value defaults to the text content, like a native `<option>`.
 *
 * @summary Choice for tr-select (role="option") and tr-segmented (role="radio").
 * @tag tr-option
 * @role option
 *
 * @slot - Option label.
 * @slot start - Icon before the label.
 *
 * @csspart row - The row or key surface.
 * @csspart check - The check mark of the selected row (in tr-select).
 * @csspart indicator - The lamp of the key (in tr-segmented).
 * @csspart label - Wrapper around the label slot.
 *
 * @cssprop --tr-option-highlight - Backlight color of the active row. Defaults to --tr-color-accent.
 * @cssprop --tr-option-lamp-color - Lamp color of the selected key. Defaults to --tr-color-accent.
 *
 * @example <tr-select label="Fruit"><tr-option value="apple">Apple</tr-option><tr-option disabled>Durian</tr-option></tr-select>
 * @example <tr-segmented aria-label="View"><tr-option value="list">List</tr-option><tr-option value="grid">Grid</tr-option></tr-segmented>
 */
export class TrOption extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_hi: var(--tr-option-highlight, var(--tr-color-accent));
        --_lamp: var(--tr-option-lamp-color, var(--tr-color-accent));
        display: block;
        cursor: pointer;
        user-select: none;
        outline: none;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.55em;
        min-height: 2.25em;
        padding: 0.4em 0.85em 0.4em 0.55em;
        border-radius: min(calc(var(--tr-radius-md, 10px) - 4px), 0.6em);
        line-height: 1.25;
        white-space: nowrap;
        transition:
          --_tr-z var(--tr-motion-duration-press, 70ms) ease-out,
          background-color var(--tr-motion-duration-press, 70ms);
      }
      .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .check {
        flex: none;
        width: 1em;
        height: 1em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
      }
      .lamp {
        display: none;
      }
      ::slotted([slot='start']) {
        flex: none;
      }

      /* ---- listbox row (in tr-select) ---- */
      :host(:not([data-mode='segment'])) .row:not(.lit) {
        border-color: transparent;
        background: none;
        box-shadow: none;
      }
      :host(:not([data-mode='segment'])) .row.lit {
        /* backlit: the row lifts off the sheet and glows from beneath */
        --_tr-z: 1;
        --_base: color-mix(in oklch, var(--_hi) 20%, var(--_m-base));
        --_curve: 0.3;
        --_layer: radial-gradient(
          ellipse 90% 140% at 0% 50%,
          color-mix(in oklch, var(--_hi) calc(18% + var(--_r) * 22%), transparent),
          transparent 70%
        );
      }
      :host([selected]) .check {
        opacity: 1;
      }
      :host([selected]) .label {
        font-weight: var(--tr-font-weight-strong, 600);
      }

      /* ---- mechanical key (in tr-segmented) ---- */
      :host([data-mode='segment']) {
        flex: 1 1 0;
        display: flex;
        /* Keys share a narrow tray and ellipsize their labels rather than overflow it. */
        min-width: 0;
      }
      :host([data-mode='segment']) .row {
        --_tr-z: 1;
        --_curve: var(--tr-p-curve, 0.3);
        flex: 1;
        min-width: 0;
        justify-content: center;
        gap: 0.5em;
        min-height: var(--_seg-h, 2.25em);
        padding: 0 var(--_seg-pad, 0.95em);
        border-radius: var(--_seg-radius, calc(var(--tr-radius-md, 10px) - 3px));
        font-weight: var(--tr-font-weight-strong, 600);
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          background-color var(--tr-motion-duration-release, 160ms);
      }
      :host([data-mode='segment']:hover) .row {
        --_tr-z: 1.5;
      }
      :host([data-mode='segment']:active) .row,
      :host([data-mode='segment'][selected]) .row {
        --_tr-z: -1;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        background-color: color-mix(in oklch, var(--_face), var(--_sh) calc(7% - var(--_r) * 4%));
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      :host([data-mode='segment']) .check {
        display: none;
      }
      :host([data-mode='segment']) .lamp {
        display: block;
        flex: none;
        width: 0.45em;
        height: 0.45em;
        border-radius: 50%;
        /* unlit: a hollow ring, so "off" differs in shape, not only in color */
        border: 1.5px solid color-mix(in oklch, currentColor 45%, transparent);
        transition: background-color var(--tr-motion-duration-release, 160ms), box-shadow var(--tr-motion-duration-release, 160ms);
      }
      :host([data-mode='segment'][selected]) .lamp {
        border-color: color-mix(in oklch, var(--_lamp), var(--_sh) 25%);
        background: var(--_lamp);
        box-shadow:
          0 0 calc(2px + var(--_r) * 6px) var(--_lamp),
          inset 0 -1px 1px color-mix(in oklch, var(--_sh) 30%, transparent);
      }
      :host([data-mode='segment']:focus-visible) .row {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
        z-index: 1;
      }

      :host([disabled]) {
        cursor: not-allowed;
      }
      :host([disabled]) .row {
        opacity: 0.5;
      }
      @media (pointer: coarse) {
        .row {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        :host(:not([data-mode='segment'])) .row.lit {
          background: Highlight;
          color: HighlightText;
          forced-color-adjust: none;
        }
        :host([data-mode='segment'][selected]) .row {
          border-width: 3px;
        }
        :host([data-mode='segment'][selected]) .lamp {
          background: Highlight;
          forced-color-adjust: none;
        }
        :host([data-mode='segment']:focus-visible) .row {
          outline-color: Highlight;
        }
      }
    `,
  ];

  private explicitValue: string | null = null;

  /** Value submitted when this option is chosen. Defaults to the label text. */
  @property()
  get value(): string {
    return this.explicitValue ?? this.label;
  }
  set value(v: string) {
    const old = this.value;
    this.explicitValue = v;
    this.requestUpdate('value', old);
  }

  /** Text shown in the select's trigger. Defaults to the text content. */
  @property({ attribute: 'label' })
  get label(): string {
    return this.explicitLabel ?? (this.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  set label(v: string) {
    const old = this.label;
    this.explicitLabel = v;
    this.requestUpdate('label', old);
  }
  private explicitLabel: string | null = null;

  /** Makes the option unavailable: it cannot be chosen and keyboard navigation skips it. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether this is the chosen option. Managed by the parent. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Whether the option is highlighted by the keyboard or pointer (tr-select). Managed by the parent. */
  @property({ type: Boolean, reflect: true }) active = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) this.id = `tr-option-${++nextId}`;
    const segment = this.parentElement?.localName === 'tr-segmented';
    this.toggleAttribute('data-mode', false);
    if (segment) this.setAttribute('data-mode', 'segment');
    this.setAttribute('role', segment ? 'radio' : 'option');
  }

  protected override render() {
    return html`<span part="row" class="row surface ${this.active ? 'lit' : ''}">
      <svg part="check" class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 8.4l2.9 2.9 5.9-6.6" /></svg>
      <span part="indicator" class="lamp" aria-hidden="true"></span>
      <slot name="start"></slot>
      <span part="label" class="label"><slot></slot></span>
    </span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const segment = this.getAttribute('data-mode') === 'segment';
    this.aria('aria-selected', segment ? null : String(this.selected));
    this.aria('aria-checked', segment ? String(this.selected) : null);
    this.aria('aria-disabled', this.disabled ? 'true' : null);
  }
}

define('tr-option', TrOption);

declare global {
  interface HTMLElementTagNameMap {
    'tr-option': TrOption;
  }
}
