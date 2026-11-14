import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from './form-control.js';

/**
 * Shared value model and keyboard behaviour for continuous controls (slider, knob), following the
 * WAI-ARIA APG slider pattern: arrows step, Page Up/Down step by 10%, Home/End jump to the ends.
 */
export class RangeControl extends FormControl {
  /** Current value, clamped to [min, max] and snapped to step. */
  @property({ type: Number }) value = 0;

  /** Lowest value. */
  @property({ type: Number, reflect: true }) min = 0;

  /** Highest value. */
  @property({ type: Number, reflect: true }) max = 100;

  /** Granularity. Use 0 or "any" for continuous values. */
  @property({ type: Number, reflect: true }) step = 1;

  /** Accessible name when there is no visible label or aria-label. Also shown as the visible label. */
  @property({ reflect: true }) label = '';

  /** Unit appended to the value for screen readers and the readout, e.g. "%" or " dB". */
  @property({ reflect: true }) unit = '';

  /** Number of tick marks to draw along the travel, 0 for none. */
  @property({ type: Number, reflect: true }) ticks = 0;

  private defaultValue: number | null = null;
  protected dragging = false;

  constructor() {
    super();
    this.role_ = 'slider';
    this.addEventListener('keydown', this.onRangeKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  /** Value as a 0..1 fraction of the range. */
  get fraction(): number {
    const span = this.max - this.min;
    return span > 0 ? (this.clamp(this.value) - this.min) / span : 0;
  }

  /** Human-readable value, used for aria-valuetext and the readout. */
  get valueText(): string {
    const decimals = this.step > 0 && this.step < 1 ? String(this.step).split('.')[1]?.length ?? 0 : 0;
    return `${this.clamp(this.value).toFixed(decimals)}${this.unit}`;
  }

  protected clamp(v: number): number {
    if (!Number.isFinite(v)) v = this.min;
    v = Math.min(this.max, Math.max(this.min, v));
    if (this.step > 0) {
      v = this.min + Math.round((v - this.min) / this.step) * this.step;
      v = Math.min(this.max, Math.max(this.min, v));
      v = Number(v.toFixed(10));
    }
    return v;
  }

  /** Sets the value from user interaction, firing input (and change unless more input follows). */
  protected setFromUser(v: number, commit: boolean): void {
    const next = this.clamp(v);
    if (next !== this.value) {
      this.value = next;
      this.emit('input');
      this.pendingChange = true;
    }
    if (commit && this.pendingChange) {
      this.pendingChange = false;
      this.emit('change');
    }
  }
  private pendingChange = false;

  protected commitDrag(): void {
    if (this.pendingChange) {
      this.pendingChange = false;
      this.emit('change');
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('value') || changed.has('min') || changed.has('max') || changed.has('step')) {
      const v = this.clamp(this.value);
      if (v !== this.value) this.value = v;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-valuemin', String(this.min));
    this.aria('aria-valuemax', String(this.max));
    this.aria('aria-valuenow', String(this.value));
    this.aria('aria-valuetext', this.valueText);
    // The label attribute names the slider unless the author gave aria-label / aria-labelledby.
    if (changed.has('label') && !this.hasAttribute('aria-labelledby')) {
      if (this.label) this.aria('aria-label', this.label);
      else if (changed.get('label')) this.aria('aria-label', null);
    }
    this.internals.setFormValue(String(this.value));
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? this.min;
  }

  formStateRestoreCallback(state: string): void {
    this.value = Number(state);
  }

  /** Increases the value by `steps` steps (default 1). */
  stepUp(steps = 1): void {
    this.value = this.clamp(this.value + this.keyStep * steps);
  }

  /** Decreases the value by `steps` steps (default 1). */
  stepDown(steps = 1): void {
    this.value = this.clamp(this.value - this.keyStep * steps);
  }

  private get keyStep(): number {
    return this.step > 0 ? this.step : (this.max - this.min) / 100;
  }

  /** Direction keys that increase the value. Vertical sliders and knobs use Up/Right. */
  private onRangeKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this || this.isDisabled) return;
    const big = Math.max(this.keyStep, (this.max - this.min) / 10);
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = this.value + this.keyStep;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = this.value - this.keyStep;
        break;
      case 'PageUp':
        next = this.value + big;
        break;
      case 'PageDown':
        next = this.value - big;
        break;
      case 'Home':
        next = this.min;
        break;
      case 'End':
        next = this.max;
        break;
    }
    if (next === null) return;
    event.preventDefault();
    this.setFromUser(next, true);
  };
}
