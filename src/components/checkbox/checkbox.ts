import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

/**
 * A checkbox set into the surface: an empty recessed well that, when checked, fills with a
 * raised accent key carrying an embossed check mark (or a dash when indeterminate). The key pops
 * up out of the well and the mark draws itself in, so the state reads from the glyph, not only
 * from color or depth.
 *
 * @summary Checkbox (role="checkbox") with checked, unchecked and mixed states, form-associated.
 * @tag tr-checkbox
 * @role checkbox
 *
 * @slot - Visible label. Clicking it toggles the checkbox. Also the accessible name.
 *
 * @csspart box - The recessed well.
 * @csspart key - The raised key that fills the well when checked or indeterminate.
 * @csspart mark - The check (or dash) glyph.
 * @csspart label - Wrapper around the label slot.
 *
 * @cssprop --tr-checkbox-size - Edge length of the box. Defaults to 1.25em.
 * @cssprop --tr-checkbox-radius - Corner radius of the box. Defaults to 0.3em.
 * @cssprop --tr-checkbox-on-color - Color of the key when checked. Defaults to --tr-color-accent.
 * @cssprop --tr-checkbox-mark-color - Color of the check mark. Defaults to --tr-color-accent-ink.
 *
 * @fires input - The user toggled the checkbox.
 * @fires change - The user toggled the checkbox.
 *
 * @example <tr-checkbox checked>Email me updates</tr-checkbox>
 * @example <tr-checkbox name="terms" required>I accept the terms</tr-checkbox>
 * @example <tr-checkbox indeterminate material="metal">Select all</tr-checkbox>
 */
export class TrCheckbox extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_s: var(--tr-checkbox-size, 1.25em);
        --_rad: var(--tr-checkbox-radius, 0.3em);
        --_on: var(--tr-checkbox-on-color, var(--tr-color-accent));
        display: inline-flex;
        align-items: center;
        gap: 0.65em;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        font-size: var(--tr-font-size-md, 1em);
        line-height: 1.3;
        min-height: var(--_s);
      }
      :host([size='sm']) {
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .box {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        flex: none;
        position: relative;
        width: var(--_s);
        height: var(--_s);
        border-radius: var(--_rad);
        transition: --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host(:hover) .box {
        --_tr-z: -1.4;
      }
      .key {
        --_tr-z: 1;
        --_base: var(--_on);
        --_ink: var(--tr-checkbox-mark-color, var(--tr-color-accent-ink));
        --_curve: var(--tr-p-curve, 0.45);
        --_brush: 0;
        --_spin: 0;
        position: absolute;
        inset: -1px;
        border-radius: var(--_rad);
        opacity: 0;
        scale: 0.55;
        transition:
          opacity var(--tr-motion-duration-press, 70ms),
          scale var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([checked]) .key,
      :host([indeterminate]) .key {
        opacity: 1;
        scale: 1;
      }
      :host(:active) .key {
        --_tr-z: 0;
      }
      .mark {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        overflow: visible;
        /* embossed into the key: a hairline shadow on the side away from the light */
        filter: drop-shadow(
          calc(var(--_sx) * 0.75px) calc(var(--_sy) * 0.75px) 0
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 45%), transparent)
        );
      }
      .check,
      .dash {
        stroke-dasharray: 15;
        stroke-dashoffset: 15;
        transition: stroke-dashoffset var(--tr-motion-duration-travel, 220ms) ease-out 40ms;
      }
      :host([checked]:not([indeterminate])) .check,
      :host([indeterminate]) .dash {
        stroke-dashoffset: 0;
      }
      .label:not(.has-label) {
        display: none;
      }
      :host([disabled]),
      :host(:state(disabled)) {
        cursor: not-allowed;
        opacity: 0.55;
      }
      @media (pointer: coarse) {
        :host {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        .box {
          border-color: ButtonText;
          background: Field;
        }
        .key {
          background: Highlight;
          forced-color-adjust: none;
        }
        .mark {
          color: HighlightText;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Whether the checkbox is checked. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /**
   * Shows the mixed state (a dash), e.g. for "select all" when some items are selected.
   * Exposed as aria-checked="mixed". Cleared when the user toggles the checkbox.
   */
  @property({ type: Boolean, reflect: true }) indeterminate = false;

  /** Value submitted with the form when checked. */
  @property() value = 'on';

  /** Requires the checkbox to be checked for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Size of the checkbox and its label. */
  @property({ reflect: true }) size: Size = 'md';

  private defaultChecked = false;
  private hasLabel = false;

  constructor() {
    super();
    this.role_ = 'checkbox';
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('keyup', this.onKeyUp);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.defaultChecked = this.hasAttribute('checked');
  }

  protected override render() {
    return html`<span part="box" class="box surface focus-ring">
        <span part="key" class="key surface">
          <svg part="mark" class="mark" viewBox="0 0 16 16" aria-hidden="true">
            <path class="check" d="M3.6 8.4l2.9 2.9 5.9-6.6" />
            <path class="dash" d="M4.2 8h7.6" />
          </svg>
        </span>
      </span>
      <span part="label" class="label ${this.hasLabel ? 'has-label' : ''}"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-checked', this.indeterminate ? 'mixed' : String(this.checked));
    this.aria('aria-required', this.required ? 'true' : null);
    this.internals.setFormValue(this.checked ? this.value : null, String(this.checked));
    if (this.required && !this.checked) {
      this.internals.setValidity({ valueMissing: true }, 'Check this box to continue.');
    } else {
      this.internals.setValidity({});
    }
  }

  formResetCallback(): void {
    this.checked = this.defaultChecked;
    this.indeterminate = false;
  }

  formStateRestoreCallback(state: string): void {
    this.checked = state === 'true';
  }

  /** The validity state, as on a native input. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Flips the checkbox as if the user did (clearing indeterminate), firing input and change. */
  toggle(force?: boolean): void {
    const next = force ?? !this.checked;
    if (next === this.checked && !this.indeterminate) return;
    this.indeterminate = false;
    this.checked = next;
    this.emit('input');
    this.emit('change');
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.hasLabel = slot.assignedNodes({ flatten: true }).some((n) => n.textContent?.trim() || n.nodeType === 1);
    this.requestUpdate();
  }

  private onClick = (event: MouseEvent): void => {
    if (this.isDisabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.composedPath().some((n) => n instanceof HTMLAnchorElement)) return;
    this.toggle();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    // APG: Space toggles a checkbox (on key release, like native). Enter is left to the form.
    if (event.target === this && event.key === ' ') event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.target !== this || this.isDisabled || event.key !== ' ') return;
    this.toggle();
  };
}

define('tr-checkbox', TrCheckbox);

declare global {
  interface HTMLElementTagNameMap {
    'tr-checkbox': TrCheckbox;
  }
}
