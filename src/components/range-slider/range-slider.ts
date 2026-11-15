import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import { crossfadeText } from '../../interaction/smooth.js';
import type { Size } from '../../internal/types.js';

type Thumb = 'low' | 'high';

/**
 * A range slider: two fader caps in one recessed slot, with the lit fill running between them.
 * For a price range, a time window or any "from … to …" filter. Each cap is its own slider for
 * keyboards and screen readers ("Minimum price", "Maximum price"); pressing the slot moves the
 * nearer cap there and keeps dragging it. Caps never cross: one stops `min-gap` short of the other.
 * Keys and code glide the caps and cross-fade the readout; dragging follows the hand directly.
 *
 * In a form it submits two entries under `name`, low then high (`formData.getAll('price')` gives
 * `['280', '620']`). `value` reads and writes both as "low,high".
 *
 * @summary Two-handle range slider (two role="slider" caps in a group), form-associated.
 * @tag tr-range-slider
 * @role group
 *
 * @csspart header - Row holding the label and the readout.
 * @csspart label - The visible label.
 * @csspart value - The readout, e.g. "€280 – €620".
 * @csspart groove - The recessed slot.
 * @csspart fill - The lit part of the slot between the caps.
 * @csspart thumb - Both caps.
 * @csspart thumb-low - The minimum cap.
 * @csspart thumb-high - The maximum cap.
 * @csspart ticks - The tick marks.
 *
 * @cssprop --tr-slider-fill-color - Fill color. Defaults to --tr-color-accent.
 * @cssprop --tr-slider-groove-width - Width of the slot. Defaults by size (0.3em to 0.45em).
 * @cssprop --tr-slider-cap-length - Size of a cap along the travel. Defaults by size (1em to 1.6em).
 * @cssprop --tr-slider-cap-width - Size of a cap across the travel. Defaults by size (1.6em to 2.5em).
 * @cssprop --tr-slider-cap-radius - Corner radius of the caps. Defaults to 0.18em.
 * @cssprop --tr-slider-cap-color - Cap color. Defaults to the material's base color.
 * @cssprop --tr-slider-cap-line-color - Color of the grip line across each cap. Defaults to the cap's ink.
 * @cssprop --tr-slider-dish - Depth of the dished cap tops, 0 (flat) to 1. Defaults to 1.
 *
 * @fires input - The low or high value changed during interaction.
 * @fires change - The user committed a new range (pointer released or key pressed).
 *
 * @example <tr-range-slider label="Price" min="0" max="1000" step="10" low="280" high="620" currency="EUR"></tr-range-slider>
 * @example <tr-range-slider label="Departure" min="0" max="24" low="6" high="18" unit=":00" min-gap="2" ticks="5"></tr-range-slider>
 */
