import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { RangeControl } from '../../internal/range-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { RotaryController } from '../../interaction/rotary.js';

/** Sweep of the knob: from -135deg (min) to +135deg (max), 0deg pointing up. */
const SWEEP = 270;
const START = -135;

/** Point on a circle of radius r at angle a (degrees, 0 = up, clockwise), in the scale's viewBox. */
function polar(r: number, a: number): [number, number] {
  const t = (a * Math.PI) / 180;
  return [Number((r * Math.sin(t)).toFixed(3)), Number((-r * Math.cos(t)).toFixed(3))];
}

function arcPath(r: number, a0: number, a1: number): string {
  if (Math.abs(a1 - a0) < 0.01) return '';
  const [lo, hi] = a0 < a1 ? [a0, a1] : [a1, a0];
  const [x0, y0] = polar(r, lo);
  const [x1, y1] = polar(r, hi);
  return `M${x0} ${y0}A${r} ${r} 0 ${hi - lo > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * A rotary knob, like the gain and volume controls on studio hardware. The cap is a solid body
 * lit by the scene's light: its highlights, spun-metal rings and shading stay put while only the
 * indicator (and the grip ridges) turn, exactly as on a real knob. A printed scale of ticks and
 * an accent value arc surround it.
 *
 * Drag up or right to increase, down or left to decrease (hold Shift for fine adjustment),
 * double-click to return to the initial value. Arrow keys, Page Up/Down, Home and End follow the
 * WAI-ARIA APG slider pattern.
 *
 * @summary Rotary knob (role="slider"), form-associated.
 * @tag tr-knob
 * @role slider
 *
 * @csspart dial - Square area holding the scale and the knob.
 * @csspart scale - The SVG scale: tick marks and value arc.
 * @csspart arc - The accent value arc.
 * @csspart marks - Each printed scale label (when `marks` is set).
 * @csspart knob - The knob itself (body and cap).
 * @csspart body - The knob body: side wall, skirt or base disc.
 * @csspart cap - The top face of the knob (the pointer, for `variant="pointer"`).
 * @csspart indicator - The rotating indicator line.
 * @csspart caption - Row under the knob holding the label and the value.
 * @csspart label - The visible label.
 * @csspart value - The value readout.
 *
 * @cssprop --tr-knob-size - Knob diameter. Defaults by size (3em, 4em, 5.5em).
 * @cssprop --tr-knob-indicator-color - Color of the indicator line. Defaults to the cap ink (white on dark caps, dark on light ones).
 * @cssprop --tr-knob-arc-color - Color of the value arc. Defaults to --tr-color-accent.
 * @cssprop --tr-knob-cap-color - Color of the cap insert in the `skirt` variant. Defaults to brushed aluminium.
 * @cssprop --tr-knob-cap-inset - Inset of the cap from the body edge (the visible side wall), as a percentage. Defaults to 7%.
 * @cssprop --tr-knob-tilt - How far the cap leans toward the viewer, as a fraction of the diameter. 0 is a straight top view. Defaults to 0.035.
 * @cssprop --tr-knob-grip - Opacity of the knurled grip ridges, 0 to hide them. Defaults to 1.
 * @cssprop --tr-knob-grip-inset - Inset of the knurled grip in the `skirt` variant. Defaults to 13%.
 * @cssprop --tr-knob-insert-inset - Inset of the aluminium insert in the `skirt` variant. Defaults to 27%.
 * @cssprop --tr-knob-pointer-width - Width of the pointer in the `pointer` variant, as a percentage of the diameter. Defaults to 42%.
 * @cssprop --tr-knob-indicator-width - Width of the indicator line, as a percentage of the diameter. Defaults to 5%.
 * @cssprop --tr-knob-indicator-length - Length of the indicator line, as a percentage of the diameter. Defaults to 34%.
 * @cssprop --tr-knob-scale-color - Color of the printed tick marks. Defaults to the ink colors.
 * @cssprop --tr-knob-arc-width - Stroke width of the value arc, in scale units (the dial is 100 wide). Defaults to 2.6.
 *
 * @fires input - The value changed during interaction.
 * @fires change - The user committed a new value (pointer released or key pressed).
 *
 * @example <tr-knob label="Volume" value="40" unit="%"></tr-knob>
 * @example <tr-knob label="Gain" min="-12" max="12" step="0.5" unit=" dB" arc="center" material="metal" finish="spun"></tr-knob>
 * @example <tr-knob label="Cutoff" variant="skirt" material="rubber" size="lg" marks="0,2,4,6,8,10"></tr-knob>
 * @example <tr-knob label="Mode" variant="pointer" min="1" max="5" ticks="5" marks="1,2,3,4,5"></tr-knob>
 */
export class TrKnob extends RangeControl {
  static override styles = [
    ...RangeControl.styles,
    css`
      :host {
        --_depth: 3;
        --_d: var(--tr-knob-size, 4em);
        --_arc: var(--tr-knob-arc-color, var(--tr-color-accent));
        /* the scene light, captured before any rotated part redefines it */
        --_light: var(--tr-light-angle, 330deg);
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15em;
        vertical-align: middle;
        font-size: var(--tr-font-size-md, 1em);
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      :host([size='sm']) {
        --_d: var(--tr-knob-size, 3em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_d: var(--tr-knob-size, 5.5em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }

      /* ---------- dial and printed scale ---------- */
      .dial {
        position: relative;
        width: calc(var(--_d) * 1.42);
        aspect-ratio: 1;
        flex: none;
      }
      :host([marks]) .dial {
        margin: 0.9em;
      }
      .scale {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }
      .tick {
        stroke: var(--tr-knob-scale-color, color-mix(in oklch, currentColor 65%, transparent));
        stroke-width: 1.1;
        stroke-linecap: round;
      }
      .tick.major {
        stroke: var(--tr-knob-scale-color, currentColor);
        stroke-width: 1.5;
      }
      .track {
        fill: none;
        stroke: color-mix(in oklch, var(--tr-color-shadow) calc(14% + var(--_r) * 14%), transparent);
        stroke-width: var(--tr-knob-arc-width, 2.6);
        stroke-linecap: round;
      }
      .arc {
        fill: none;
        stroke: var(--_arc);
        stroke-width: var(--tr-knob-arc-width, 2.6);
        stroke-linecap: round;
        filter: drop-shadow(0 0 calc(var(--_r) * 1.6px) color-mix(in oklch, var(--_arc) calc(var(--_r) * 90%), transparent));
      }
      .mark {
        position: absolute;
        /* percentages of the square dial, so the label's own font size does not move it */
        left: calc(50% + sin(var(--_a)) * 61%);
        top: calc(50% - cos(var(--_a)) * 61%);
        translate: -50% -50%;
        font: 600 0.62em / 1 var(--tr-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: color-mix(in oklch, currentColor 72%, transparent);
        white-space: nowrap;
        pointer-events: none;
      }

      /* ---------- the knob ---------- */
      .knob {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--_d);
        aspect-ratio: 1;
        translate: -50% -50%;
        border-radius: 50%;
        cursor: grab;
        touch-action: none;
      }
      :host([data-dragging]) .knob {
        cursor: grabbing;
      }
      .body,
      .face,
      .grip {
        position: absolute;
        border-radius: 50%;
      }
      .body {
        --_tr-z: var(--_depth);
        --_spin: 0;
        --_brush: 0;
        --_gloss: 0;
        --_curve: 0;
        --_edge: color-mix(in oklch, var(--_sh) calc(25% + var(--_r) * 30%), transparent);
        inset: 0;
        /* a cylinder wall seen from above: bright where it faces the light, dark opposite,
           with the sharp anisotropic bands a polished side wall throws */
        --_layer:
          conic-gradient(
            from var(--_light),
            color-mix(in oklch, var(--_hl) calc(var(--_r) * 34%), transparent) 0deg,
            transparent 70deg,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 30%), transparent) 150deg,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 38%), transparent) 180deg,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 30%), transparent) 210deg,
            transparent 290deg,
            color-mix(in oklch, var(--_hl) calc(var(--_r) * 34%), transparent) 360deg
          ),
          conic-gradient(
            from var(--_light),
            transparent 22deg,
            color-mix(in oklch, var(--_hl) calc(var(--_spec) * var(--_metal) * 70%), transparent) 34deg,
            transparent 46deg,
            transparent 236deg,
            color-mix(in oklch, var(--_hl) calc(var(--_spec) * var(--_metal) * 40%), transparent) 250deg,
            transparent 262deg,
            transparent 300deg,
            color-mix(in oklch, var(--_hl) calc(var(--_spec) * 55%), transparent) 326deg,
            transparent 340deg
          );
      }
      /* knurled grip: fine ridges that turn with the knob, shaded by a fixed light overlay */
      .knurl {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        rotate: var(--_rot);
        background: repeating-conic-gradient(
          from 0deg,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 22%), transparent) 0deg 1.4deg,
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 45%), transparent) 2.6deg 4.6deg,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 22%), transparent) 6deg
        );
        opacity: var(--tr-knob-grip, 1);
        -webkit-mask: radial-gradient(circle, transparent 60%, #000 61%);
        mask: radial-gradient(circle, transparent 60%, #000 61%);
      }
      .face {
        --_tr-z: 0.4;
        --_edge: color-mix(in oklch, var(--_sh) calc(10% + var(--_r) * 20%), transparent);
        --_curve: var(--tr-p-curve, 0.35);
        /* knob tops are turned on a lathe: brushed metals read as spun */
        --_spin: var(--tr-f-spin, max(var(--tr-m-spin, 0), var(--tr-m-brush, 0) * 0.85));
        --_brush: var(--tr-f-brush, 0);
        --_bevel: calc(var(--tr-m-bevel, 1px) + var(--_r) * 0.5px);
        inset: var(--tr-knob-cap-inset, 7%);
        /* the cap is a solid that sits above the wall: lean it toward the viewer a little */
        translate: 0 calc(var(--_d) * var(--tr-knob-tilt, 0.035) * -1);
        overflow: hidden;
      }
      /* concentric lathe rings, finer than the shared spun layer, plus a hot spot where the
         rings face the light and a second one opposite (anisotropic reflection) */
      .face::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        pointer-events: none;
        background:
          conic-gradient(
            from var(--_light),
            color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 55%), transparent) 0deg,
            transparent 22deg,
            transparent 158deg,
            color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 40%), transparent) 180deg,
            transparent 202deg,
            transparent 338deg,
            color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 55%), transparent) 360deg
          ),
          repeating-radial-gradient(
            circle at 50% 50%,
            color-mix(in oklch, var(--_sh) calc(var(--_spin) * var(--_r) * 9%), transparent) 0 0.5px,
            transparent 0.5px 1.5px
          );
      }
      .indicator {
        position: absolute;
        inset: 0;
        rotate: var(--_rot);
        pointer-events: none;
      }
      .indicator::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 5%;
        width: max(2px, var(--tr-knob-indicator-width, 5%));
        height: var(--tr-knob-indicator-length, 34%);
        translate: -50% 0;
        border-radius: 999px;
        background: var(--tr-knob-indicator-color, var(--_ink));
        /* engraved and filled: a dark lip toward the light, a bright one away from it */
        box-shadow:
          inset 0 calc(var(--_r) * 1px) calc(var(--_r) * 1px) color-mix(in oklch, var(--_sh) calc(var(--_r) * 55%), transparent),
          calc(var(--_sx) * 0.5px) calc(var(--_sy) * 0.5px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }

      /* ---------- variant: skirt (synth-style: knurled grip, flange, aluminium insert) ---------- */
      :host([variant='skirt']) .body {
        /* the flange is matte and flat; the grip carries the shine */
        --_layer: conic-gradient(
          from var(--_light),
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 16%), transparent) 0deg,
          transparent 90deg,
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 16%), transparent) 180deg,
          transparent 270deg,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 16%), transparent) 360deg
        );
      }
      .grip {
        --_tr-z: 1.4;
        --_spin: 0;
        --_brush: 0;
        --_curve: 0.15;
        --_edge: color-mix(in oklch, var(--_sh) calc(30% + var(--_r) * 30%), transparent);
        inset: var(--tr-knob-grip-inset, 13%);
        translate: 0 calc(var(--_d) * var(--tr-knob-tilt, 0.035) * -0.6);
        --_layer: conic-gradient(
          from var(--_light),
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 40%), transparent) 0deg,
          transparent 60deg,
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 40%), transparent) 180deg,
          transparent 300deg,
          color-mix(in oklch, var(--_hl) calc(var(--_r) * 40%), transparent) 360deg
        );
      }
      :host([variant='skirt']) .face {
        --_base: var(--tr-knob-cap-color, var(--tr-material-metal-base, oklch(83% 0.006 250)));
        --_ink: var(--tr-material-metal-ink, oklch(22% 0.01 250));
        --_metal: 1;
        --_specular: 0.9;
        --_roughness: 0.3;
        --_spin: var(--tr-f-spin, 1);
        --_mirror: var(--tr-f-mirror, 0);
        --_gloss: 0;
        --_contrast: 1.6;
        --_curve: 0.2;
        inset: var(--tr-knob-insert-inset, 27%);
        translate: 0 calc(var(--_d) * var(--tr-knob-tilt, 0.035) * -0.85);
      }
      :host([variant='skirt']) .indicator {
        --_ink: var(--_m-ink);
        --_hl: var(--tr-color-highlight, #fff);
        --_sh: var(--tr-color-shadow, #000);
      }
      :host([variant='skirt']) .indicator::before {
        top: 1.5%;
        width: max(2px, var(--tr-knob-indicator-width, 3.2%));
        height: 11%;
      }

      /* ---------- variant: pointer (chicken-head) ---------- */
      :host([variant='pointer']) .body {
        inset: 14%;
        --_tr-z: 1;
      }
      :host([variant='pointer']) .face {
        /* the whole pointer turns, so its light is counter-rotated to stay fixed in the scene */
        --tr-light-angle: calc(var(--_light) - var(--_rot));
        --_sx: calc(-1 * sin(var(--tr-light-angle)));
        --_sy: cos(var(--tr-light-angle));
        --_tr-z: 2;
        --_curve: var(--tr-p-curve, 0.55);
        --_spin: var(--tr-f-spin, 0);
        overflow: visible;
        inset: auto;
        left: calc(50% - var(--tr-knob-pointer-width, 42%) / 2);
        width: var(--tr-knob-pointer-width, 42%);
        top: -4.7%;
        height: 76%;
        translate: none;
        transform-origin: 50% 72%;
        rotate: var(--_rot);
        border-radius: 50% / 72% 72% 28% 28%;
      }
      :host([variant='pointer']) .face::after {
        border-radius: inherit;
      }
      :host([variant='pointer']) .indicator {
        rotate: none;
      }
      :host([variant='pointer']) .indicator::before {
        top: 4%;
        width: max(2px, 9%);
        height: 50%;
      }

      /* ---------- caption ---------- */
      .caption {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1em;
        line-height: 1.2;
        max-width: calc(var(--_d) * 2);
        text-align: center;
      }
      .label {
        font-size: 0.75em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .value {
        font: 0.8em / 1.2 var(--tr-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: color-mix(in oklch, currentColor 72%, transparent);
      }

      /* ---------- states ---------- */
      :host(:focus-visible) .knob.focus-ring {
        outline-offset: calc(var(--_d) * 0.06);
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) .knob,
      :host(:state(disabled)) .knob {
        cursor: not-allowed;
      }
      @media (pointer: coarse) {
        .knob::after {
          content: '';
          position: absolute;
          inset: min(0px, (var(--_d) - var(--tr-control-touch, 44px)) / 2);
          border-radius: 50%;
        }
      }
      @media (forced-colors: active) {
        .body,
        .face,
        .grip {
          border-color: ButtonText;
          background: ButtonFace;
          forced-color-adjust: none;
        }
        .knurl,
        .face::after {
          display: none;
        }
        .indicator::before {
          background: ButtonText;
          box-shadow: none;
        }
        .tick,
        .tick.major {
          stroke: CanvasText;
        }
        .track {
          stroke: GrayText;
        }
        .arc {
          stroke: Highlight;
          filter: none;
        }
      }
    `,
  ];

  /** Size of the knob. */
  @property({ reflect: true }) size: Size = 'md';

  /**
   * Shape of the knob: `cap` a smooth (or spun-metal) cylinder cap, `skirt` a synth-style knob
   * with a knurled grip, a flange and an aluminium insert, `pointer` a chicken-head pointer knob.
   */
  @property({ reflect: true }) variant: 'cap' | 'skirt' | 'pointer' = 'cap';

  /**
   * Where the value arc starts: `min` fills from the minimum, `center` fills from the middle
   * (for pan, balance and ±gain), `none` hides the arc.
   */
  @property({ reflect: true }) arc: 'min' | 'center' | 'none' = 'min';

  /** Comma-separated labels printed evenly around the scale, from min to max, e.g. "0,5,10". */
  @property({ reflect: true }) marks = '';

  /** Hides the numeric readout under the knob. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-value' }) hideValue = false;

  private initialValue: number | null = null;

  /**
   * Turning physics from trompe/interaction: up or right increases (200 px for the full range,
   * ten times finer with Shift), the wheel works while focused, and keyboard, wheel or programmatic
   * changes turn the knob on a spring instead of jumping. The component keeps its own ARIA, keys and
   * double-click reset.
   */
  protected readonly turnCtl = new RotaryController(this, {
    aria: false,
    keyboard: false,
    resetOnDoubleClick: false,
    wheel: 'focus',
    drag: 'xy',
    dragDistance: 200,
    knob: () => this.renderRoot?.querySelector('.knob') ?? null,
    disabled: () => this.isDisabled,
    onInput: (v) => this.setFromUser(v, false),
    onCommit: () => this.commitDrag(),
  });

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.turnCtl.sync({ min: this.min, max: this.max, step: this.step, value: this.value });
  }

  constructor() {
    super();
    this.ticks = 11;
    this.addEventListener('dblclick', this.onDoubleClick);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.initialValue === null) this.initialValue = this.value;
  }

  /** Indicator angle in degrees, -135 (min) to 135 (max). */
  get angle(): number {
    return START + this.fraction * SWEEP;
  }

  protected override render() {
    const angle = this.angle;
    const marks = this.marks
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    return html`
      <div part="dial" class="dial" style=${styleMap({ '--_rot': `var(--tr-angle, ${angle}deg)` })}>
        ${this.renderScale(angle)}
        ${marks.map(
          (m, i) =>
            html`<span part="marks" class="mark" aria-hidden="true" style=${styleMap({ '--_a': `${marks.length > 1 ? START + (i * SWEEP) / (marks.length - 1) : 0}deg` })}
              >${m}</span
            >`,
        )}
        <div part="knob" class="knob focus-ring">
          <div part="body" class="body surface">${this.variant === 'cap' ? html`<div class="knurl"></div>` : nothing}</div>
          ${this.variant === 'skirt' ? html`<div class="grip surface"><div class="knurl"></div></div>` : nothing}
          ${this.variant === 'skirt' ? html`<div class="indicator" part="indicator"></div>` : nothing}
          <div part="cap" class="face surface">${this.variant === 'skirt' ? nothing : html`<div class="indicator" part="indicator"></div>`}</div>
        </div>
      </div>
      ${this.label || !this.hideValue
        ? html`<div part="caption" class="caption">
            ${this.label ? html`<span part="label" class="label">${this.label}</span>` : nothing}
            ${this.hideValue ? nothing : html`<span part="value" class="value" aria-hidden="true">${this.valueText}</span>`}
          </div>`
        : nothing}
    `;
  }

  private renderScale(angle: number) {
    const n = Math.max(0, Math.round(this.ticks));
    const ticks = [];
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        const a = START + (i * SWEEP) / (n - 1);
        const major = i === 0 || i === n - 1 || (n % 2 === 1 && i === (n - 1) / 2);
        const [x0, y0] = polar(42.5, a);
        const [x1, y1] = polar(major ? 48 : 46.5, a);
        ticks.push(svg`<line class="tick ${major ? 'major' : ''}" x1=${x0} y1=${y0} x2=${x1} y2=${y1}></line>`);
      }
    }
    const from = this.arc === 'center' ? 0 : START;
    return html`<svg part="scale" class="scale" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      ${this.arc !== 'none'
        ? svg`<path class="track" d=${arcPath(38.5, START, START + SWEEP)}></path>
            <path part="arc" class="arc" d=${arcPath(38.5, from, angle)}></path>`
        : nothing}
      ${ticks}
    </svg>`;
  }

  private onDoubleClick = (): void => {
    if (this.isDisabled || this.initialValue === null) return;
    this.setFromUser(this.initialValue, true);
  };
}

define('tr-knob', TrKnob);

declare global {
  interface HTMLElementTagNameMap {
    'tr-knob': TrKnob;
  }
}
