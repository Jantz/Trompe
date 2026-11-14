import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { RangeControl } from '../../internal/range-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Orientation, Size } from '../../internal/types.js';

/**
 * A linear fader: a raised cap riding in a recessed groove, like a mixing desk. Drag the cap or
 * click anywhere on the groove; arrow keys, Page Up/Down, Home and End work as in the APG slider
 * pattern. Fills the width of its container (or a fixed height when vertical).
 *
 * @summary Linear slider/fader (role="slider"), form-associated.
 * @tag tr-slider
 * @role slider
 *
 * @csspart header - Row holding the label and the value readout.
 * @csspart label - The visible label.
 * @csspart value - The value readout.
 * @csspart groove - The recessed groove.
 * @csspart fill - The filled part of the groove, from min to the value.
 * @csspart thumb - The fader cap.
 * @csspart ticks - The row of tick marks.
 *
 * @cssprop --tr-slider-fill-color - Fill color. Defaults to --tr-color-accent.
 * @cssprop --tr-slider-length - Length of a vertical slider. Defaults to 180px.
 *
 * @fires input - The value changed during interaction.
 * @fires change - The user committed a new value (pointer released or key pressed).
 *
 * @example <tr-slider label="Volume" value="60" unit="%"></tr-slider>
 * @example <tr-slider label="Gain" min="-12" max="12" step="0.5" unit=" dB" ticks="5" orientation="vertical" material="metal"></tr-slider>
 */
export class TrSlider extends RangeControl {
  static override styles = [
    ...RangeControl.styles,
    css`
      :host {
        --_depth: 2;
        --_groove: 8px;
        --_cap-w: 18px;
        --_cap-h: 30px;
        --_fill: var(--tr-slider-fill-color, var(--tr-color-accent));
        display: block;
        min-width: 8rem;
        color: var(--tr-color-ink);
        font-size: var(--tr-font-size-md, 0.9375rem);
        user-select: none;
        touch-action: none;
      }
      :host([size='sm']) {
        --_groove: 6px;
        --_cap-w: 14px;
        --_cap-h: 22px;
        font-size: var(--tr-font-size-sm, 0.8125rem);
      }
      :host([size='lg']) {
        --_groove: 10px;
        --_cap-w: 22px;
        --_cap-h: 38px;
        font-size: var(--tr-font-size-lg, 1.0625rem);
      }
      :host([orientation='vertical']) {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        min-width: 0;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--tr-space-3, 12px);
        margin-bottom: var(--tr-space-2, 8px);
        line-height: 1.3;
      }
      :host([orientation='vertical']) .header {
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .value {
        font-family: var(--tr-font-family-mono, monospace);
        font-variant-numeric: tabular-nums;
        color: var(--tr-color-ink-muted);
      }
      .track {
        position: relative;
        height: max(var(--_cap-h), var(--tr-control-sm, 32px));
        cursor: pointer;
        border-radius: var(--tr-radius-sm, 6px);
      }
      :host([orientation='vertical']) .track {
        height: var(--tr-slider-length, 180px);
        width: max(var(--_cap-h), var(--tr-control-sm, 32px));
      }
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
        width: calc(var(--_cap-w) / 2 + var(--_f) * (100% - var(--_cap-w)));
        background: var(--_fill);
        box-shadow: inset 0 calc(var(--_r) * 2px) calc(var(--_r) * 3px) color-mix(in oklch, var(--tr-color-shadow) calc(var(--_r) * 50%), transparent);
      }
      :host([orientation='vertical']) .fill {
        inset: auto 0 0 0;
        width: auto;
        height: calc(var(--_cap-w) / 2 + var(--_f) * (100% - var(--_cap-w)));
      }
      .thumb {
        --_tr-z: var(--_depth);
        position: absolute;
        top: 50%;
        left: calc(var(--_f) * (100% - var(--_cap-w)));
        width: var(--_cap-w);
        height: var(--_cap-h);
        translate: 0 -50%;
        border-radius: 4px;
        transition: --_tr-z var(--tr-motion-duration-release, 160ms);
        cursor: grab;
      }
      /* grip line across the cap */
      .thumb::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 22%;
        bottom: 22%;
        width: 2px;
        translate: -50% 0;
        border-radius: 1px;
        background: color-mix(in oklch, var(--_ink) 70%, transparent);
        box-shadow: calc(var(--_sx) * -1px) calc(var(--_sy) * -1px) 0 color-mix(in oklch, var(--tr-color-highlight) calc(var(--_r) * 50%), transparent);
      }
      :host([orientation='vertical']) .thumb {
        top: auto;
        left: 50%;
        bottom: calc(var(--_f) * (100% - var(--_cap-w)));
        width: var(--_cap-h);
        height: var(--_cap-w);
        translate: -50% 0;
      }
      :host([orientation='vertical']) .thumb::after {
        left: 22%;
        right: 22%;
        top: 50%;
        bottom: auto;
        width: auto;
        height: 2px;
        translate: 0 -50%;
      }
      :host([data-dragging]) .thumb {
        --_tr-z: calc(var(--_depth) + 1);
        cursor: grabbing;
      }
      .ticks {
        display: flex;
        justify-content: space-between;
        padding: 0 calc(var(--_cap-w) / 2 - 0.5px);
        margin-top: 2px;
        height: 6px;
      }
      .ticks span {
        width: 1px;
        background: var(--tr-color-ink-muted);
      }
      :host([orientation='vertical']) .ticks {
        display: none;
      }
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
          height: max(var(--_cap-h), var(--tr-control-touch, 44px));
        }
        :host([orientation='vertical']) .track {
          width: max(var(--_cap-h), var(--tr-control-touch, 44px));
          height: var(--tr-slider-length, 180px);
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
      }
    `,
  ];

