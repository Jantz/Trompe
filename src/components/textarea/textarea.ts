import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { FormControl } from '../../internal/form-control.js';
import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

const fieldSizing = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');

/**
 * A multi-line text field sunk into the surface: a deep recessed well (depth -2) holding a real
 * `<textarea>`. It takes part in forms like a native textarea (value, reset, validation,
 * `required`, length limits), forwards focus to the inner field, can grow with its content
 * (`autosize`) and can show a character counter.
 *
 * The `label` attribute renders a visible label that names the field. Without one, give the
 * element an `aria-label`, which is forwarded to the inner textarea.
 *
 * @summary Multi-line text field in a recessed well, form-associated.
 * @tag tr-textarea
 *
 * @slot hint - Help text under the field (instead of the `hint` attribute).
 *
 * @csspart label - The visible label.
 * @csspart field - The recessed well around the textarea.
 * @csspart textarea - The native textarea element.
 * @csspart hint - The help text under the field.
 * @csspart counter - The character counter (with `counter`).
 * @csspart error - The error message under the field.
 *
 * @cssprop --tr-textarea-color - Color of the well. Defaults to --tr-color-well.
 * @cssprop --tr-textarea-ink - Text color in the well. Defaults to near-black or near-white, whichever reads on the well.
 * @cssprop --tr-textarea-radius - Corner radius of the well. Defaults to --tr-radius-md.
 * @cssprop --tr-textarea-padding - Padding inside the well. Defaults to 0.6em 0.75em.
 * @cssprop --tr-textarea-max-height - Height an `autosize` field stops growing at. Defaults to 20em.
 * @cssprop --tr-textarea-error-color - Color of the error message and invalid edge. Defaults to --tr-color-danger (the message mixes in 20% ink for 4.5:1).
 *
 * @fires input - Native input event from the inner field (composed).
 * @fires change - The value was committed (blur), re-dispatched from the host.
 *
 * @example <tr-textarea label="Message" name="message" rows="4" required></tr-textarea>
 * @example <tr-textarea label="Bio" maxlength="160" counter autosize hint="Shown on your profile."></tr-textarea>
 * @example <tr-textarea aria-label="Notes" resize="none" material="paper"></tr-textarea>
 */
