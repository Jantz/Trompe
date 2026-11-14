import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import { SizeTransition, afterExit, crossfadeText } from '../../interaction/smooth.js';
import { reducedMotion } from '../../interaction/motion.js';
import type { Size } from '../../internal/types.js';
import { anchorTo } from '../menu/position.js';
import '../calendar/calendar.js';
import type { TrCalendar } from '../calendar/calendar.js';
import { fromISO, isISO, localeOf, parseDate, splitRange } from '../calendar/dates.js';

/**
 * A date field: a recessed well with the formatted date and a calendar key that opens a
 * `tr-calendar` on a floating sheet. People can type a date in their own way ("3 Nov 2026",
 * "03/11/2026", "2026-11-03") or pick it; the value is always yyyy-mm-dd. With `range` it takes
 * a start and an end date (value "2026-11-03/2026-11-09").
 *
 * Same height, label, hint and error as `tr-input` and `tr-select`, so it lines up in forms.
 * Form-associated: submits `name=value`, supports `required`, `min`/`max` (as range errors),
 * reset and disabled fieldsets. Text that is not a date is a bad-input error.
 *
 * Keyboard: Alt+Down or Down in the field opens the calendar and moves focus into it (see
 * `tr-calendar` for its keys); Enter or a click chooses and closes it, Escape closes it, and focus
 * returns to where it was.
 *
 * @summary Date field with a calendar popover, form-associated. Single date or range.
 * @tag tr-date-picker
 *
 * @csspart label - The visible label.
 * @csspart field - The recessed well.
 * @csspart input - The native text input.
 * @csspart button - The calendar key.
 * @csspart clear - The clear key (with `clearable`).
 * @csspart popover - The floating sheet holding the calendar.
 * @csspart calendar - The `tr-calendar` element in the sheet.
 * @csspart hint - The help text under the field.
 * @csspart error - The error message under the field.
 *
 * @cssprop --tr-date-picker-width - Width of the control. Defaults to 16em (21em with `range`).
 * @cssprop --tr-input-height - Height of the well, shared with tr-input. Defaults by size (2.25em, 2.5em, 2.75em).
 * @cssprop --tr-input-color - Colour of the well, shared with tr-input. Defaults to --tr-color-well.
 *
 * @fires input - A date was chosen or typed (committed), or a range was started.
 * @fires change - A date, or a complete range, was committed.
 * @fires open - The calendar opened (does not bubble).
 * @fires close - The calendar closed (does not bubble).
 *
 * @example <tr-date-picker label="Date of birth" name="dob" max="2026-11-14" required></tr-date-picker>
 * @example <tr-date-picker label="Stay" range name="stay" min="2026-11-14" hint="Check-in to check-out."></tr-date-picker>
 * @example <tr-date-picker label="Due" value="2026-12-01" format="long" clearable></tr-date-picker>
 */
