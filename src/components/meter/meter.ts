import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Orientation } from '../../internal/types.js';

const toNumbers = (s: string | null): number[] =>
  (s ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .map((n) => (Number.isFinite(n) ? n : 0));

/**
 * A segmented LED meter behind a smoked window: a VU/level bar (`mode="bar"`) or a multi-band
 * spectrum analyzer (`mode="spectrum"`). Segments switch through green, amber and red zones,
 * unlit segments stay visible as dark tinted diffusers, lit ones bleed light into their
 * neighbours, and optional peak-hold markers hang at the recent maximum and then fall.
 *
 * Built to be driven every animation frame: setting `value` or `values` writes one custom
 * property per band (only when a segment boundary is crossed), so no Lit render, layout or
 * per-segment DOM is involved, and ARIA updates are throttled.
 *
 * Inside a `<tr-display>` the window disappears and the segments take the display's emissive
 * ink (inherited --tr-display-ink / --tr-display-ghost), so a spectrum on an LCD looks printed in
 * the same liquid crystal.
 *
 * @summary Segmented LED level meter (role="meter") or spectrum analyzer (role="img").
 * @tag tr-meter
 * @role meter
 *
 * @csspart window - The recessed smoked window holding the segments.
 * @csspart band - One column (spectrum) or the single bar.
 * @csspart peak - A peak-hold marker.
 *
 * @cssprop --tr-meter-color-low - Lit color of the safe zone. Default green.
 * @cssprop --tr-meter-color-mid - Lit color of the warning zone. Default amber.
 * @cssprop --tr-meter-color-high - Lit color of the danger zone. Default red.
 * @cssprop --tr-meter-color-off - Color of unlit segments. Defaults to each zone color, darkened.
 * @cssprop --tr-meter-window - Window (background) color. Default smoked black.
 * @cssprop --tr-meter-glow - Light bleed strength, 0 to 2. Default 1 (scaled by realism).
 * @cssprop --tr-meter-length - Length of a bar, or width of a spectrum. Defaults 12em / 16em.
 * @cssprop --tr-meter-thickness - Thickness of a bar. Default 0.75em.
 * @cssprop --tr-meter-height - Height of a spectrum. Default 7em.
 * @cssprop --tr-meter-gap - Gap between segments. Default 0.12em.
 * @cssprop --tr-meter-band-gap - Gap between spectrum bands. Default 0.2em.
 * @cssprop --tr-meter-padding - Window padding. Default 0.3em.
 * @cssprop --tr-meter-radius - Window corner radius. Default 0.35em.
 *
 * @example <tr-meter label="Left" value="0.62"></tr-meter>
 * @example <tr-meter label="Output" min="-48" max="6" warn="-6" danger="0" unit=" dB" value="-12" orientation="vertical" segments="28" peak></tr-meter>
 * @example <tr-meter label="Battery" value="0.15" segments="5" invert></tr-meter>
 * @example <tr-meter mode="spectrum" bands="16" segments="10" peak label="Spectrum"></tr-meter>
 */
export class TrMeter extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_n: 20;
        --_gap: var(--tr-meter-gap, 0.12em);
        --_pad: var(--tr-meter-padding, 0.3em);
        --_glow: calc(var(--tr-meter-glow, 1) * (0.3 + var(--_r) * 0.9));
        --_lo: var(--tr-meter-color-low, oklch(80% 0.25 145));
        --_mid: var(--tr-meter-color-mid, oklch(84% 0.17 78));
        --_hi: var(--tr-meter-color-high, oklch(64% 0.25 27));
        --_lo-off: var(--tr-meter-color-off, oklch(from var(--_lo) calc(l * 0.3) calc(c * 0.45) h));
        --_mid-off: var(--tr-meter-color-off, oklch(from var(--_mid) calc(l * 0.3) calc(c * 0.45) h));
        --_hi-off: var(--tr-meter-color-off, oklch(from var(--_hi) calc(l * 0.34) calc(c * 0.5) h));
        display: inline-block;
        vertical-align: middle;
        width: var(--tr-meter-length, 12em);
        line-height: 0;
      }
      :host([orientation='vertical']) {
        width: auto;
        height: var(--tr-meter-length, 9em);
      }
      :host([mode='spectrum']) {
        width: var(--tr-meter-length, 16em);
        height: var(--tr-meter-height, 7em);
      }
      :host([invert]) {
        --_lo: var(--tr-meter-color-high, oklch(64% 0.25 27));
        --_hi: var(--tr-meter-color-low, oklch(84% 0.22 145));
        --_lo-off: var(--tr-meter-color-off, oklch(from var(--_lo) calc(l * 0.34) calc(c * 0.5) h));
        --_hi-off: var(--tr-meter-color-off, oklch(from var(--_hi) calc(l * 0.3) calc(c * 0.45) h));
      }
      /* inside a display: no window, the display's own liquid crystal / phosphor */
      :host([data-embedded]) {
        --_lo: var(--tr-meter-color-low, var(--tr-display-ink, currentColor));
        --_mid: var(--tr-meter-color-mid, var(--tr-display-ink, currentColor));
        --_hi: var(--tr-meter-color-high, var(--tr-display-ink, currentColor));
        --_lo-off: var(--tr-meter-color-off, var(--tr-display-ghost, transparent));
        --_mid-off: var(--_lo-off);
        --_hi-off: var(--_lo-off);
        --_glow: calc(var(--tr-meter-glow, 1) * var(--tr-display-bloom, 1) * (0.3 + var(--_r) * 0.9));
        --_pad: var(--tr-meter-padding, 0px);
      }
      .window {
        --_tr-z: -2;
        --_base: var(--tr-meter-window, oklch(16% 0.006 260));
        --_edge: var(--_edge-strong);
        display: flex;
        gap: var(--tr-meter-band-gap, 0.2em);
        box-sizing: border-box;
        width: 100%;
        height: calc(var(--tr-meter-thickness, 0.75em) + 2 * var(--_pad));
        padding: var(--_pad);
        border-radius: var(--tr-meter-radius, 0.35em);
        overflow: hidden;
      }
      :host([orientation='vertical']) .window {
        width: calc(var(--tr-meter-thickness, 0.75em) + 2 * var(--_pad));
        height: 100%;
      }
      :host([mode='spectrum']) .window {
        width: 100%;
        height: 100%;
      }
      :host([data-embedded]) .window {
        background: none;
        border: 0;
        box-shadow: none;
        overflow: visible;
      }
      /* smoked acrylic: a soft reflection across the top of the window */
      .window.surface::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 3;
        border-radius: inherit;
        pointer-events: none;
        background:
          linear-gradient(
            calc(var(--tr-light-angle, 330deg) + 180deg),
            oklch(100% 0 0 / calc(var(--_r) * 0.16)) 0%,
            oklch(100% 0 0 / calc(var(--_r) * 0.05)) 42%,
            transparent 42.5%
          );
      }
      .band {
        position: relative;
        flex: 1 1 0;
        min-width: 0;
        --_axis: to right;
        --_cross: to bottom;
        --_v: 0;
        --_pi: -1;
      }
      :host([orientation='vertical']) .band,
      :host([mode='spectrum']) .band {
        --_axis: to top;
        --_cross: to right;
      }
      .off,
      .on,
      .spill {
        position: absolute;
        inset: 0;
      }
      .off,
      .on {
        /* one mask cuts both layers into segments */
        -webkit-mask: repeating-linear-gradient(var(--_axis), #000 0 calc(100% / var(--_n) - var(--_gap)), transparent 0 calc(100% / var(--_n)));
        mask: repeating-linear-gradient(var(--_axis), #000 0 calc(100% / var(--_n) - var(--_gap)), transparent 0 calc(100% / var(--_n)));
      }
      .off {
        background:
          linear-gradient(var(--_cross), oklch(100% 0 0 / calc(var(--_r) * 0.07)), transparent 45%, oklch(0% 0 0 / calc(var(--_r) * 0.25))),
          linear-gradient(var(--_axis), var(--_lo-off) 0 var(--_w1), var(--_mid-off) 0 var(--_w2), var(--_hi-off) 0);
      }
      .on {
        background:
          /* the die is a hot line along the middle of each diffuser */
          linear-gradient(
            var(--_cross),
            oklch(0% 0 0 / calc(var(--_r) * 0.22)),
            oklch(100% 0 0 / calc(var(--_r) * 0.26)) 50%,
            oklch(0% 0 0 / calc(var(--_r) * 0.22))
          ),
          linear-gradient(var(--_axis), var(--_lo) 0 var(--_w1), var(--_mid) 0 var(--_w2), var(--_hi) 0);
      }
      /* light bleeding sideways into the window: a fading band, no blur filter to re-rasterize */
      .spill {
        inset: 0 calc(-0.45em * min(1, var(--_glow)));
        opacity: calc(0.55 * min(1.4, var(--_glow)));
        background: linear-gradient(var(--_axis), var(--_lo) 0 var(--_w1), var(--_mid) 0 var(--_w2), var(--_hi) 0);
        -webkit-mask: linear-gradient(var(--_cross), transparent, #0009 40%, #0009 60%, transparent);
        mask: linear-gradient(var(--_cross), transparent, #0009 40%, #0009 60%, transparent);
      }
      :host(:not([orientation='vertical']):not([mode='spectrum'])) .spill {
        inset: calc(-0.45em * min(1, var(--_glow))) 0;
      }
      .lit {
        position: absolute;
        inset: 0;
        clip-path: inset(calc((1 - var(--_v)) * 100%) -1em -1em -1em);
      }
      :host(:not([orientation='vertical']):not([mode='spectrum'])) .lit {
        clip-path: inset(-1em calc((1 - var(--_v)) * 100%) -1em -1em);
      }
      :host(:not([orientation='vertical']):not([mode='spectrum'])) .band:dir(rtl) .lit {
        clip-path: inset(-1em -1em -1em calc((1 - var(--_v)) * 100%));
      }
      .peak {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: calc(100% / var(--_n) - var(--_gap));
        translate: 0 calc(-1 * var(--_pi) * (100% + var(--_gap)));
        background:
          linear-gradient(var(--_cross), oklch(0% 0 0 / calc(var(--_r) * 0.2)), oklch(100% 0 0 / calc(var(--_r) * 0.4)) 50%, oklch(0% 0 0 / calc(var(--_r) * 0.2))),
          var(--_pc, var(--_lo));
        box-shadow: 0 0 calc(0.35em * var(--_glow)) oklch(from var(--_pc, var(--_lo)) l c h / 0.7);
        opacity: 1;
      }
      :host(:not([orientation='vertical']):not([mode='spectrum'])) .peak {
        top: 0;
        bottom: 0;
        left: 0;
        right: auto;
        height: auto;
        width: calc(100% / var(--_n) - var(--_gap));
        translate: calc(var(--_pi) * (100% + var(--_gap))) 0;
      }
      :host(:not([orientation='vertical']):not([mode='spectrum'])) .band:dir(rtl) .peak {
        left: auto;
        right: 0;
        translate: calc(-1 * var(--_pi) * (100% + var(--_gap))) 0;
      }
      .peak[data-zone='mid'] {
        --_pc: var(--_mid);
      }
      .peak[data-zone='hi'] {
        --_pc: var(--_hi);
      }
      .peak[data-hidden] {
        opacity: 0;
      }
      @media (forced-colors: active) {
        .off {
          forced-color-adjust: none;
          background: Canvas;
          outline: 1px solid GrayText;
        }
        .on,
        .peak {
          forced-color-adjust: none;
          background: Highlight;
          box-shadow: none;
        }
        .spill {
          display: none;
        }
      }
    `,
  ];

  /** bar: one level meter. spectrum: a row of vertical bands driven by `values`. */
  @property({ reflect: true }) mode: 'bar' | 'spectrum' = 'bar';

  /** Direction of a bar. Spectrum bands are always vertical. */
  @property({ reflect: true }) orientation: Orientation = 'horizontal';

  /** Number of segments per bar or band. Defaults to 20 (bar) or 12 (spectrum). */
  @property({ type: Number, reflect: true }) segments?: number;

  /** Number of spectrum bands. Defaults to the length of `values`, or 16. */
  @property({ type: Number, reflect: true }) bands?: number;

  /** Lowest value. */
  @property({ type: Number, reflect: true }) min = 0;

  /** Highest value. */
  @property({ type: Number, reflect: true }) max = 1;

  /** Value where the amber zone starts. Defaults to 70% of the range. */
  @property({ type: Number, reflect: true }) warn?: number;

  /** Value where the red zone starts. Defaults to 90% of the range. */
  @property({ type: Number, reflect: true }) danger?: number;

  /**
   * Reverses the zones for indicators where low is bad (battery, signal, strength): red below
   * `danger`, amber below `warn`, green above. Defaults then become 20% and 40% of the range.
   */
  @property({ type: Boolean, reflect: true }) invert = false;

  /** Shows peak-hold markers that hang at the recent maximum, then fall. */
  @property({ type: Boolean, reflect: true }) peak = false;

  /** How long a peak marker hangs before falling, in ms. */
  @property({ type: Number, attribute: 'peak-hold' }) peakHold = 900;

  /** How fast a released peak falls, in full ranges per second. */
  @property({ type: Number, attribute: 'peak-fall' }) peakFall = 1.2;

  /** Accessible name. Required for a bar (role="meter") unless you set aria-label. */
  @property({ reflect: true }) label = '';

  /** Unit appended to the value for screen readers, e.g. " dB". */
  @property({ reflect: true }) unit = '';

  private _value = 0;
  private _values: number[] = [];
  private bandEls: HTMLElement[] = [];
  private peakEls: HTMLElement[] = [];
  private shownLit: number[] = [];
  private shownPeak: number[] = [];
  private peakVal: number[] = [];
  private peakAt: number[] = [];
  private lastTick = 0;
  private idleTimer = 0;
  private idleRaf = 0;
  private ariaAt = 0;
  private ariaTimer = 0;
  private managedAria = new Set<string>();

  /** Current level of a bar, in [min, max]. Cheap to set every animation frame. */
  @property({ type: Number, noAccessor: true })
  get value(): number {
    return this._value;
  }
  set value(v: number) {
    this._value = Number(v) || 0;
    this.drive();
  }

  /**
   * Spectrum band levels, in [min, max]. Assign a new or the same array every animation frame;
   * as an attribute, a comma or space separated list.
   */
  @property({ noAccessor: true, converter: { fromAttribute: toNumbers } })
  get values(): number[] {
    return this._values;
  }
  set values(v: number[] | string) {
    this._values = typeof v === 'string' ? toNumbers(v) : Array.isArray(v) ? v : [];
    const want = this.bands ?? 0;
    if (this.mode === 'spectrum' && !want && this._values.length !== this.bandEls.length && this.hasUpdated) {
      this.requestUpdate();
    }
    this.drive();
  }

  private get segCount(): number {
    const n = Math.round(this.segments ?? (this.mode === 'spectrum' ? 12 : 20));
    return Math.max(1, Math.min(200, n || 1));
  }

  private get bandCount(): number {
    if (this.mode !== 'spectrum') return 1;
    return Math.max(1, Math.min(256, Math.round(this.bands ?? 0) || this._values.length || 16));
  }

  private frac(v: number): number {
    const span = this.max - this.min;
    if (!(span > 0) || !Number.isFinite(v)) return 0;
    return Math.min(1, Math.max(0, (v - this.min) / span));
  }

  /** Segment index where a zone starts, snapped to whole segments. */
  private zoneStart(threshold: number | undefined, fallback: number): number {
    const f = threshold === undefined || !Number.isFinite(threshold) ? fallback : this.frac(threshold);
    return Math.round(f * this.segCount);
  }

  /** Segment indexes where the second and third zones start. */
  private zones(): [number, number] {
    if (this.invert) {
      const a = this.zoneStart(this.danger, 0.2);
      return [a, Math.max(a, this.zoneStart(this.warn, 0.4))];
    }
    const a = this.zoneStart(this.warn, 0.7);
    return [a, Math.max(a, this.zoneStart(this.danger, 0.9))];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.closest('tr-display')) this.setAttribute('data-embedded', '');
    else this.removeAttribute('data-embedded');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.idleTimer);
    clearTimeout(this.ariaTimer);
    cancelAnimationFrame(this.idleRaf);
  }

  protected override render() {
    const n = this.segCount;
    const [w1, w2] = this.zones();
    const vars = {
      '--_n': String(n),
      '--_w1': `${(w1 / n) * 100}%`,
      '--_w2': `${(w2 / n) * 100}%`,
    };
    const bands = Array.from({ length: this.bandCount });
    return html`<div part="window" class="window surface" style=${styleMap(vars)}>
      ${bands.map(
        () => html`<div part="band" class="band">
          <div class="off"></div>
          <div class="lit"><div class="spill"></div><div class="on"></div></div>
          ${this.peak ? html`<div part="peak" class="peak" data-hidden></div>` : nothing}
        </div>`,
      )}
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.bandEls = [...this.renderRoot.querySelectorAll<HTMLElement>('.band')];
    this.peakEls = [...this.renderRoot.querySelectorAll<HTMLElement>('.peak')];
    this.shownLit = this.bandEls.map(() => -1);
    this.shownPeak = this.bandEls.map(() => -2);
    if (changed.has('mode') || changed.has('label') || changed.has('min') || changed.has('max') || changed.has('unit')) {
      this.syncRole();
    }
    this.drive();
  }

  private setManaged(name: string, value: string): void {
    if (this.getAttribute(name) !== value) this.setAttribute(name, value);
    this.managedAria.add(name);
  }

  private syncRole(): void {
    for (const name of this.managedAria) this.removeAttribute(name);
    this.managedAria.clear();
    const userNamed = this.hasAttribute('aria-label') || this.hasAttribute('aria-labelledby');
    if (this.mode === 'spectrum') {
      this.setManaged('role', 'img');
      if (!userNamed) this.setManaged('aria-label', this.label || 'Spectrum analyzer');
      return;
    }
    this.setManaged('role', 'meter');
    if (this.label && !userNamed) this.setManaged('aria-label', this.label);
    this.setManaged('aria-valuemin', String(this.min));
    this.setManaged('aria-valuemax', String(this.max));
    this.writeAriaValue();
  }

  private writeAriaValue(): void {
    if (this.mode === 'spectrum') return;
    this.ariaAt = performance.now();
    const v = Math.min(this.max, Math.max(this.min, this._value));
    const rounded = Number(v.toFixed(Math.abs(this.max - this.min) <= 2 ? 2 : 1));
    this.setManaged('aria-valuenow', String(rounded));
    if (this.unit) this.setManaged('aria-valuetext', `${rounded}${this.unit}`);
  }

  /** Applies the current value(s) to the bands: called by the setters, cheap to call per frame. */
  private drive(): void {
    if (!this.bandEls.length) return;
    const now = performance.now();
    cancelAnimationFrame(this.idleRaf);
    this.paint(now);
    if (this.peak) {
      clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => this.idle(), 120);
    }
    if (this.mode === 'bar') {
      clearTimeout(this.ariaTimer);
      if (now - this.ariaAt > 250) this.writeAriaValue();
      else this.ariaTimer = window.setTimeout(() => this.writeAriaValue(), 250);
    }
  }

  /** Lets peaks fall on their own when nobody is driving the meter. Stops when they settle. */
  private idle = (): void => {
    if (this.paint(performance.now())) this.idleRaf = requestAnimationFrame(this.idle);
  };

  /** Returns true while a peak marker is still above its level. */
  private paint(now: number): boolean {
    const n = this.segCount;
    const [w1, w2] = this.zones();
    const dt = this.lastTick ? Math.min(0.25, (now - this.lastTick) / 1000) : 0;
    this.lastTick = now;
    let moving = false;
    for (let i = 0; i < this.bandEls.length; i++) {
      const raw = this.mode === 'spectrum' ? this._values[i] ?? this.min : this._value;
      const f = this.frac(raw);
      const lit = Math.round(f * n);
      const band = this.bandEls[i]!;
      if (lit !== this.shownLit[i]) {
        band.style.setProperty('--_v', String(lit / n));
        this.shownLit[i] = lit;
      }
      const peakEl = this.peakEls[i];
      if (!peakEl) continue;
      let p = this.peakVal[i] ?? 0;
      if (f >= p) {
        p = f;
        this.peakAt[i] = now;
      } else if (now - (this.peakAt[i] ?? 0) > this.peakHold) {
        p = Math.max(f, p - this.peakFall * dt);
      }
      this.peakVal[i] = p;
      if (p > f) moving = true;
      const pi = Math.round(p * n) - 1;
      if (pi !== this.shownPeak[i]) {
        this.shownPeak[i] = pi;
        if (pi < 0) peakEl.setAttribute('data-hidden', '');
        else {
          peakEl.removeAttribute('data-hidden');
          peakEl.style.setProperty('--_pi', String(pi));
          const zone = pi >= w2 ? 'hi' : pi >= w1 ? 'mid' : 'lo';
          if (peakEl.dataset.zone !== zone) peakEl.dataset.zone = zone;
        }
      }
    }
    return moving;
  }
}

define('tr-meter', TrMeter);

declare global {
  interface HTMLElementTagNameMap {
    'tr-meter': TrMeter;
  }
}
