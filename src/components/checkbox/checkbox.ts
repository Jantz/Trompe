import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { PressController } from '../../interaction/press.js';
import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';

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
 * @csspart hint - The help text under the label.
 * @csspart error - The error message under the label.
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
 * @example <tr-checkbox name="terms" required error="Accept the terms to continue.">I accept the terms</tr-checkbox>
 */
export class TrCheckbox extends FormControl {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.isDisabled });

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
        /* centred on the first line of the label, so a hint or error below never moves it */
        align-self: flex-start;
        margin-top: max(0px, calc((1.3em - var(--_s)) / 2));
        width: var(--_s);
        height: var(--_s);
        border-radius: var(--_rad);
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          border-color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([data-user-invalid]) .box {
        border-color: var(--tr-color-danger);
      }
      .text {
        display: flex;
        flex-direction: column;
        align-self: flex-start;
        min-width: 0;
      }
      .text:not(.has) {
        display: none;
      }
      /* messages wrap within the label's width, so an error never widens the checkbox */
      .messages {
        contain: inline-size;
      }
      .stack {
        display: grid;
      }
      .msg {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        margin-top: calc(0.25em / 0.8125);
        font-size: 0.8125em;
        line-height: 1.35;
        user-select: text;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.2, 0.7, 0.2, 1),
          display var(--tr-motion-duration-release, 160ms) allow-discrete;
      }
      .msg[hidden] {
        display: none;
        opacity: 0;
        translate: 0 -0.3em;
        transition-timing-function: ease-in;
      }
      @starting-style {
        .msg {
          opacity: 0;
          translate: 0 -0.3em;
        }
      }
      .hint {
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .error {
        --_err-ink: var(--tr-color-danger-ink, #fff);
        color: color-mix(in oklch, var(--tr-color-danger) 78%, currentColor);
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error svg {
        flex: none;
        margin-top: 0.12em;
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
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([checked]) .key,
      :host([indeterminate]) .key {
        opacity: 1;
        scale: 1;
      }
      :host([data-tr-pressed]) .key {
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

  /** Help text under the label. */
  @property({ reflect: true }) hint = '';

  /**
   * Error message under the label. Setting it marks the checkbox invalid (a custom validity
   * error, so the form does not submit) and gives the box a danger edge; clear it to remove.
   */
  @property({ reflect: true }) error = '';

  /** The hint/error area glides to its new height instead of pushing content in one frame. */
  protected readonly messageSize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.messages'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.stack'),
  }));
  /** Kept after the error clears, so the message fades out with its words still in it. */
  private shownError = '';

  /** The state a form reset restores. Captured on first connect only (`checked` reflects). */
  private defaultChecked: boolean | null = null;
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
    if (this.defaultChecked === null) this.defaultChecked = this.hasAttribute('checked');
  }

  protected override render() {
    const msgs = !!(this.hint || this.error || this.shownError);
    return html`<span part="box" class="box surface focus-ring">
        <span part="key" class="key surface">
          <svg part="mark" class="mark" viewBox="0 0 16 16" aria-hidden="true">
            <path class="check" d="M3.6 8.4l2.9 2.9 5.9-6.6" />
            <path class="dash" d="M4.2 8h7.6" />
          </svg>
        </span>
      </span>
      <span class="text ${this.hasLabel || msgs ? 'has' : ''}">
        <span part="label" class="label ${this.hasLabel ? 'has-label' : ''}"><slot @slotchange=${this.onSlotChange}></slot></span>
        <span class="messages">
          <span class="stack">
            <span part="hint" class="msg hint" ?hidden=${!this.hint}>${this.hint}</span>
            <span part="error" class="msg error" ?hidden=${!this.error}>
              <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
              <span class="error-text">${this.error || this.shownError}</span>
            </span>
          </span>
        </span>
      </span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.get('hint') && this.hint) crossfadeText(this.renderRoot.querySelector<HTMLElement>('.hint'), changed.get('hint') as string);
    this.aria('aria-checked', this.indeterminate ? 'mixed' : String(this.checked));
    this.aria('aria-required', this.required ? 'true' : null);
    this.aria('aria-description', [this.error, this.hint].filter(Boolean).join('. ') || null);
    this.aria('aria-invalid', this.error ? 'true' : null);
    if (changed.has('error')) {
      if (this.error) {
        this.shownError = this.error;
        this.setAttribute('data-user-invalid', '');
      } else if (changed.get('error')) this.removeAttribute('data-user-invalid');
    }
    this.internals.setFormValue(this.checked ? this.value : null, String(this.checked));
    if (this.error) {
      this.internals.setValidity({ customError: true }, this.error);
    } else if (this.required && !this.checked) {
      this.internals.setValidity({ valueMissing: true }, 'Check this box to continue.');
    } else {
      this.internals.setValidity({});
    }
  }

  formResetCallback(): void {
    this.checked = this.defaultChecked ?? false;
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