export class TrDatePicker extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_h: var(--tr-input-height, var(--tr-control-md, 2.5em));
        --_pad: var(--tr-input-padding-inline, 0.75em);
        --_rad: var(--tr-input-radius, var(--tr-radius-md, 10px));
        display: inline-flex;
        flex-direction: column;
        gap: 0.35em;
        width: var(--tr-date-picker-width, 16em);
        max-width: 100%;
        vertical-align: middle;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([range]) {
        width: var(--tr-date-picker-width, 21em);
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
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        display: flex;
        align-items: center;
        gap: 0.5em;
        min-height: var(--_h);
        padding: 0 calc(var(--_pad) * 0.4) 0 var(--_pad);
        border-radius: var(--_rad);
        cursor: text;
        transition:
          box-shadow var(--tr-motion-duration-release, 160ms),
          border-color var(--tr-motion-duration-release, 160ms),
          border-width var(--tr-motion-duration-release, 160ms);
        --_layer: linear-gradient(
          calc(var(--tr-light-angle, 330deg) + 180deg),
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 10%), transparent),
          transparent 45%,
          color-mix(in oklab, var(--_hl) calc(var(--_r) * 12%), transparent)
        );
      }
      .field:has(input:focus-visible) {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
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
        font-variant-numeric: tabular-nums;
        letter-spacing: inherit;
        text-overflow: ellipsis;
        text-shadow: none;
      }
      input::placeholder {
        color: var(--tr-color-ink-muted);
        opacity: 1;
      }
      /* the old date fading out over the field while the new one fades in */
      .text-ghost {
        position: absolute;
        overflow: hidden;
        white-space: pre;
        pointer-events: none;
        font-variant-numeric: tabular-nums;
        color: var(--_ink);
      }
      .clear {
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 1.5em;
        height: 1.5em;
        margin: 0 -0.15em;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: color-mix(in oklch, var(--tr-color-ink) 10%, transparent);
        color: var(--tr-color-ink-muted);
        font: inherit;
        cursor: pointer;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out),
          visibility var(--tr-motion-duration-release, 160ms) allow-discrete,
          background-color var(--tr-motion-duration-release, 160ms),
          color var(--tr-motion-duration-release, 160ms);
      }
      .clear.off {
        opacity: 0;
        scale: 0.6;
        visibility: hidden;
        pointer-events: none;
      }
      .clear:hover {
        background: color-mix(in oklch, var(--tr-color-ink) 18%, transparent);
        color: var(--tr-color-ink);
      }
      /* the calendar key: a small raised key set into the end of the well */
      .key {
        --_tr-z: 1;
        --_curve: 0.3;
        --_reflect: 0.6;
        flex: none;
        display: inline-grid;
        place-items: center;
        width: calc(var(--_h) - 0.75em);
        height: calc(var(--_h) - 0.75em);
        padding: 0;
        border-radius: max(4px, calc(var(--_rad) - 4px));
        font: inherit;
        cursor: pointer;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      .key:hover {
        --_tr-z: 1.5;
      }
      .key:active,
      :host([open]) .key {
        --_tr-z: -0.5;
        translate: calc(var(--_sx) * 0.75px) calc(var(--_sy) * 0.75px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .key:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
      }
      .key svg {
        width: 1.05em;
        height: 1.05em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      :host([readonly]) .key,
      :host([disabled]) .key {
        --_tr-z: 0;
        translate: none;
        cursor: default;
      }
      :host([readonly]) .field {
        --_tr-z: -1;
      }
      /* the sheet: lifts in from the field and sinks back on close */
      .sheet {
        --_tr-z: 3;
        --_curve: 0;
        --_reflect: 0.35;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0.3em;
        max-width: calc(100vw - 8px);
        overflow: visible;
        border-radius: var(--tr-radius-lg, 14px);
        font-size: inherit;
        font-family: var(--tr-font-family);
        color: var(--_ink);
        opacity: 0;
        translate: 0 -0.3em;
        scale: 0.98;
        transform-origin: top left;
        /* always its own layer, so its text does not snap by a pixel when it starts to fade */
        will-change: opacity, translate, scale;
        transition:
          opacity 110ms ease-in,
          translate 110ms ease-in,
          scale 110ms ease-in,
          display 110ms allow-discrete,
          overlay 110ms allow-discrete;
      }
      .sheet:popover-open {
        display: block;
        opacity: 1;
        translate: none;
        scale: 1;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out),
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out),
          display var(--tr-motion-duration-release, 160ms) allow-discrete,
          overlay var(--tr-motion-duration-release, 160ms) allow-discrete;
      }
      @starting-style {
        .sheet:popover-open {
          opacity: 0;
          translate: 0 -0.3em;
          scale: 0.98;
        }
      }
      /* the sheet is the plate: the calendar inside drops its own */
      tr-calendar {
        display: block;
        font-size: 1em;
      }
      tr-calendar::part(calendar) {
        padding: 0.25em;
        border-color: transparent;
        background: none;
        box-shadow: none;
      }
      .messages {
        margin-top: -0.35em;
      }
      .stack {
        display: grid;
      }
      .msg {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        margin-top: calc(0.35em / 0.8125);
        font-size: 0.8125em;
        line-height: 1.35;
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
      :host([data-user-invalid]) .field {
        --_edge: var(--tr-color-danger);
        --_edge-strong: var(--tr-color-danger);
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
        .sheet {
          border: 1px solid CanvasText;
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

  /** The date as yyyy-mm-dd, or with `range` two dates joined by a slash. '' when empty. */
  @property() value = '';

  /** Takes a start and an end date. */
  @property({ type: Boolean, reflect: true }) range = false;

  /** Earliest date (yyyy-mm-dd). Earlier dates are disabled in the calendar and invalid when typed. */
  @property({ reflect: true }) min = '';

  /** Latest date (yyyy-mm-dd). */
  @property({ reflect: true }) max = '';

  /** How the date is written in the field. */
  @property({ reflect: true }) format: 'short' | 'medium' | 'long' = 'medium';

  /** Locale for formatting and reading typed dates, e.g. "en-GB". Defaults to the nearest `lang`. */
  @property({ reflect: true }) locale = '';

  /** First day of the week in the calendar, 0 (Sunday) to 6 (Saturday). Defaults to the locale's. */
  @property({ type: Number, attribute: 'first-day-of-week', reflect: true }) firstDayOfWeek?: number;

  /** Shows ISO week numbers in the calendar. */
  @property({ type: Boolean, attribute: 'week-numbers', reflect: true }) weekNumbers = false;

  /** Text shown while empty. Defaults to the locale's date pattern, e.g. "dd/mm/yyyy". */
  @property() placeholder = '';

  /** Requires a date (or a complete range) for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Shows the date but does not let the user change it. Still submitted. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Shows a clear key while the field has a date. */
  @property({ type: Boolean, reflect: true }) clearable = false;

  /** Size of the field. */
  @property({ reflect: true }) size: Size = 'md';

  /** Help text under the field, read out with it. */
  @property({ reflect: true }) hint = '';

  /** Error message. Setting it marks the field invalid; clear it to make the field valid again. */
  @property({ reflect: true }) error = '';

  /** Whether the calendar is showing. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Return true for dates that cannot be chosen (weekends, booked days). Property only. */
  @property({ attribute: false }) isDateDisabled?: (date: Date) => boolean;

  /** Accessible name forwarded to the inner input when there is no visible label. */
  @property({ attribute: 'aria-label', reflect: false }) accessibleLabel: string | null = null;

  @query('input') private input!: HTMLInputElement;
  @query('.sheet') private sheet!: HTMLElement;
  @query('tr-calendar') private calendar!: TrCalendar;
  @query('.field') private fieldEl!: HTMLElement;

  /** What is typed in the field, while the user edits it. */
  @state() private draft: string | null = null;
  /** The typed text could not be read as a date. */
  @state() private bad = false;

  private defaultValue: string | null = null;
  private unanchor: (() => void) | null = null;
  private returnFocus: HTMLElement | null = null;
  private closeRun = 0;
  private shownError = '';
  private visibleError = '';
  /** The text the field showed after the last render, to cross-fade a new date in. */
  private shownText: string | null = null;
  protected readonly messageSize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.messages'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.stack'),
  }));

  constructor() {
    super();
    this.hostFocusable = false;
    this.addEventListener('invalid', this.onInvalid);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultValue === null) this.defaultValue = this.getAttribute('value') ?? this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside, true);
    this.unanchor?.();
    this.unanchor = null;
  }

  /** First date ('' when empty). */
  get start(): string {
    return splitRange(this.value)[0];
  }

  /** Last date of a range ('' when not complete). */
  get end(): string {
    return this.range ? splitRange(this.value)[1] : '';
  }

  /** The (start) date as a Date at local noon, or null. */
  get valueAsDate(): Date | null {
    return fromISO(this.start);
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  get validationMessage(): string {
    return this.internals.validationMessage;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Opens the calendar and moves focus into it. */
  show(): void {
    if (this.isDisabled || this.readonly || this.open) return;
    this.returnFocus = (this.shadowRoot?.activeElement as HTMLElement | null) ?? this.input ?? null;
    this.commitDraft(false);
    this.open = true;
  }

  /** Closes the calendar. */
  hide(): void {
    this.open = false;
  }

  // -----------------------------------------------------------------------------------------
  // Formatting

  private get loc(): string {
    return localeOf(this, this.locale);
  }

  private formatDate(iso: string): string {
    const d = fromISO(iso);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(this.loc, { dateStyle: this.format }).format(d);
    } catch {
      return iso;
    }
  }

  /** The value as the field shows it. */
  private get formatted(): string {
    const [a, b] = splitRange(this.value);
    if (!a) return '';
    if (!this.range) return this.formatDate(a);
    return b ? `${this.formatDate(a)} – ${this.formatDate(b)}` : `${this.formatDate(a)} – `;
  }

  /** "dd/mm/yyyy" in the locale's order and separator. */
  private get pattern(): string {
    let one = 'yyyy-mm-dd';
    try {
      one = new Intl.DateTimeFormat(this.loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
        .formatToParts(new Date(2026, 10, 23, 12))
        .map((p) => (p.type === 'day' ? 'dd' : p.type === 'month' ? 'mm' : p.type === 'year' ? 'yyyy' : p.type === 'literal' ? p.value : ''))
        .join('');
    } catch {
      /* keep ISO */
    }
    return this.range ? `${one} – ${one}` : one;
  }

  /** Reads the typed text. undefined when it is not a date (or range). */
  private parse(text: string): string | undefined {
    const t = text.trim();
    if (!t) return '';
    if (this.range) {
      const parts = t.split(/\s*[–—]\s*|\s+-\s+|\s+to\s+|\s+bis\s+|\s+au\s+/i).filter((p) => p.trim());
      if (parts.length !== 2) {
        if (isISO(t.split('/')[0]) && isISO(t.split('/')[1])) return this.order(t.split('/')[0]!, t.split('/')[1]!);
        return undefined;
      }
      const a = parseDate(parts[0]!, this.loc);
      const b = parseDate(parts[1]!, this.loc);
      return a && b ? this.order(a, b) : undefined;
    }
    return parseDate(t, this.loc) ?? undefined;
  }

  private order(a: string, b: string): string {
    return a <= b ? `${a}/${b}` : `${b}/${a}`;
  }

  // -----------------------------------------------------------------------------------------
  // Render

  protected override render() {
    const name = this.label ? undefined : (this.accessibleLabel ?? undefined);
    const showError = Boolean(this.error) || this.hasAttribute('data-user-invalid');
    const message = this.error || (showError ? this.internals.validationMessage : '');
    const errorText = showError && message ? message : '';
    const hasHint = Boolean(this.hint);
    const describedBy = [hasHint ? 'hint' : '', errorText ? 'error' : ''].filter(Boolean).join(' ');
    const text = this.draft ?? this.formatted;
    const canClear = this.clearable && !this.readonly;
    const pickLabel = this.range ? 'Choose dates' : 'Choose date';
    return html`
      <label part="label" class="label" for="input" ?hidden=${!this.label}>${this.label}</label>
      <div part="field" class="field surface" @click=${this.onFieldClick}>
        <input
          part="input"
          id="input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          .value=${live(text)}
          placeholder=${this.placeholder || this.pattern}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${this.isDisabled}
          aria-label=${ifDefined(name)}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${errorText ? 'true' : nothing}
          @input=${this.onInput}
          @change=${(e: Event) => e.stopPropagation()}
          @keydown=${this.onInputKey}
          @blur=${this.onBlur}
        />
        ${canClear
          ? html`<button
              part="clear"
              class="clear ${this.value && !this.isDisabled ? '' : 'off'}"
              type="button"
              aria-label="Clear"
              aria-hidden=${this.value && !this.isDisabled ? nothing : 'true'}
              tabindex="-1"
              @click=${this.onClear}
            >
              <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" /></svg>
            </button>`
          : nothing}
        <button
          part="button"
          class="key surface"
          type="button"
          aria-label=${this.formatted ? `${pickLabel}, ${this.formatted}` : pickLabel}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls="sheet"
          ?disabled=${this.isDisabled}
          tabindex=${this.readonly ? '-1' : nothing}
          @click=${this.onKey}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2.2" />
            <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" />
            <path d="M6.5 11.5h1M9.5 11.5h1M12.5 11.5h1M6.5 14h1M9.5 14h1" stroke-width="1.9" />
          </svg>
        </button>
      </div>
      <div
        part="popover"
        id="sheet"
        class="sheet surface"
        popover="manual"
        role="dialog"
        aria-label=${this.label ? `${this.label}: ${pickLabel.toLowerCase()}` : pickLabel}
        @keydown=${this.onSheetKey}
        @focusout=${this.onSheetFocusOut}
      >
        <tr-calendar
          part="calendar"
          exportparts="day, title, grid"
          .value=${this.value}
          ?range=${this.range}
          .min=${this.min}
          .max=${this.max}
          .locale=${this.locale}
          .firstDayOfWeek=${this.firstDayOfWeek}
          ?week-numbers=${this.weekNumbers}
          .isDateDisabled=${this.isDateDisabled}
          label=${this.label || nothing}
          @input=${this.onCalendarInput}
          @change=${this.onCalendarChange}
        ></tr-calendar>
      </div>
      <div class="messages">
        <div class="stack">
          <div part="hint" id="hint" class="msg hint" ?hidden=${!hasHint}>${this.hint}</div>
          <div part="error" id="error" class="msg error" ?hidden=${!errorText}>
            <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
            <span class="error-text">${errorText || this.shownError}</span>
          </div>
        </div>
      </div>
    `;
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A value set from outside replaces whatever was being typed.
    if (changed.has('value') && changed.get('value') !== undefined && !this.committing) {
      this.draft = null;
      this.bad = false;
    }
    // Before render, so the message shown matches the value being rendered.
    this.syncValidity();
  }

  private committing = false;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // a hint that changes wording cross-fades instead of flicking over
    if (changed.get('hint') && this.hint) crossfadeText(this.renderRoot.querySelector<HTMLElement>('.hint'), changed.get('hint') as string);
    // An unfinished range is submitted as typed; validity reports the missing end date.
    this.internals.setFormValue(this.start ? this.value : null);
    this.syncValidity();
    if (changed.has('open')) this.applyOpen(changed.get('open') !== undefined);
    if (changed.has('error')) {
      if (this.error) this.setAttribute('data-user-invalid', '');
      else if (changed.get('error') && this.internals.validity.valid) this.removeAttribute('data-user-invalid');
      this.requestUpdate();
    }
    const text = this.draft ?? this.formatted;
    if (this.shownText !== null && text !== this.shownText && this.draft === null) this.swapText(this.shownText);
    this.shownText = text;
    const errText = this.renderRoot.querySelector<HTMLElement>('.error-text');
    const showError = Boolean(this.error) || this.hasAttribute('data-user-invalid');
    const now = showError ? this.error || this.internals.validationMessage : '';
    if (errText && now && this.visibleError && now !== this.visibleError) crossfadeText(errText, this.visibleError);
    this.visibleError = now;
    if (now) this.shownError = now;
  }

  /** A new date cross-fades into the field (an input's text cannot animate itself). */
  private swapText(previous: string): void {
    const input = this.input;
    const field = this.fieldEl;
    if (!input || !field || typeof input.animate !== 'function') return;
    field.querySelectorAll('.text-ghost').forEach((g) => g.remove());
    const still = reducedMotion(this);
    if (previous) {
      const box = input.getBoundingClientRect();
      const frame = field.getBoundingClientRect();
      const ghost = document.createElement('span');
      ghost.className = 'text-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = previous;
      ghost.style.cssText = `left:${box.left - frame.left - field.clientLeft}px;top:${box.top - frame.top - field.clientTop}px;width:${box.width}px;height:${box.height}px;line-height:${box.height}px`;
      field.append(ghost);
      ghost
        .animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: still ? '0 0' : '0 -0.3em' }], { duration: 140, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => ghost.remove(), () => ghost.remove());
    }
    input.animate([{ opacity: 0, translate: still ? '0 0' : '0 0.3em' }, { opacity: 1, translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }

  private syncValidity(): void {
    const [a, b] = splitRange(this.value);
    const anchor = this.input ?? undefined;
    const lo = this.min && isISO(this.min) ? this.min : '';
    const hi = this.max && isISO(this.max) ? this.max : '';
    if (this.error) this.internals.setValidity({ customError: true }, this.error, anchor);
    else if (this.bad) this.internals.setValidity({ badInput: true }, `Enter a date like ${this.pattern.split(' – ')[0]}.`, anchor);
    else if (this.required && !a) this.internals.setValidity({ valueMissing: true }, this.range ? 'Choose a start and an end date.' : 'Choose a date.', anchor);
    else if (this.range && a && !b) this.internals.setValidity({ valueMissing: true }, 'Choose an end date.', anchor);
    else if (lo && a && a < lo) this.internals.setValidity({ rangeUnderflow: true }, `Choose ${this.formatDate(lo)} or later.`, anchor);
    else if (hi && (b || a) && (b || a) > hi) this.internals.setValidity({ rangeOverflow: true }, `Choose ${this.formatDate(hi)} or earlier.`, anchor);
    else if (this.isDateDisabled && a && [a, b].some((d) => d && this.isDateDisabled!(fromISO(d)!)))
      this.internals.setValidity({ customError: true }, 'That date is not available.', anchor);
    else this.internals.setValidity({});
  }

  private applyOpen(fire: boolean): void {
    const sheet = this.sheet;
    if (!sheet) return;
    if (this.open) {
      try {
        sheet.showPopover();
      } catch {
        /* not connected */
      }
      this.unanchor?.();
      this.unanchor = anchorTo(sheet, this.fieldEl, 'bottom-start', 6);
      document.addEventListener('pointerdown', this.onOutside, true);
      const cal = this.calendar;
      if (cal) {
        if (this.start) cal.goTo(this.start);
        void cal.updateComplete.then(() => {
          if (this.open) cal.focus({ preventScroll: true });
        });
      }
      if (fire) this.dispatchEvent(new Event('open'));
    } else {
      try {
        sheet.hidePopover();
      } catch {
        /* already hidden */
      }
      document.removeEventListener('pointerdown', this.onOutside, true);
      const run = ++this.closeRun;
      void afterExit(sheet).then(() => {
        if (run !== this.closeRun || this.open) return;
        this.unanchor?.();
        this.unanchor = null;
      });
      if (this.renderRoot.contains(this.shadowRoot?.activeElement ?? null) || this.matches(':focus-within')) {
        (this.returnFocus ?? this.input)?.focus({ preventScroll: true });
      }
      this.returnFocus = null;
      if (fire) this.dispatchEvent(new Event('close'));
    }
  }

  // -----------------------------------------------------------------------------------------
  // Events

  /** Reads what was typed. Returns true when the value changed. */
  private commitDraft(fire = true): boolean {
    if (this.draft === null) return false;
    const parsed = this.parse(this.draft);
    if (parsed === undefined) {
      this.bad = true;
      return false;
    }
    this.bad = false;
    this.draft = null;
    if (parsed === this.value) return false;
    this.committing = true;
    this.value = parsed;
    void this.updateComplete.then(() => (this.committing = false));
    if (fire) {
      this.emit('input');
      this.emit('change');
    }
    return true;
  }

  private onInput = (e: Event): void => {
    // Typing is not a value yet: the host fires input when the text is read (Enter or leaving).
    e.stopPropagation();
    this.draft = this.input.value;
    if (this.bad && this.parse(this.draft) !== undefined) this.bad = false;
  };

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      this.commitDraft();
      this.syncValidity();
      this.toggleAttribute('data-user-invalid', !this.internals.validity.valid);
      this.requestUpdate();
    } else if ((e.key === 'ArrowDown' && (e.altKey || !this.draft)) || (e.key === 'ArrowUp' && e.altKey)) {
      e.preventDefault();
      if (e.key === 'ArrowDown') this.show();
      else this.hide();
    } else if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.hide();
    }
  };

  private onBlur = (): void => {
    this.commitDraft();
    this.syncValidity();
    if (this.value !== this.defaultValue || this.bad) this.toggleAttribute('data-user-invalid', !this.internals.validity.valid);
    this.requestUpdate();
  };

  private onInvalid = (): void => {
    this.setAttribute('data-user-invalid', '');
    this.requestUpdate();
  };

  private onClear = (): void => {
    this.draft = null;
    this.bad = false;
    this.value = '';
    this.emit('input');
    this.emit('change');
    this.input.focus();
  };

  private onKey = (e: MouseEvent): void => {
    e.stopPropagation();
    if (this.readonly || this.isDisabled) return;
    if (this.open) this.hide();
    else {
      this.show();
      this.returnFocus = this.renderRoot.querySelector<HTMLElement>('.key');
    }
  };

  private onFieldClick = (e: MouseEvent): void => {
    if (e.target !== this.input && !this.isDisabled) this.input.focus();
  };

  private onCalendarInput = (e: Event): void => {
    e.stopPropagation();
    const cal = e.target as TrCalendar;
    this.draft = null;
    this.bad = false;
    this.committing = true;
    this.value = cal.value;
    void this.updateComplete.then(() => (this.committing = false));
    this.removeAttribute('data-user-invalid');
    this.emit('input');
  };

  private onCalendarChange = (e: Event): void => {
    e.stopPropagation();
    this.value = (e.target as TrCalendar).value;
    this.emit('change');
    this.hide();
  };

  private onSheetKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }
  };

  private onSheetFocusOut = (e: FocusEvent): void => {
    const to = e.relatedTarget as Node | null;
    if (this.open && to && !this.sheet.contains(to) && !this.contains(to) && to !== this && !this.renderRoot.contains(to)) this.hide();
  };

  private onOutside = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
    this.draft = null;
    this.bad = false;
    this.removeAttribute('data-user-invalid');
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }
}

define('tr-date-picker', TrDatePicker);

declare global {
  interface HTMLElementTagNameMap {
    'tr-date-picker': TrDatePicker;
  }
}

