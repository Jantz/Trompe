import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

/**
 * A text field set into the faceplate: a recessed well, lit from the scene's light, with a
 * real `<input>` inside. It takes part in forms like a native input (value, reset, validation,
 * `required`, `pattern`, length limits) and forwards focus to the inner field.
 *
 * The `label` attribute renders a visible label that names the field. Without one, give the
 * element an `aria-label`, which is forwarded to the inner input.
 *
 * @summary Text field in a recessed well, form-associated.
 * @tag tr-input
 *
 * @slot start - Icon or content before the text, e.g. a search glass.
 * @slot end - Icon or content after the text, e.g. a unit.
 * @slot hint - Help text under the field (instead of the `hint` attribute).
 *
 * @csspart label - The visible label.
 * @csspart field - The recessed well around the input.
 * @csspart input - The native input element.
 * @csspart clear - The clear button (with `clearable`).
 * @csspart hint - The help text under the field.
 * @csspart error - The error message under the field, shown when invalid after interaction.
 *
 * @cssprop --tr-input-color - Color of the well. Defaults to --tr-color-well.
 * @cssprop --tr-input-radius - Corner radius of the well. Defaults to --tr-radius-md.
 * @cssprop --tr-input-height - Height of the well. Defaults by size (2.25em, 2.5em, 2.75em).
 * @cssprop --tr-input-padding-inline - Horizontal padding inside the well. Defaults to 0.75em.
 * @cssprop --tr-input-error-color - Color of the error message and invalid edge. Defaults to --tr-color-danger.
 *
 * @fires input - Native input event from the inner field (composed).
 * @fires change - The value was committed (blur or Enter), re-dispatched from the host.
 *
 * @example <tr-input label="Name" name="name" required></tr-input>
 * @example <tr-input label="Email" type="email" autocomplete="email" hint="We never share it." clearable></tr-input>
 * @example <tr-input label="Username" value="ada" error="That name is taken."></tr-input>
 * @example <tr-input aria-label="Search" type="search"><svg slot="start" viewBox="0 0 16 16" width="16" height="16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg></tr-input>
 */
