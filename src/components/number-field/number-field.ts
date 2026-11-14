import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

/**
 * A number in a recessed well with a − and a + key on either side: quantities in a cart, sets and
 * reps, guests, seats. Type a number, press the keys (hold to repeat), or use the arrow keys
 * (Page Up/Down step ×10, Home/End jump to min/max). Values are clamped to `min`/`max` and
 * snapped to `step` when committed; a key that cannot move further dims.
 *
 * The inner field has role="spinbutton" with aria-valuenow/min/max, so it reads like a native
 * number input. It is form-associated (name, value, reset, disabled fieldsets). The digits roll
 * up or down when the value steps.
 *
 * @summary Number field with − / + step keys (spinbutton), form-associated.
 * @tag tr-number-field
 *
 * @slot hint - Help text under the field (instead of the `hint` attribute).
 *
 * @csspart label - The visible label.
 * @csspart field - The recessed well.
 * @csspart input - The native input.
 * @csspart decrement - The − key.
 * @csspart increment - The + key.
 * @csspart unit - The unit after the number.
 * @csspart hint - The help text.
 *
 * @cssprop --tr-number-field-width - Width of the whole control. Defaults to 9em (fits 4 digits and the keys).
 * @cssprop --tr-number-field-color - Colour of the well. Defaults to --tr-color-well.
 *
 * @fires input - The value changed (typing, a key press or an arrow key).
 * @fires change - The value was committed (blur, Enter, a key press or an arrow key).
 *
 * @example <tr-number-field label="Quantity" value="1" min="1" max="10"></tr-number-field>
 * @example <tr-number-field label="Weight" value="82.5" step="2.5" min="0" unit="kg"></tr-number-field>
 * @example <tr-number-field aria-label="Guests" value="2" min="1" max="12" size="sm"></tr-number-field>
 */
