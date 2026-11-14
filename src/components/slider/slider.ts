import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { RangeControl } from '../../internal/range-control.js';
import { LinearController } from '../../interaction/linear.js';
import { define } from '../../internal/trompe-element.js';
import type { Orientation, Size } from '../../internal/types.js';

/**
 * A linear fader: a mixing-desk cap riding in a recessed slot. The cap has a dished (concave)
 * top between two chamfered shoulders and a printed grip line, all lit by the scene's light.
 * Drag the cap or click anywhere on the slot; arrow keys, Page Up/Down, Home and End work as in
 * the APG slider pattern. Horizontal sliders fill their container's width; vertical ones have a
 * fixed length and line up side by side in a flex row as a fader bank.
 *
 * @summary Linear slider/fader (role="slider"), form-associated.
 * @tag tr-slider
 * @role slider
 *
 * @csspart header - Row holding the label and the value readout.
 * @csspart label - The visible label.
 * @csspart value - The value readout.
 * @csspart groove - The recessed slot.
 * @csspart fill - The filled part of the slot, from min to the value.
 * @csspart thumb - The fader cap.
 * @csspart ticks - The tick marks.
 * @csspart marks - The printed scale labels (when `marks` is set).
 *
 * @cssprop --tr-slider-fill-color - Fill color. Defaults to --tr-color-accent.
 * @cssprop --tr-slider-length - Length of a vertical slider. Defaults to 11em.
 * @cssprop --tr-slider-groove-width - Width of the slot. Defaults by size (0.3em to 0.45em).
 * @cssprop --tr-slider-cap-length - Size of the cap along the travel. Defaults by size (1em to 1.6em).
 * @cssprop --tr-slider-cap-width - Size of the cap across the travel. Defaults by size (1.6em to 2.5em).
 * @cssprop --tr-slider-cap-radius - Corner radius of the cap. Defaults to 0.18em.
 * @cssprop --tr-slider-cap-color - Cap color. Defaults to the material's base color.
 * @cssprop --tr-slider-cap-line-color - Color of the grip line across the cap. Defaults to the cap's ink.
 * @cssprop --tr-slider-dish - Depth of the dished cap top, 0 (flat) to 1. Defaults to 1.
 *
 * @fires input - The value changed during interaction.
 * @fires change - The user committed a new value (pointer released or key pressed).
 *
 * @example <tr-slider label="Volume" value="60" unit="%"></tr-slider>
 * @example <tr-slider label="Gain" min="-12" max="12" step="0.5" unit=" dB" orientation="vertical" marks="+12,+6,0,-6,-12" material="rubber"></tr-slider>
 * @example <div style="display:flex;gap:1em"><tr-slider orientation="vertical" label="1" hide-value></tr-slider><tr-slider orientation="vertical" label="2" hide-value></tr-slider></div>
 */