  /** Layout direction. Vertical sliders increase upwards. */
  @property({ reflect: true }) orientation: Orientation = 'horizontal';

  /** Size of the groove and cap. */
  @property({ reflect: true }) size: Size = 'md';

  /** Hides the numeric readout next to the label. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-value' }) hideValue = false;

  protected override render() {
    const showHeader = this.label || !this.hideValue;
    return html`
      ${showHeader
        ? html`<div part="header" class="header">
            <span part="label" class="label">${this.label}</span>
            ${this.hideValue ? nothing : html`<span part="value" class="value" aria-hidden="true">${this.valueText}</span>`}
          </div>`
        : nothing}
      <div class="track focus-ring" style=${styleMap({ '--_f': String(this.fraction) })} @pointerdown=${this.onPointerDown}>
        <div part="groove" class="groove surface"><div part="fill" class="fill"></div></div>
        <div part="thumb" class="thumb surface"></div>
      </div>
      ${this.ticks > 1
        ? html`<div part="ticks" class="ticks" aria-hidden="true">${Array.from({ length: this.ticks }, () => html`<span></span>`)}</div>`
        : nothing}
    `;
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    super.updated(changed);
    this.aria('aria-orientation', this.orientation);
  }

  private valueAt(event: PointerEvent): number {
    const track = this.renderRoot.querySelector('.track') as HTMLElement;
    const r = track.getBoundingClientRect();
    const cap = parseFloat(getComputedStyle(this).getPropertyValue('--_cap-w')) || 18;
    const f =
      this.orientation === 'vertical'
        ? (r.bottom - cap / 2 - event.clientY) / Math.max(1, r.height - cap)
        : (event.clientX - r.left - cap / 2) / Math.max(1, r.width - cap);
    return this.min + Math.min(1, Math.max(0, f)) * (this.max - this.min);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.isDisabled || event.button !== 0) return;
    event.preventDefault();
    this.focus();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.setAttribute('data-dragging', '');
    this.setFromUser(this.valueAt(event), false);
    const move = (e: PointerEvent) => this.setFromUser(this.valueAt(e), false);
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      this.removeAttribute('data-dragging');
      this.commitDrag();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
}

define('tr-slider', TrSlider);

declare global {
  interface HTMLElementTagNameMap {
    'tr-slider': TrSlider;
  }
}