export class TrNumberField extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_h: var(--tr-control-md, 2.5em);
        display: inline-flex;
        flex-direction: column;
        gap: 0.35em;
        width: var(--tr-number-field-width, 9em);
        max-width: 100%;
        vertical-align: middle;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_h: var(--tr-control-sm, 2.25em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_h: var(--tr-control-lg, 2.75em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .label {
        font-size: 0.8125em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
      }
      .label[hidden],
      .hint[hidden],
      .unit[hidden] {
        display: none;
      }
      .field {
        --_tr-z: -2;
        --_base: var(--tr-number-field-color, var(--tr-color-well));
        --_ink: var(--tr-color-ink);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        display: flex;
        align-items: center;
        gap: 0.25em;
        min-height: var(--_h);
        padding: 0.2em;
        border-radius: var(--tr-radius-md, 10px);
      }
      .field:has(input:focus-visible) {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
      }
      .readout {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 0.2em;
        overflow: hidden;
      }
      input {
        width: 100%;
        min-width: 2ch;
        margin: 0;
        padding: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: inherit;
        font: inherit;
        font-variant-numeric: tabular-nums;
        font-weight: var(--tr-font-weight-strong, 600);
        text-align: center;
      }
      :host([unit]) input {
        text-align: end;
      }
      .unit {
        flex: none;
        font-size: 0.85em;
        color: var(--tr-color-ink-muted);
      }
      .key {
        --_tr-z: 1;
        --_curve: 0.35;
        flex: none;
        display: grid;
        place-items: center;
        width: calc(var(--_h) - 0.4em);
        height: calc(var(--_h) - 0.4em);
        padding: 0;
        border-radius: calc(var(--tr-radius-md, 10px) - 0.2em);
        font: inherit;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          opacity var(--tr-motion-duration-release, 160ms);
      }
      .key:hover {
        --_tr-z: 1.5;
      }
      .key:active,
      .key[data-held] {
        --_tr-z: -1;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
        transition-timing-function: var(--tr-motion-easing-press, ease-in);
      }
      .key:disabled {
        --_tr-z: 0;
        opacity: 0.45;
        cursor: default;
        translate: none;
      }
      .key svg {
        width: 0.9em;
        height: 0.9em;
      }
      .hint {
        font-size: 0.8125em;
        line-height: 1.35;
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      @media (pointer: coarse) {
        .field {
          min-height: max(var(--_h), var(--tr-control-touch, 44px));
        }
        .key {
          width: max(calc(var(--_h) - 0.4em), 2.5em);
          height: max(calc(var(--_h) - 0.4em), 2.5em);
        }
      }
      @media (forced-colors: active) {
        .field {
          border-color: FieldText;
          background: Field;
        }
        .key {
          border: 1px solid ButtonText;
        }
      }
    `,
  ];

  /** Visible label. Also the accessible name of the field. */
  @property({ reflect: true }) label = '';

  /** Current value. */
  @property({ type: Number }) value = 0;

  /** Smallest allowed value. */
  @property({ type: Number, reflect: true }) min?: number;

  /** Largest allowed value. */
  @property({ type: Number, reflect: true }) max?: number;

  /** Step of the keys and arrow keys; committed values snap to it (from `min`, or 0). */
  @property({ type: Number, reflect: true }) step = 1;

  /** Unit shown after the number, e.g. "kg" or "×". Also read after the value. */
  @property({ reflect: true }) unit = '';

  /** Size of the field. */
  @property({ reflect: true }) size: Size = 'md';

  /** Help text under the field. Or use the `hint` slot. */
  @property({ reflect: true }) hint = '';

  /** Shows the value but does not let the user change it. */
  @property({ type: Boolean, reflect: true }) readonly = false;

  /** Accessible name forwarded to the inner field when there is no visible label. */
  @property({ attribute: 'aria-label', reflect: false }) accessibleLabel: string | null = null;

  @query('input') private input!: HTMLInputElement;
  @query('.readout') private readout!: HTMLElement;

  private defaultValue: number | null = null;
  private draft: string | null = null;
  private repeat?: ReturnType<typeof setTimeout>;
  private hasHintSlot = false;

  constructor() {
    super();
    this.hostFocusable = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopRepeat();
  }

  /** Clamps and snaps a number to min, max and step. */
  snap(n: number): number {
    if (!Number.isFinite(n)) n = this.min ?? 0;
    const base = this.min ?? 0;
    const step = this.step > 0 ? this.step : 1;
    const places = Math.max(decimals(step), decimals(base));
    n = base + Math.round((n - base) / step) * step;
    n = Number(n.toFixed(places));
    if (this.min !== undefined) n = Math.max(this.min, n);
    if (this.max !== undefined) n = Math.min(this.max, n);
    return n;
  }

  /** Moves the value by `count` steps, as the keys do. */
  stepBy(count: number): void {
    if (this.isDisabled || this.readonly) return;
    const next = this.snap(this.current() + count * (this.step > 0 ? this.step : 1));
    if (next === this.value && this.draft === null) return;
    this.draft = null;
    const dir = Math.sign(next - this.value);
    this.value = next;
    this.roll(dir);
    this.emit('input');
    this.emit('change');
  }

  private current(): number {
    if (this.draft === null) return this.value;
    const n = Number(this.draft.replace(',', '.'));
    return Number.isFinite(n) ? n : this.value;
  }

  /** The digits slide in from the direction of travel. */
  private roll(dir: number): void {
    if (!dir || !this.readout?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.readout.animate(
      [
        { transform: `translateY(${dir > 0 ? 0.45 : -0.45}em)`, opacity: 0.35 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.internals.setFormValue(String(this.value));
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? 0;
    this.draft = null;
  }

  formStateRestoreCallback(state: string): void {
    this.value = Number(state);
  }

  private onInput = (e: Event): void => {
    e.stopPropagation(); // re-dispatched below with the parsed value in place
    this.draft = this.input.value;
    const n = Number(this.draft.replace(',', '.'));
    if (this.draft.trim() !== '' && Number.isFinite(n)) {
      this.value = n;
      this.emit('input');
    }
  };

  private commit = (): void => {
    if (this.draft === null) return;
    // a typed value was already reported by input events; committing clamps, snaps and confirms it
    this.value = this.snap(this.current());
    this.draft = null;
    this.requestUpdate();
    this.emit('change');
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const big = Math.max(1, Math.round(((this.max ?? 100) - (this.min ?? 0)) / (this.step || 1) / 10));
    const map: Record<string, () => void> = {
      ArrowUp: () => this.stepBy(1),
      ArrowDown: () => this.stepBy(-1),
      PageUp: () => this.stepBy(big),
      PageDown: () => this.stepBy(-big),
      Home: () => this.min !== undefined && this.stepBy((this.min - this.value) / (this.step || 1)),
      End: () => this.max !== undefined && this.stepBy((this.max - this.value) / (this.step || 1)),
      Enter: () => this.commit(),
    };
    const fn = map[e.key];
    if (!fn) return;
    if (e.key !== 'Enter') e.preventDefault();
    fn();
  };

  private startRepeat(dir: number, e: PointerEvent): void {
    if (e.button !== 0) return;
    const key = e.currentTarget as HTMLElement;
    key.setAttribute('data-held', '');
    key.setPointerCapture?.(e.pointerId);
    this.stepBy(dir);
    const tick = (delay: number) => {
      this.repeat = setTimeout(() => {
        this.stepBy(dir);
        tick(Math.max(45, delay * 0.85));
      }, delay);
    };
    this.repeat = setTimeout(() => tick(90), 420);
    const stop = () => {
      key.removeAttribute('data-held');
      this.stopRepeat();
      key.removeEventListener('pointerup', stop);
      key.removeEventListener('pointercancel', stop);
      this.input?.focus({ preventScroll: true });
    };
    key.addEventListener('pointerup', stop);
    key.addEventListener('pointercancel', stop);
  }

  private stopRepeat(): void {
    clearTimeout(this.repeat);
    this.repeat = undefined;
  }

  private onSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedNodes().length > 0;
    this.requestUpdate();
  };

  protected override render() {
    const name = this.label ? undefined : (this.accessibleLabel ?? undefined);
    const atMin = this.min !== undefined && this.value <= this.min;
    const atMax = this.max !== undefined && this.value >= this.max;
    const off = this.isDisabled || this.readonly;
    const hasHint = Boolean(this.hint) || this.hasHintSlot;
    const shown = this.draft ?? String(this.value);
    const minus = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`;
    const plus = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`;
    return html`
      <label part="label" class="label" for="input" ?hidden=${!this.label}>${this.label}</label>
      <div part="field" class="field surface">
        <button
          part="decrement"
          class="key surface"
          type="button"
          tabindex="-1"
          aria-label="Decrease"
          ?disabled=${off || atMin}
          @pointerdown=${(e: PointerEvent) => this.startRepeat(-1, e)}
        >
          ${minus}
        </button>
        <span class="readout">
          <input
            part="input"
            id="input"
            role="spinbutton"
            inputmode=${(this.step % 1 !== 0 || (this.min ?? 0) % 1 !== 0) ? 'decimal' : 'numeric'}
            autocomplete="off"
            .value=${live(shown)}
            ?disabled=${this.isDisabled}
            ?readonly=${this.readonly}
            aria-label=${ifDefined(name)}
            aria-valuenow=${this.value}
            aria-valuemin=${ifDefined(this.min)}
            aria-valuemax=${ifDefined(this.max)}
            aria-valuetext=${this.unit ? `${this.value} ${this.unit}` : nothing}
            aria-describedby=${hasHint ? 'hint' : nothing}
            @input=${this.onInput}
            @change=${(e: Event) => e.stopPropagation()}
            @blur=${this.commit}
            @keydown=${this.onKeyDown}
          />
          <span part="unit" class="unit" aria-hidden="true" ?hidden=${!this.unit}>${this.unit}</span>
        </span>
        <button
          part="increment"
          class="key surface"
          type="button"
          tabindex="-1"
          aria-label="Increase"
          ?disabled=${off || atMax}
          @pointerdown=${(e: PointerEvent) => this.startRepeat(1, e)}
        >
          ${plus}
        </button>
      </div>
      <div part="hint" id="hint" class="hint" ?hidden=${!hasHint}><slot name="hint" @slotchange=${this.onSlotChange}>${this.hint}</slot></div>
    `;
  }
}

define('tr-number-field', TrNumberField);

declare global {
  interface HTMLElementTagNameMap {
    'tr-number-field': TrNumberField;
  }
}