export class TrRangeSlider extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_depth: 2;
        --_groove: var(--tr-slider-groove-width, 0.36em);
        --_cap-l: var(--tr-slider-cap-length, 1.3em);
        --_cap-w: var(--tr-slider-cap-width, 2em);
        --_fill: var(--tr-slider-fill-color, var(--tr-color-accent));
        --_glide: var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.2, 0.8, 0.2, 1);
        display: block;
        min-width: 10em;
        font-size: var(--tr-font-size-md, 1em);
        user-select: none;
        -webkit-user-select: none;
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([size='sm']) {
        --_groove: var(--tr-slider-groove-width, 0.3em);
        --_cap-l: var(--tr-slider-cap-length, 1em);
        --_cap-w: var(--tr-slider-cap-width, 1.6em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_groove: var(--tr-slider-groove-width, 0.45em);
        --_cap-l: var(--tr-slider-cap-length, 1.6em);
        --_cap-w: var(--tr-slider-cap-width, 2.5em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75em;
        margin-bottom: 0.5em;
        line-height: 1.3;
      }
      .value {
        display: inline-block;
        text-align: end;
        white-space: nowrap;
        font-family: var(--tr-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .track {
        position: relative;
        height: max(var(--_cap-w), var(--tr-control-sm, 2.25em));
        cursor: pointer;
        touch-action: pan-y pinch-zoom;
      }

      /* ---------- the slot and the fill between the caps ---------- */
      .groove {
        --_tr-z: -2;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: var(--_groove);
        translate: 0 -50%;
        border-radius: var(--tr-radius-pill, 999px);
        overflow: hidden;
      }
      .fill {
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(var(--_cap-l) / 2 + var(--_lo) * (100% - var(--_cap-l)));
        width: calc((var(--_hi) - var(--_lo)) * (100% - var(--_cap-l)));
        background: var(--_fill);
        box-shadow:
          inset 0 calc(var(--_r) * 0.12em) calc(var(--_r) * 0.18em) color-mix(in oklch, var(--tr-color-shadow) calc(var(--_r) * 50%), transparent),
          0 0 calc(var(--_r) * 0.3em) color-mix(in oklch, var(--_fill) calc(var(--_r) * 60%), transparent);
        transition:
          left var(--_glide),
          width var(--_glide);
      }

      /* ---------- the caps (as tr-slider) ---------- */
      .thumb {
        --_tr-z: var(--_depth);
        --_base: var(--tr-slider-cap-color, var(--_m-base));
        --_curve: 0;
        --_brush: 0;
        --_spin: 0;
        --_dish: var(--tr-slider-dish, 1);
        --_axis: 90deg;
        --_k: var(--_sx);
        --_kp: max(0, var(--_k));
        --_kn: max(0, -1 * var(--_k));
        position: absolute;
        top: 50%;
        left: calc(var(--_f) * (100% - var(--_cap-l)));
        width: var(--_cap-l);
        height: var(--_cap-w);
        translate: 0 -50%;
        border-radius: var(--tr-slider-cap-radius, 0.18em);
        cursor: grab;
        outline: none;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms),
          left var(--_glide);
        --_layer:
          linear-gradient(
            var(--_axis),
            color-mix(in oklab, var(--_hl) calc(var(--_kp) * var(--_r) * 80%), transparent) 0%,
            color-mix(in oklab, var(--_hl) calc(var(--_kp) * var(--_r) * 30%), transparent) 21%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_dish) * var(--_r) * 55%), transparent) 23%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_dish) * var(--_r) * 12%), transparent) 45%,
            color-mix(in oklab, var(--_hl) calc(var(--_kp) * var(--_dish) * var(--_r) * 10%), transparent) 60%,
            color-mix(in oklab, var(--_hl) calc(var(--_kp) * var(--_dish) * var(--_r) * 50%), transparent) 76%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_r) * 30%), transparent) 78%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_r) * 60%), transparent) 100%
          ),
          linear-gradient(
            var(--_axis),
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_r) * 60%), transparent) 0%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_r) * 30%), transparent) 22%,
            color-mix(in oklab, var(--_hl) calc(var(--_kn) * var(--_dish) * var(--_r) * 50%), transparent) 24%,
            color-mix(in oklab, var(--_hl) calc(var(--_kn) * var(--_dish) * var(--_r) * 10%), transparent) 40%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_dish) * var(--_r) * 12%), transparent) 55%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_dish) * var(--_r) * 55%), transparent) 77%,
            color-mix(in oklab, var(--_hl) calc(var(--_kn) * var(--_r) * 30%), transparent) 79%,
            color-mix(in oklab, var(--_hl) calc(var(--_kn) * var(--_r) * 80%), transparent) 100%
          ),
          linear-gradient(
            calc(var(--_axis) + 90deg),
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 18%), transparent) 0%,
            transparent 12%,
            transparent 88%,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 24%), transparent) 100%
          );
      }
      .thumb::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 8%;
        bottom: 8%;
        width: max(1.5px, 0.12em);
        translate: -50% 0;
        border-radius: 1px;
        background: var(--tr-slider-cap-line-color, var(--_ink));
        box-shadow: calc(var(--_sx) * 0.5px) calc(var(--_sy) * 0.5px) 0 color-mix(in oklab, var(--tr-color-highlight) calc(var(--_r) * 35%), transparent);
      }
      .thumb.top {
        z-index: 1;
      }
      .thumb:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 3px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .thumb.held {
        --_tr-z: calc(var(--_depth) + 1);
        cursor: grabbing;
      }
      /* while dragged the caps and fill follow the hand directly */
      :host([data-dragging]) .thumb {
        transition: --_tr-z var(--tr-motion-duration-release, 160ms);
      }
      :host([data-dragging]) .fill {
        transition: none;
      }

      /* ---------- ticks ---------- */
      .ticks {
        position: relative;
        height: 0.4em;
        margin: 0.15em calc(var(--_cap-l) / 2) 0;
      }
      .tick {
        position: absolute;
        top: 0;
        left: var(--_p);
        width: 1px;
        height: 100%;
        translate: -50% 0;
        background: color-mix(in oklch, currentColor 60%, transparent);
      }

      /* ---------- states ---------- */
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
        cursor: not-allowed;
      }
      :host([disabled]) .track,
      :host(:state(disabled)) .track {
        pointer-events: none;
      }
      @media (pointer: coarse) {
        .track {
          height: max(var(--_cap-w), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        .fill {
          background: Highlight;
          forced-color-adjust: none;
        }
        .thumb {
          background: ButtonText;
          forced-color-adjust: none;
        }
        .thumb:focus-visible {
          outline-color: Highlight;
        }
        .tick {
          background: CanvasText;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Lowest selectable value. */
  @property({ type: Number, reflect: true }) min = 0;

  /** Highest selectable value. */
  @property({ type: Number, reflect: true }) max = 100;

  /** Granularity. Use 0 for continuous values. */
  @property({ type: Number, reflect: true }) step = 1;

  /** Start of the range (the minimum cap). */
  @property({ type: Number }) low = 0;

  /** End of the range (the maximum cap). */
  @property({ type: Number }) high = 100;

  /** Smallest distance kept between the caps. Default 0 (they may meet). */
  @property({ type: Number, attribute: 'min-gap', reflect: true }) minGap = 0;

  /** Visible label and the base of each cap's name ("Minimum price", "Maximum price"). */
  @property({ reflect: true }) label = '';

  /** Unit written after each value, e.g. "%" or " km". */
  @property({ reflect: true }) unit = '';

  /** Format values as money in this ISO currency, e.g. `currency="EUR"` gives "€280 – €620". */
  @property({ reflect: true }) currency = '';

  /** Number of tick marks along the travel, 0 for none. */
  @property({ type: Number, reflect: true }) ticks = 0;

  /** Hides the readout next to the label. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-value' }) hideValue = false;

  /** Size of the slot and caps. */
  @property({ reflect: true }) size: Size = 'md';

  /** The cap being dragged. */
  @state() private held: Thumb | null = null;

  /** The cap last moved, drawn on top when they meet. */
  @state() private last: Thumb = 'high';

  private defaults: [number, number] | null = null;
  private shownText = '';
  private grab = 0;
  private pendingChange = false;

  constructor() {
    super();
    this.role_ = 'group';
    this.hostFocusable = false;
  }

  /** Both values as "low,high". Setting it moves both caps. */
  get value(): string {
    return `${this.low},${this.high}`;
  }
  set value(v: string) {
    const [a, b] = String(v ?? '')
      .split(/[,/]/)
      .map((x) => Number(x.trim()));
    if (Number.isFinite(a)) this.low = a!;
    if (Number.isFinite(b)) this.high = b!;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.defaults) {
      if (!this.hasAttribute('low') && this.low === 0 && this.min > 0) this.low = this.min;
      if (!this.hasAttribute('high') && this.high === 100 && this.max !== 100) this.high = this.max;
      this.defaults = [this.low, this.high];
    }
  }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'value'];
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name === 'value' && value !== null) {
      this.value = value;
      return;
    }
    super.attributeChangedCallback(name, old, value);
  }

  /** The value as a 0..1 fraction of the travel. */
  private frac(v: number): number {
    const span = this.max - this.min;
    return span > 0 ? (v - this.min) / span : 0;
  }

  private snap(v: number): number {
    if (!Number.isFinite(v)) v = this.min;
    v = Math.min(this.max, Math.max(this.min, v));
    if (this.step > 0) {
      v = this.min + Math.round((v - this.min) / this.step) * this.step;
      v = Math.min(this.max, Math.max(this.min, v));
      v = Number(v.toFixed(10));
    }
    return v;
  }

  private get gap(): number {
    return Math.max(0, Math.min(this.minGap || 0, this.max - this.min));
  }

  /** Keeps min ≤ low ≤ high - gap ≤ max, moving the cap that was not just set. */
  private normalise(moved: Thumb = 'high'): void {
    let lo = this.snap(this.low);
    let hi = this.snap(this.high);
    const gap = this.gap;
    if (hi - lo < gap) {
      if (moved === 'low') lo = Math.max(this.min, hi - gap);
      else hi = Math.min(this.max, lo + gap);
      // pressed against an end: the other cap gives way instead
      if (hi - lo < gap) {
        if (moved === 'low') hi = Math.min(this.max, lo + gap);
        else lo = Math.max(this.min, hi - gap);
      }
    }
    if (lo !== this.low) this.low = lo;
    if (hi !== this.high) this.high = hi;
  }

  private format(v: number): string {
    const decimals = this.step > 0 && this.step < 1 ? String(this.step).split('.')[1]?.length ?? 0 : 0;
    if (this.currency) {
      try {
        return (
          new Intl.NumberFormat(undefined, { style: 'currency', currency: this.currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) +
          this.unit
        );
      } catch {
        /* unknown currency: plain number */
      }
    }
    return `${v.toFixed(decimals)}${this.unit}`;
  }

  /** The readout, e.g. "€280 – €620". */
  get valueText(): string {
    return `${this.format(this.low)} – ${this.format(this.high)}`;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (['low', 'high', 'min', 'max', 'step', 'minGap'].some((k) => changed.has(k as keyof this))) {
      this.normalise(changed.has('low') && !changed.has('high') ? 'low' : 'high');
    }
  }

  protected override render() {
    const showHeader = this.label || !this.hideValue;
    const n = this.ticks > 1 ? Math.round(this.ticks) : 0;
    const off = this.isDisabled;
    const name = this.label || this.getAttribute('aria-label') || '';
    const lowTop = this.last === 'low' || this.frac(this.low) > 0.5;
    const cap = (which: Thumb) => {
      const v = which === 'low' ? this.low : this.high;
      const lo = which === 'low' ? this.min : this.low + this.gap;
      const hi = which === 'low' ? this.high - this.gap : this.max;
      return html`<div
        part="thumb thumb-${which}"
        class="thumb surface ${which} ${this.held === which ? 'held' : ''} ${(which === 'low') === lowTop ? 'top' : ''}"
        role="slider"
        tabindex=${off ? -1 : 0}
        aria-label=${`${which === 'low' ? 'Minimum' : 'Maximum'}${name ? ` ${name.charAt(0).toLowerCase()}${name.slice(1)}` : ''}`}
        aria-valuemin=${String(this.snap(lo))}
        aria-valuemax=${String(this.snap(hi))}
        aria-valuenow=${String(v)}
        aria-valuetext=${this.format(v)}
        aria-orientation="horizontal"
        aria-disabled=${off ? 'true' : 'false'}
        style=${styleMap({ '--_f': String(this.frac(v)) })}
        data-thumb=${which}
        @keydown=${this.onKey}
        @focus=${() => (this.last = which)}
      ></div>`;
    };
    return html`
      ${showHeader
        ? html`<div part="header" class="header">
            <span part="label" class="label">${this.label}</span>
            ${this.hideValue ? nothing : html`<span part="value" class="value" aria-hidden="true">${this.valueText}</span>`}
          </div>`
        : nothing}
      <div
        class="track"
        style=${styleMap({ '--_lo': String(this.frac(this.low)), '--_hi': String(this.frac(this.high)) })}
        @pointerdown=${this.onDown}
        @pointermove=${this.onMove}
        @pointerup=${this.onUp}
        @pointercancel=${this.onUp}
        @lostpointercapture=${this.onUp}
      >
        <div part="groove" class="groove surface"><div part="fill" class="fill"></div></div>
        ${cap('low')} ${cap('high')}
      </div>
      ${n
        ? html`<div part="ticks" class="ticks" aria-hidden="true">
            ${Array.from({ length: n }, (_, i) => html`<span class="tick" style=${styleMap({ '--_p': `${(i / (n - 1)) * 100}%` })}></span>`)}
          </div>`
        : nothing}
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label') && !this.hasAttribute('aria-labelledby')) {
      if (this.label) this.aria('aria-label', this.label);
      else if (changed.get('label')) this.aria('aria-label', null);
    }
    const name = this.name;
    if (name && !this.isDisabled) {
      const fd = new FormData();
      fd.append(name, String(this.low));
      fd.append(name, String(this.high));
      this.internals.setFormValue(fd, this.value);
    } else {
      this.internals.setFormValue(null);
    }
    // The readout keeps the width of its widest text, and cross-fades unless the hand moves it.
    const readout = this.renderRoot.querySelector<HTMLElement>('[part~="value"]');
    if (readout) {
      const widest = Math.max(this.format(this.min).length, this.format(this.max).length);
      readout.style.minWidth = `${widest * 2 + 3}ch`;
      const text = readout.textContent ?? '';
      if (this.shownText && text !== this.shownText && !this.held) crossfadeText(readout, this.shownText, { duration: 160 });
      this.shownText = text;
    }
  }

  // ---------- keyboard (per cap, as the APG slider) ----------

  private onKey = (e: KeyboardEvent): void => {
    if (this.isDisabled) return;
    const which = (e.currentTarget as HTMLElement).dataset.thumb as Thumb;
    const v = which === 'low' ? this.low : this.high;
    const step = this.step > 0 ? this.step : (this.max - this.min) / 100;
    const big = Math.max(step, (this.max - this.min) / 10);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = v + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = v - step;
        break;
      case 'PageUp':
        next = v + big;
        break;
      case 'PageDown':
        next = v - big;
        break;
      case 'Home':
        next = this.min;
        break;
      case 'End':
        next = this.max;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    this.setThumb(which, next);
    this.commit();
  };

  /** Moves one cap from user input, stopping short of the other. */
  private setThumb(which: Thumb, v: number): void {
    this.last = which;
    const gap = this.gap;
    let next = this.snap(v);
    if (which === 'low') next = Math.min(next, this.high - gap);
    else next = Math.max(next, this.low + gap);
    next = this.snap(next);
    if (which === 'low' && next > this.high - gap) next = this.low;
    if (which === 'high' && next < this.low + gap) next = this.high;
    const cur = which === 'low' ? this.low : this.high;
    if (next === cur) return;
    if (which === 'low') this.low = next;
    else this.high = next;
    this.pendingChange = true;
    this.emit('input');
  }

  private commit(): void {
    if (!this.pendingChange) return;
    this.pendingChange = false;
    this.emit('change');
  }

  // ---------- pointer ----------

  private valueAt(x: number): number {
    const track = this.renderRoot.querySelector<HTMLElement>('.track')!;
    const cap = this.renderRoot.querySelector<HTMLElement>('.thumb')!;
    const r = track.getBoundingClientRect();
    const c = cap.getBoundingClientRect().width;
    const t = (x - r.left - c / 2) / Math.max(1, r.width - c);
    return this.min + Math.min(1, Math.max(0, t)) * (this.max - this.min);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.isDisabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const target = (e.composedPath()[0] as HTMLElement).closest?.('.thumb') as HTMLElement | null;
    const at = this.valueAt(e.clientX);
    let which: Thumb;
    if (target) {
      which = target.dataset.thumb as Thumb;
      // grabbing a cap never makes it jump: keep the offset from its centre
      this.grab = (which === 'low' ? this.low : this.high) - at;
    } else {
      const dl = Math.abs(at - this.low);
      const dh = Math.abs(at - this.high);
      which = dl < dh ? 'low' : dh < dl ? 'high' : at < this.low ? 'low' : 'high';
      this.grab = 0;
    }
    e.preventDefault();
    this.held = which;
    this.toggleAttribute('data-dragging', true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.renderRoot.querySelector<HTMLElement>(`.thumb.${which}`)?.focus({ preventScroll: true });
    // a press on the slot glides the cap there; from then on it follows the hand
    if (!target) {
      this.removeAttribute('data-dragging');
      this.setThumb(which, at);
      requestAnimationFrame(() => this.held && this.toggleAttribute('data-dragging', true));
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.held) return;
    this.toggleAttribute('data-dragging', true);
    this.setThumb(this.held, this.valueAt(e.clientX) + this.grab);
  };

  private onUp = (): void => {
    if (!this.held) return;
    this.held = null;
    this.removeAttribute('data-dragging');
    this.commit();
  };

  // ---------- forms ----------

  formResetCallback(): void {
    if (this.defaults) [this.low, this.high] = this.defaults;
  }

  formStateRestoreCallback(state: string | FormData | null): void {
    if (typeof state === 'string') this.value = state;
  }
}

define('tr-range-slider', TrRangeSlider);

declare global {
  interface HTMLElementTagNameMap {
    'tr-range-slider': TrRangeSlider;
  }
}