export class TrSlider extends RangeControl {
  static override styles = [
    ...RangeControl.styles,
    css`
      :host {
        --_depth: 2;
        --_groove: var(--tr-slider-groove-width, 0.36em);
        --_cap-l: var(--tr-slider-cap-length, 1.3em);
        --_cap-w: var(--tr-slider-cap-width, 2em);
        --_length: var(--tr-slider-length, 11em);
        --_fill: var(--tr-slider-fill-color, var(--tr-color-accent));
        display: block;
        min-width: 8em;
        font-size: var(--tr-font-size-md, 1em);
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
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
      :host([orientation='vertical']) {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        vertical-align: top;
        min-width: 0;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75em;
        margin-bottom: 0.5em;
        line-height: 1.3;
      }
      :host([orientation='vertical']) .header {
        flex-direction: column;
        align-items: center;
        gap: 0.1em;
        text-align: center;
      }
      :host([orientation='vertical']) .label {
        font-size: 0.75em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .value {
        font-family: var(--tr-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      :host([orientation='vertical']) .value {
        font-size: 0.8em;
      }
      .body {
        display: flex;
        flex-direction: column;
      }
      :host([orientation='vertical']) .body {
        flex-direction: row;
        align-items: stretch;
        gap: 0.3em;
      }
      .track {
        position: relative;
        height: max(var(--_cap-w), var(--tr-control-sm, 2.25em));
        cursor: pointer;
        border-radius: var(--tr-radius-sm, 6px);
      }
      :host([orientation='vertical']) .track {
        height: var(--_length);
        width: max(var(--_cap-w), var(--tr-control-sm, 2.25em));
      }

      /* ---------- the slot ---------- */
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
      :host([orientation='vertical']) .groove {
        top: 0;
        bottom: 0;
        left: 50%;
        right: auto;
        width: var(--_groove);
        height: auto;
        translate: -50% 0;
      }
      .fill {
        position: absolute;
        inset: 0 auto 0 0;
        width: calc(var(--_cap-l) / 2 + var(--_f) * (100% - var(--_cap-l)));
        background: var(--_fill);
        box-shadow:
          inset 0 calc(var(--_r) * 0.12em) calc(var(--_r) * 0.18em) color-mix(in oklch, var(--tr-color-shadow) calc(var(--_r) * 50%), transparent),
          0 0 calc(var(--_r) * 0.3em) color-mix(in oklch, var(--_fill) calc(var(--_r) * 60%), transparent);
      }
      :host([orientation='vertical']) .fill {
        inset: auto 0 0 0;
        width: auto;
        height: calc(var(--_cap-l) / 2 + var(--_f) * (100% - var(--_cap-l)));
      }

      /* ---------- the fader cap ---------- */
      .thumb {
        --_tr-z: var(--_depth);
        --_base: var(--tr-slider-cap-color, var(--_m-base));
        --_curve: 0;
        --_brush: 0;
        --_spin: 0;
        --_dish: var(--tr-slider-dish, 1);
        /* gradient axis runs along the travel; --_k is how squarely the leading shoulder faces the light */
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
        transition: --_tr-z var(--tr-motion-duration-release, 160ms);
        /* two chamfered shoulders and a dished centre. The shoulder facing the light is lit, the
           dish wall nearest the light falls into shade and the far wall catches it. */
        --_layer:
          linear-gradient(
            var(--_axis),
            color-mix(in oklch, var(--_hl) calc(var(--_kp) * var(--_r) * 80%), transparent) 0%,
            color-mix(in oklch, var(--_hl) calc(var(--_kp) * var(--_r) * 30%), transparent) 21%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_dish) * var(--_r) * 55%), transparent) 23%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_dish) * var(--_r) * 12%), transparent) 45%,
            color-mix(in oklch, var(--_hl) calc(var(--_kp) * var(--_dish) * var(--_r) * 10%), transparent) 60%,
            color-mix(in oklch, var(--_hl) calc(var(--_kp) * var(--_dish) * var(--_r) * 50%), transparent) 76%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_r) * 30%), transparent) 78%,
            color-mix(in oklch, var(--_sh) calc(var(--_kp) * var(--_r) * 60%), transparent) 100%
          ),
          linear-gradient(
            var(--_axis),
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_r) * 60%), transparent) 0%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_r) * 30%), transparent) 22%,
            color-mix(in oklch, var(--_hl) calc(var(--_kn) * var(--_dish) * var(--_r) * 50%), transparent) 24%,
            color-mix(in oklch, var(--_hl) calc(var(--_kn) * var(--_dish) * var(--_r) * 10%), transparent) 40%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_dish) * var(--_r) * 12%), transparent) 55%,
            color-mix(in oklch, var(--_sh) calc(var(--_kn) * var(--_dish) * var(--_r) * 55%), transparent) 77%,
            color-mix(in oklch, var(--_hl) calc(var(--_kn) * var(--_r) * 30%), transparent) 79%,
            color-mix(in oklch, var(--_hl) calc(var(--_kn) * var(--_r) * 80%), transparent) 100%
          ),
          /* the sides fall away across the travel too */
          linear-gradient(
            calc(var(--_axis) + 90deg),
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 18%), transparent) 0%,
            transparent 12%,
            transparent 88%,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 24%), transparent) 100%
          );
      }
      /* the printed grip line across the cap, sitting in the dish */
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
        box-shadow: calc(var(--_sx) * 0.5px) calc(var(--_sy) * 0.5px) 0 color-mix(in oklch, var(--tr-color-highlight) calc(var(--_r) * 35%), transparent);
      }
      :host([orientation='vertical']) .thumb {
        --_axis: 180deg;
        --_k: var(--_sy);
        top: auto;
        left: 50%;
        bottom: calc(var(--_f) * (100% - var(--_cap-l)));
        width: var(--_cap-w);
        height: var(--_cap-l);
        translate: -50% 0;
      }
      :host([orientation='vertical']) .thumb::after {
        left: 8%;
        right: 8%;
        top: 50%;
        bottom: auto;
        width: auto;
        height: max(1.5px, 0.12em);
        translate: 0 -50%;
      }
      :host([data-dragging]) .thumb {
        --_tr-z: calc(var(--_depth) + 1);
        cursor: grabbing;
      }

      /* ---------- ticks and printed scale ---------- */
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
      .marks {
        position: relative;
        height: 1.2em;
        margin: 0.1em calc(var(--_cap-l) / 2) 0;
        font: 600 0.7em / 1 var(--tr-font-family-mono, monospace);
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .mark {
        position: absolute;
        left: var(--_p);
        top: 0.2em;
        translate: -50% 0;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      :host([orientation='vertical']) .ticks {
        position: absolute;
        inset: calc(var(--_cap-l) / 2) 0;
        margin: 0;
        height: auto;
        pointer-events: none;
      }
      :host([orientation='vertical']) .tick {
        top: auto;
        bottom: var(--_p);
        left: 0;
        right: 0;
        width: auto;
        height: 1px;
        translate: 0 50%;
        /* printed on the panel either side of the slot, under the cap */
        background: linear-gradient(
          90deg,
          color-mix(in oklch, currentColor 60%, transparent) 0 calc(50% - var(--_groove) / 2 - 0.25em),
          transparent 0 calc(50% + var(--_groove) / 2 + 0.25em),
          color-mix(in oklch, currentColor 60%, transparent) 0
        );
      }
      :host([orientation='vertical']) .tick.major {
        height: 1.5px;
      }
      :host([orientation='vertical']) .marks {
        height: auto;
        margin: calc(var(--_cap-l) / 2) 0;
        min-width: 1.6em;
      }
      :host([orientation='vertical']) .mark {
        left: auto;
        right: 0;
        top: auto;
        bottom: var(--_p);
        translate: 0 50%;
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
        :host([orientation='vertical']) .track {
          width: max(var(--_cap-w), var(--tr-control-touch, 44px));
          height: var(--_length);
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
        .tick {
          background: CanvasText;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Layout direction. Vertical sliders increase upwards. */
  @property({ reflect: true }) orientation: Orientation = 'horizontal';

  /** Size of the slot and cap. */
  @property({ reflect: true }) size: Size = 'md';

  /** Hides the numeric readout next to the label. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-value' }) hideValue = false;

  /**
   * Comma-separated labels printed evenly along the travel, in reading order: left to right
   * for horizontal sliders (min to max), top to bottom for vertical ones (max to min),
   * e.g. "+12,+6,0,-6,-12". Each label gets a tick when `ticks` is not set.
   */
  @property({ reflect: true }) marks = '';

  protected override render() {
    const showHeader = this.label || !this.hideValue;
    const vertical = this.orientation === 'vertical';
    const marks = this.marks
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    const tickCount = this.ticks > 1 ? Math.round(this.ticks) : marks.length > 1 ? marks.length : 0;
    // Positions run from the min end: left for horizontal, bottom for vertical.
    const pos = (i: number, n: number) => `${(vertical ? (n - 1 - i) / (n - 1) : i / (n - 1)) * 100}%`;
    const ticks = tickCount
      ? html`<div part="ticks" class="ticks" aria-hidden="true">
          ${Array.from(
            { length: tickCount },
            (_, i) =>
              html`<span class="tick ${i === 0 || i === tickCount - 1 ? 'major' : ''}" style=${styleMap({ '--_p': pos(i, tickCount) })}></span>`,
          )}
        </div>`
      : nothing;
    const scale =
      marks.length > 1
        ? html`<div part="marks" class="marks" aria-hidden="true">
            ${marks.map((m, i) => html`<span class="mark" style=${styleMap({ '--_p': pos(i, marks.length) })}>${m}</span>`)}
          </div>`
        : nothing;
    return html`
      ${showHeader
        ? html`<div part="header" class="header">
            <span part="label" class="label">${this.label}</span>
            ${this.hideValue ? nothing : html`<span part="value" class="value" aria-hidden="true">${this.valueText}</span>`}
          </div>`
        : nothing}
      <div class="body">
        ${vertical ? scale : nothing}
        <div class="track focus-ring" style=${styleMap({ '--_f': `var(--tr-value-ratio, ${this.fraction})` })}>
          ${vertical ? ticks : nothing}
          <div part="groove" class="groove surface"><div part="fill" class="fill"></div></div>
          <div part="thumb" class="thumb surface"></div>
        </div>
        ${vertical ? nothing : ticks} ${vertical ? nothing : scale}
      </div>
    `;
  }

  /**
   * Drag physics from trompe/interaction: the cap never jumps when grabbed, a track press glides it
   * to the pointer, Shift is fine control, on touch moving sideways slows it down, double-click
   * resets, the wheel works while focused, release lands exactly where it is let go, and keyboard
   * or programmatic changes glide.
   */
  protected readonly dragCtl = new LinearController(this, {
    aria: false,
    keyboard: false,
    wheel: 'focus',
    // Everyday sliders land where they are let go; inertia is for knobs and throwable surfaces.
    inertia: 0,
    track: () => this.renderRoot?.querySelector('.track') ?? null,
    thumb: () => this.renderRoot?.querySelector('.thumb') ?? null,
    disabled: () => this.isDisabled,
    onInput: (v) => this.setFromUser(v, false),
    onCommit: () => this.commitDrag(),
  });

  override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    this.aria('aria-orientation', this.orientation);
    if (changed.has('orientation')) this.dragCtl.setOrientation(this.orientation === 'vertical' ? 'vertical' : 'horizontal');
    this.dragCtl.sync({ min: this.min, max: this.max, step: this.step, value: this.value });
  }

}

define('tr-slider', TrSlider);

declare global {
  interface HTMLElementTagNameMap {
    'tr-slider': TrSlider;
  }
}