export class TrInput extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_h: var(--tr-input-height, var(--tr-control-md, 2.5em));
        --_pad: var(--tr-input-padding-inline, 0.75em);
        display: inline-flex;
        flex-direction: column;
        gap: 0.35em;
        width: 16em;
        max-width: 100%;
        vertical-align: middle;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_h: var(--tr-input-height, var(--tr-control-sm, 2.25em));
        --_pad: var(--tr-input-padding-inline, 0.6em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_h: var(--tr-input-height, var(--tr-control-lg, 2.75em));
        --_pad: var(--tr-input-padding-inline, 0.9em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .label {
        font-size: 0.8125em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
        cursor: default;
      }
      .label[hidden] {
        display: none;
      }
      .field {
        --_tr-z: -2;
        --_base: var(--tr-input-color, var(--tr-color-well));
        --_ink: var(--tr-color-ink);
        --_edge: var(--_edge-strong);
        /* a well is the inside of a solid: no brushing, spinning or clear-coat on its floor */
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        display: flex;
        align-items: center;
        gap: 0.5em;
        min-height: var(--_h);
        padding: 0 var(--_pad);
        border-radius: var(--tr-input-radius, var(--tr-radius-md, 10px));
        cursor: text;
        transition: box-shadow var(--tr-motion-duration-release, 160ms);
        /* the floor of the well catches a little light near its far wall */
        --_layer: linear-gradient(
          calc(var(--tr-light-angle, 330deg) + 180deg),
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 10%), transparent),
          transparent 45%,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 12%), transparent)
        );
      }
      .field:has(input:focus-visible) {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
      }
      input {
        flex: 1;
        min-width: 0;
        height: 100%;
        min-height: calc(var(--_h) - 2px);
        margin: 0;
        padding: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: inherit;
        font: inherit;
        letter-spacing: inherit;
        text-shadow: none;
      }
      input::placeholder {
        color: var(--tr-color-ink-muted);
        opacity: 1;
      }
      input[type='search']::-webkit-search-cancel-button {
        cursor: pointer;
      }
      ::slotted([slot='start']),
      ::slotted([slot='end']) {
        flex: none;
        color: var(--tr-color-ink-muted);
      }
      .start:not(.has),
      .end:not(.has) {
        display: none;
      }
      .start,
      .end {
        display: inline-flex;
        align-items: center;
      }
      .hint,
      .error {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        font-size: 0.8125em;
        line-height: 1.35;
      }
      .hint {
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .error {
        --_err-ink: var(--tr-color-danger-ink, #fff);
        /* pulled toward the ink so the message meets 4.5:1 on light and dark canvases */
        color: var(--tr-input-error-color, color-mix(in oklch, var(--tr-color-danger) 78%, currentColor));
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error svg {
        flex: none;
        margin-top: 0.12em;
      }
      .hint[hidden],
      .error[hidden] {
        display: none;
      }
      .clear {
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 1.5em;
        height: 1.5em;
        margin: 0 -0.25em;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: color-mix(in oklch, var(--tr-color-ink) 10%, transparent);
        color: var(--tr-color-ink-muted);
        font: inherit;
        cursor: pointer;
      }
      .clear:hover {
        background: color-mix(in oklch, var(--tr-color-ink) 18%, transparent);
        color: var(--tr-color-ink);
      }
      :host([readonly]) .field {
        --_tr-z: -1;
      }
      :host([data-user-invalid]) .field {
        --_edge: var(--tr-input-error-color, var(--tr-color-danger));
        --_edge-strong: var(--tr-input-error-color, var(--tr-color-danger));
        border-width: 1.5px;
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) .field,
      :host(:state(disabled)) .field {
        cursor: not-allowed;
      }
      @media (pointer: coarse) {
        .field {
          min-height: max(var(--_h), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        .field {
          border-color: FieldText;
          background: Field;
        }
        .field:has(input:focus-visible) {
          outline-color: Highlight;
        }
        :host([data-user-invalid]) .field {
          border-color: Mark;
          border-width: 2px;
        }
      }
    `,
  ];

  /** Visible label. Also the accessible name of the field. */
  @property({ reflect: true }) label = '';

  /** Kind of text the field takes. */
  @property({ reflect: true }) type: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' = 'text';

  /** Current value. */
  @property() value = '';

  /** Hint shown while the field is empty. Not a replacement for a label. */
  @property() placeholder = '';

  /** Requires a value for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Shows the value but does not let the user change it. Still submitted. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Minimum length of the value. */
  @property({ type: Number, reflect: true }) minlength?: number;

  /** Maximum length of the value. */
  @property({ type: Number, reflect: true }) maxlength?: number;

  /** Regular expression the value must match. */
  @property({ reflect: true }) pattern?: string;

  /** Autofill hint, as on a native input, e.g. "email" or "off". */
  @property({ reflect: true }) autocomplete?: string;

  /** Virtual keyboard hint, as on a native input. */
  @property({ reflect: true }) inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';

  /** Size of the field. */
  @property({ reflect: true }) size: Size = 'md';

  /** Help text under the field, linked to it with aria-describedby. Or use the `hint` slot. */
  @property({ reflect: true }) hint = '';

  /**
   * Error message. Setting it marks the field invalid (a custom validity error) and shows the
   * message under the field; clear it to make the field valid again. Without it, the browser's
   * own message is shown once the user has interacted with an invalid field.
   */
  @property({ reflect: true }) error = '';

  /** Shows a clear button while the field has a value. */
  @property({ type: Boolean, reflect: true }) clearable = false;

  /** Accessible name forwarded to the inner input when there is no visible label. */
  @property({ attribute: 'aria-label', reflect: false }) accessibleLabel: string | null = null;

  @query('input') private input!: HTMLInputElement;

  private defaultValue = '';
  private slots = { start: false, end: false, hint: false };

  constructor() {
    super();
    this.hostFocusable = false;
    // Form validation reports through ElementInternals, so `invalid` fires on the host.
    this.addEventListener('invalid', this.onInvalid);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.defaultValue = this.getAttribute('value') ?? this.value;
  }

  /** The inner field's validity, as on a native input. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** The inner field's validation message. */
  get validationMessage(): string {
    return this.internals.validationMessage;
  }

  /** Checks validity without showing a message. Fires `invalid` when invalid. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Checks validity and shows the browser's message when invalid. */
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Selects all the text in the field. */
  select(): void {
    this.input?.select();
  }

  protected override render() {
    const name = this.label ? undefined : (this.accessibleLabel ?? undefined);
    const showError = Boolean(this.error) || this.hasAttribute('data-user-invalid');
    const errorText = this.error || (showError ? this.input?.validationMessage : '') || '';
    const hasHint = Boolean(this.hint) || this.slots.hint;
    const describedBy = [hasHint ? 'hint' : '', showError && errorText ? 'error' : ''].filter(Boolean).join(' ');
    return html`
      <label part="label" class="label" for="input" ?hidden=${!this.label}>${this.label}</label>
      <div part="field" class="field surface" @click=${this.onFieldClick}>
        <span class="start ${this.slots.start ? 'has' : ''}"><slot name="start" @slotchange=${this.onSlotChange}></slot></span>
        <input
          part="input"
          id="input"
          .value=${live(this.value)}
          type=${this.type}
          placeholder=${this.placeholder || nothing}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.isDisabled}
          minlength=${ifDefined(this.minlength)}
          maxlength=${ifDefined(this.maxlength)}
          pattern=${ifDefined(this.pattern || undefined)}
          autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
          inputmode=${ifDefined(this.inputmode)}
          aria-label=${ifDefined(name)}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${showError ? 'true' : nothing}
          @input=${this.onInput}
          @change=${this.onChange}
          @blur=${this.onBlur}
        />
        ${this.clearable && this.value && !this.readonly && !this.isDisabled
          ? html`<button part="clear" class="clear" type="button" aria-label="Clear" tabindex="-1" @click=${this.onClear}>
              <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" /></svg>
            </button>`
          : nothing}
        <span class="end ${this.slots.end ? 'has' : ''}"><slot name="end" @slotchange=${this.onSlotChange}></slot></span>
      </div>
      <div part="hint" id="hint" class="hint" ?hidden=${!hasHint}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
      <div part="error" id="error" class="error" ?hidden=${!(showError && errorText)}>
        <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
        <span>${errorText}</span>
      </div>
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.internals.setFormValue(this.value);
    this.syncValidity();
    // An author-set error is shown right away; clearing it hides it again.
    if (changed.has('error')) {
      if (this.error) this.setAttribute('data-user-invalid', '');
      else if (changed.get('error') && this.input?.validity.valid) this.removeAttribute('data-user-invalid');
      this.requestUpdate();
    }
  }

  formResetCallback(): void {
    this.value = this.defaultValue;
    this.removeAttribute('data-user-invalid');
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }

  private syncValidity(): void {
    const input = this.input;
    if (!input) return;
    input.setCustomValidity(this.error || '');
    if (input.validity.valid) this.internals.setValidity({});
    else this.internals.setValidity(input.validity, input.validationMessage, input);
  }

  private onInput = (): void => {
    // The native input event is composed: it already reaches listeners on the host.
    this.value = this.input.value;
    this.syncValidity();
    if (this.hasAttribute('data-user-invalid') && this.input.validity.valid) this.removeAttribute('data-user-invalid');
    this.requestUpdate();
  };

  private onChange = (): void => {
    // change is not composed, so re-dispatch it from the host.
    this.emit('change');
  };

  private onBlur = (): void => {
    // Mirror :user-invalid: flag errors once the user has interacted and left the field.
    if (this.value !== this.defaultValue || this.input.value) this.toggleAttribute('data-user-invalid', !this.input.validity.valid);
    this.requestUpdate();
  };

  private onInvalid = (): void => {
    this.setAttribute('data-user-invalid', '');
    this.requestUpdate();
  };

  private onClear = (): void => {
    this.value = '';
    this.input.value = '';
    this.emit('input');
    this.emit('change');
    this.input.focus();
  };

  private onFieldClick = (event: MouseEvent): void => {
    if (event.target !== this.input && !this.isDisabled) this.input.focus();
  };

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    const key = slot.name as 'start' | 'end' | 'hint';
    this.slots = { ...this.slots, [key]: slot.assignedNodes({ flatten: true }).length > 0 };
    this.requestUpdate();
  }
}

define('tr-input', TrInput);

declare global {
  interface HTMLElementTagNameMap {
    'tr-input': TrInput;
  }
}