export class TrTextarea extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_pad: var(--tr-textarea-padding, 0.6em 0.75em);
        display: inline-flex;
        flex-direction: column;
        gap: 0.35em;
        width: 20em;
        max-width: 100%;
        vertical-align: top;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_pad: var(--tr-textarea-padding, 0.5em 0.6em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_pad: var(--tr-textarea-padding, 0.7em 0.9em);
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
        --_base: var(--tr-textarea-color, var(--tr-color-well));
        /* legible on any well: near-white on dark wells, near-black on light ones */
        --_ink: var(--tr-textarea-ink, oklch(from var(--_base) clamp(0.2, (0.6 - l) * 1000, 0.96) min(c, 0.02) h / 1));
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        display: flex;
        border-radius: var(--tr-textarea-radius, min(var(--tr-radius-md, 10px), 1em));
        cursor: text;
        transition:
          border-color var(--tr-motion-duration-release, 160ms),
          border-width var(--tr-motion-duration-release, 160ms);
        --_layer: linear-gradient(
          calc(var(--tr-light-angle, 330deg) + 180deg),
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 10%), transparent),
          transparent 30%,
          transparent 80%,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 12%), transparent)
        );
      }
      .field:has(textarea:focus-visible) {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: 2px;
      }
      textarea {
        flex: 1;
        display: block;
        width: 100%;
        min-width: 0;
        margin: 0;
        padding: var(--_pad);
        border: 0;
        border-radius: inherit;
        outline: none;
        background: transparent;
        color: inherit;
        font: inherit;
        line-height: 1.45;
        letter-spacing: inherit;
        text-shadow: none;
        resize: vertical;
      }
      textarea::placeholder {
        color: color-mix(in oklch, currentColor 62%, transparent);
        opacity: 1;
      }
      :host([resize='none']) textarea {
        resize: none;
      }
      :host([resize='horizontal']) textarea {
        resize: horizontal;
      }
      :host([resize='both']) textarea {
        resize: both;
      }
      :host([autosize]) textarea {
        field-sizing: content;
        resize: none;
        min-height: calc(var(--_rows, 3) * 1.45em + 1.2em);
        max-height: var(--tr-textarea-max-height, 20em);
      }
      /* The foot (hint, error, counter) animates its height (SizeTransition) and its notes fade in
         and out, so content below the field glides instead of jumping. */
      .messages {
        margin-top: -0.35em;
      }
      .foot {
        display: flex;
        align-items: flex-start;
        gap: 0.75em;
      }
      .msg {
        /* the host's 0.35em gap, in the message's smaller (0.8125em) type */
        margin-top: calc(0.35em / 0.8125);
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
      .grow {
        flex: 1;
        min-width: 0;
        display: flex;
      }
      /* Autosize: the textarea takes its content height and the wrapper animates to it. */
      :host([autosize]) .grow {
        display: block;
        align-self: flex-start;
      }
      .notes {
        flex: 1;
        display: grid;
        gap: 0;
      }
      .notes .msg + .msg {
        margin-top: calc(0.2em / 0.8125);
      }
      .hint,
      .error,
      .counter {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        font-size: 0.8125em;
        line-height: 1.35;
      }
      .hint,
      .counter {
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .counter {
        margin-inline-start: auto;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .counter.full {
        color: inherit;
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error {
        --_err-ink: var(--tr-color-danger-ink, #fff);
        color: var(--tr-textarea-error-color, color-mix(in oklch, var(--tr-color-danger) 80%, currentColor));
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error svg {
        flex: none;
        margin-top: 0.12em;
      }
      .hint[hidden],
      .error[hidden],
      .counter[hidden] {
        display: none;
      }
      :host([readonly]) .field {
        --_tr-z: -1;
      }
      :host([data-user-invalid]) .field {
        --_edge: var(--tr-textarea-error-color, var(--tr-color-danger));
        --_edge-strong: var(--tr-textarea-error-color, var(--tr-color-danger));
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
      @media (forced-colors: active) {
        .field {
          border-color: FieldText;
          background: Field;
        }
        .field:has(textarea:focus-visible) {
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

  /** Current value. */
  @property() value = '';

  /** Hint shown while the field is empty. Not a replacement for a label. */
  @property() placeholder = '';

  /** Visible text lines (the minimum height with `autosize`). */
  @property({ type: Number, reflect: true }) rows = 3;

  /** Which way the user can drag-resize the field. Ignored with `autosize`. */
  @property({ reflect: true }) resize: 'none' | 'vertical' | 'horizontal' | 'both' = 'vertical';

  /** Grows the field with its content, from `rows` lines up to --tr-textarea-max-height. */
  @property({ type: Boolean, reflect: true }) autosize = false;

  /** Requires a value for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Shows the value but does not let the user change it. Still submitted. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Minimum length of the value. */
  @property({ type: Number, reflect: true }) minlength?: number;

  /** Maximum length of the value. */
  @property({ type: Number, reflect: true }) maxlength?: number;

  /** Shows a character counter ("12 / 160" with `maxlength`, otherwise the count). */
  @property({ type: Boolean, reflect: true }) counter = false;

  /** Autofill hint, as on a native textarea. */
  @property({ reflect: true }) autocomplete?: string;

  /** Size of the field. */
  @property({ reflect: true }) size: Size = 'md';

  /** Help text under the field, linked to it with aria-describedby. Or use the `hint` slot. */
  @property({ reflect: true }) hint = '';

  /** Error message. Setting it marks the field invalid and shows the message; clear it to make it valid again. */
  @property({ reflect: true }) error = '';

  /** The foot glides to its new height when notes come and go. */
  protected readonly footSize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.messages'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.foot'),
  }));
  /** With `autosize`, the field grows and shrinks smoothly as lines are added. */
  protected readonly fieldSize = new SizeTransition(this, () => ({
    outer: this.autosize ? this.renderRoot?.querySelector<HTMLElement>('.grow') : null,
    inner: this.autosize ? this.textarea : null,
  }));
  private shownError = '';
  /** The error on screen in the last render ('' when none), to tell a replaced error from a new one. */
  private visibleError = '';
  private renderedError = '';

  /** Accessible name forwarded to the inner textarea when there is no visible label. */
  @property({ attribute: 'aria-label', reflect: false }) accessibleLabel: string | null = null;

  @query('textarea') private textarea!: HTMLTextAreaElement;

  /** The value a form reset restores. Captured on first connect only, so moving the field keeps it. */
  private defaultValue: string | null = null;
  private hasHintSlot = false;

  constructor() {
    super();
    this.hostFocusable = false;
    this.addEventListener('invalid', this.onInvalid);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultValue === null) this.defaultValue = this.getAttribute('value') ?? this.value;
  }

  /** The field's validity, as on a native textarea. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** The field's validation message. */
  get validationMessage(): string {
    return this.internals.validationMessage;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Checks validity and shows the browser's message when invalid. */
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Selects all the text. */
  select(): void {
    this.textarea?.select();
  }

  protected override render() {
    const name = this.label ? undefined : (this.accessibleLabel ?? undefined);
    const showError = Boolean(this.error) || this.hasAttribute('data-user-invalid');
    const errorText = this.error || (showError ? this.textarea?.validationMessage : '') || '';
    this.renderedError = showError && errorText ? errorText : '';
    const hasHint = Boolean(this.hint) || this.hasHintSlot;
    const len = this.value.length;
    const max = this.maxlength;
    const describedBy = [hasHint ? 'hint' : '', showError && errorText ? 'error' : '', this.counter ? 'counter' : ''].filter(Boolean).join(' ');
    return html`
      <label part="label" class="label" for="textarea" ?hidden=${!this.label}>${this.label}</label>
      <div part="field" class="field surface" style="--_rows:${this.rows}" @click=${this.onFieldClick}>
        <div class="grow"><textarea
          part="textarea"
          id="textarea"
          .value=${live(this.value)}
          rows=${this.rows}
          placeholder=${this.placeholder || nothing}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.isDisabled}
          minlength=${ifDefined(this.minlength)}
          maxlength=${ifDefined(this.maxlength)}
          autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
          aria-label=${ifDefined(name)}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${showError ? 'true' : nothing}
          @input=${this.onInput}
          @change=${this.onChange}
          @blur=${this.onBlur}
        ></textarea></div>
      </div>
      <div class="messages"><div class="foot">
        <div class="notes">
          <div part="hint" id="hint" class="msg hint" ?hidden=${!hasHint}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
          <div part="error" id="error" class="msg error" ?hidden=${!this.renderedError}>
            <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
            <span class="error-text">${errorText || this.shownError}</span>
          </div>
        </div>
        <span part="counter" id="counter" class="msg counter ${max !== undefined && len >= max ? 'full' : ''}" ?hidden=${!this.counter}
          >${max !== undefined ? `${len} / ${max}` : len}</span
        >
      </div></div>
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.internals.setFormValue(this.value);
    this.syncValidity();
    const text = this.renderRoot.querySelector<HTMLElement>('.error-text');
    const now = this.renderedError;
    // Only an error that was on screen cross-fades; a new error after a cleared one just fades in.
    if (text && now && this.visibleError && now !== this.visibleError) crossfadeText(text, this.visibleError);
    this.visibleError = now;
    if (now) this.shownError = now;
    if (changed.has('error')) {
      if (this.error) this.setAttribute('data-user-invalid', '');
      else if (changed.get('error') && this.textarea?.validity.valid) this.removeAttribute('data-user-invalid');
      this.requestUpdate();
    }
    if (this.autosize && !fieldSizing) this.fitContent();
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
    this.removeAttribute('data-user-invalid');
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }

  /** JS fallback for browsers without `field-sizing: content`. */
  private fitContent(): void {
    const ta = this.textarea;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }

  private syncValidity(): void {
    const ta = this.textarea;
    if (!ta) return;
    ta.setCustomValidity(this.error);
    if (ta.validity.valid) this.internals.setValidity({});
    else this.internals.setValidity(ta.validity, ta.validationMessage, ta);
  }

  private onInput = (): void => {
    this.value = this.textarea.value;
    this.syncValidity();
    if (this.hasAttribute('data-user-invalid') && this.textarea.validity.valid) this.removeAttribute('data-user-invalid');
  };

  private onChange = (): void => {
    this.emit('change');
  };

  private onBlur = (): void => {
    if (this.value !== this.defaultValue || this.textarea.value) this.toggleAttribute('data-user-invalid', !this.textarea.validity.valid);
    this.requestUpdate();
  };

  private onInvalid = (): void => {
    this.setAttribute('data-user-invalid', '');
    this.requestUpdate();
  };

  private onFieldClick = (event: MouseEvent): void => {
    if (event.target !== this.textarea && !this.isDisabled) this.textarea.focus();
  };

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.hasHintSlot = slot.assignedNodes({ flatten: true }).length > 0;
    this.requestUpdate();
  }
}

define('tr-textarea', TrTextarea);

declare global {
  interface HTMLElementTagNameMap {
    'tr-textarea': TrTextarea;
  }
}
