import { crossfadeText } from '../../interaction/smooth.js';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

/**
 * Shows how far a task has come. The `linear` variant is a recessed groove filled by a glossy,
 * lit tube whose leading edge glows; the `ring` variant is a gauge: a raised bezel around a
 * recessed annular groove that fills clockwise, with the value printed on a raised center cap.
 * Without `value` (or with `indeterminate`) it shows activity instead: a travelling light
 * (linear) or a sweeping arc (ring). Under reduced motion the indeterminate state is a static
 * hatched fill instead.
 *
 * @summary Progress bar or ring gauge (role="progressbar").
 * @tag tr-progress
 * @role progressbar
 *
 * @slot - Overrides the visible label text.
 *
 * @csspart label - The label row (linear) or the label under the ring.
 * @csspart value - The printed value.
 * @csspart track - The recessed groove.
 * @csspart fill - The lit fill.
 * @csspart cap - The raised center cap (ring).
 *
 * @cssprop --tr-progress-color - Fill color. Defaults by `tone` (accent).
 * @cssprop --tr-progress-thickness - Groove height (linear). Defaults by size (0.5em, 0.625em, 0.8em).
 * @cssprop --tr-progress-size - Diameter of the ring. Defaults by size (3em, 4em, 5.5em).
 * @cssprop --tr-progress-ring-width - Width of the ring's groove as a fraction of the radius. Defaults to 0.3.
 *
 * @example <tr-progress label="Uploading" value="40" show-value></tr-progress>
 * @example <tr-progress label="Syncing" indeterminate></tr-progress>
 * @example <tr-progress variant="ring" value="72" max="100" show-value label="Storage" tone="warning"></tr-progress>
 */
export class TrProgress extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_t: var(--tr-progress-thickness, 0.625em);
        --_d: var(--tr-progress-size, 4em);
        --_success: oklch(from var(--tr-color-danger) calc(l + 0.02) calc(c * 0.8) 150);
        --_warning: oklch(from var(--tr-color-danger) max(l, 0.72) calc(c * 0.9) 75);
        --_fill: var(--tr-progress-color, var(--tr-color-accent));
        display: block;
        font-size: var(--tr-font-size-md, 1em);
        min-width: 4em;
        /* --_fill is registered: a tone change fades the tube's colour */
        transition: --_fill var(--tr-motion-duration-travel, 220ms) ease-out;
      }
      :host([variant='ring']) {
        display: inline-block;
        min-width: 0;
        vertical-align: middle;
      }
      :host([size='sm']) {
        --_t: var(--tr-progress-thickness, 0.5em);
        --_d: var(--tr-progress-size, 3em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_t: var(--tr-progress-thickness, 0.8em);
        --_d: var(--tr-progress-size, 5.5em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      :host([tone='success']) {
        --_fill: var(--tr-progress-color, var(--_success));
      }
      :host([tone='warning']) {
        --_fill: var(--tr-progress-color, var(--_warning));
      }
      :host([tone='danger']) {
        --_fill: var(--tr-progress-color, var(--tr-color-danger));
      }
      .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1em;
        margin-bottom: 0.4em;
        line-height: 1.3;
      }
      .head:not(.has) {
        display: none;
      }
      .value {
        font-variant-numeric: tabular-nums;
        font-family: var(--tr-font-family-mono, monospace);
        font-size: 0.85em;
        opacity: 0.8;
      }

      /* ---------- linear: a groove with a lit glass tube sliding in from the left ---------- */
      .track {
        --_tr-z: -2;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_curve: -0.4;
        position: relative;
        height: calc(var(--_t) + 4px);
        padding: 1px;
        border-radius: var(--tr-radius-pill, 999px);
        overflow: hidden;
      }
      .fill {
        --_tr-z: 0.5;
        --_base: var(--_fill);
        --_edge: color-mix(in oklch, var(--_fill), var(--_sh) 30%);
        --_curve: 0.7;
        --_gloss: var(--tr-progress-gloss, 0.75);
        --_specular: 0.9;
        --_roughness: 0.15;
        --_brush: 0;
        --_spin: 0;
        --_mirror: 0;
        height: 100%;
        width: 100%;
        border-radius: inherit;
        translate: calc((var(--_pv, 0) - 1) * 100%) 0;
        /* a glassy tube: a bright highlight streak along the top, light pooling underneath */
        --_layer:
          linear-gradient(
            to bottom,
            color-mix(in oklch, white calc(25% + var(--_r) * 45%), transparent) 0%,
            color-mix(in oklch, white calc(var(--_r) * 18%), transparent) 38%,
            transparent 52%,
            color-mix(in oklch, var(--_fill), white calc(var(--_r) * 20%)) 100%
          );
      }
      /* the hot leading edge */
      .fill::after {
        content: '';
        position: absolute;
        inset: -1px -1px -1px auto;
        width: calc(var(--_t) * 2.5);
        border-radius: inherit;
        background: radial-gradient(
          ellipse 60% 90% at 85% 50%,
          color-mix(in oklch, white calc(20% + var(--_r) * 50%), transparent),
          color-mix(in oklch, var(--_fill), white 30%) 45%,
          transparent 75%
        );
        mix-blend-mode: screen;
        opacity: min(1, calc(var(--_pv, 0) * 20));
      }
      /* Activity: a separate runner slides along the groove. Switching between activity and a
         known value cross-fades the runner and the tube. */
      .fill {
        transition:
          translate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out),
          opacity var(--tr-motion-duration-lift, 240ms) ease-out;
      }
      .runner {
        position: absolute;
        inset: 1px auto 1px 1px;
        width: 40%;
        height: auto;
        translate: none;
        opacity: 0;
        animation: tr-progress-slide 1.4s cubic-bezier(0.45, 0, 0.25, 1) infinite paused;
        transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;
      }
      :host([data-unknown]) .runner {
        opacity: 1;
        animation-play-state: running;
      }
      :host([data-unknown]) .fill:not(.runner) {
        opacity: 0;
      }
      @keyframes tr-progress-slide {
        0% {
          translate: -100% 0;
        }
        100% {
          translate: 260% 0;
        }
      }

      /* ---------- ring: bezel, groove, cap ---------- */
      .gauge {
        --_tr-z: 1;
        --_curve: 0.4;
        position: relative;
        width: var(--_d);
        height: var(--_d);
        border-radius: 50%;
        padding: calc(var(--_d) * 0.06);
        margin-inline: auto;
        /* --_pv is registered: the arc sweeps to its new value */
        transition: --_pv var(--tr-motion-duration-glide, 471ms) var(--tr-motion-easing-glide, ease-out);
      }
      .groove {
        --_tr-z: -2;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_curve: -0.5;
        --_a: calc(var(--_pv, 0) * 1turn);
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        display: grid;
        place-items: center;
        /* the lit arc lies on the groove floor, under the groove's own inner shadow */
        --_layer:
          radial-gradient(circle, transparent 52%, color-mix(in oklch, white calc(var(--_r) * 35%), transparent) 75%, transparent 92%),
          conic-gradient(from 0deg, var(--_fill) 0 var(--_a), transparent var(--_a));
      }
      .spin {
        position: absolute;
        inset: 1px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, transparent 0 55%, color-mix(in oklch, var(--_fill) 40%, transparent) 75%, var(--_fill) 98%, transparent 98.5%);
        /* paused and faded out when the progress is known, so switching modes cross-fades */
        animation: tr-progress-spin 1.1s linear infinite paused;
        opacity: 0;
        transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;
      }
      :host([data-unknown]) .spin {
        animation-play-state: running;
        opacity: 1;
      }
      @keyframes tr-progress-spin {
        to {
          rotate: 1turn;
        }
      }
      .cap {
        --_tr-z: 1;
        --_layer: none;
        --_curve: 0.6;
        position: relative;
        width: calc(100% * (1 - var(--tr-progress-ring-width, 0.26)));
        aspect-ratio: 1;
        border-radius: 50%;
        display: grid;
        place-items: center;
        z-index: 1;
      }
      .cap .value {
        font-size: max(0.6875rem, calc(var(--_d) * 0.21));
        opacity: 1;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: -0.02em;
      }
      .ring-label {
        margin-top: 0.4em;
        text-align: center;
        line-height: 1.3;
      }
      .ring-label:not(.has) {
        display: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .runner {
          animation: none;
          width: calc(100% - 2px);
          translate: none;
          --_layer: repeating-linear-gradient(
            -45deg,
            color-mix(in oklch, white 30%, transparent) 0 0.35em,
            transparent 0.35em 0.7em
          );
        }
        :host([data-unknown]) .spin {
          animation: none;
          background: repeating-conic-gradient(var(--_fill) 0 6deg, transparent 6deg 18deg);
        }
      }
      @media (forced-colors: active) {
        .fill,
        .spin {
          background: Highlight;
          forced-color-adjust: none;
        }
        .groove {
          background: conic-gradient(Highlight 0 var(--_a), Canvas var(--_a));
          forced-color-adjust: none;
        }
        .cap {
          background: Canvas;
          border-color: CanvasText;
        }
      }
    `,
  ];

  /** Current progress, from 0 to `max`. Leave unset (or set `indeterminate`) when unknown. */
  @property({ type: Number }) value?: number;

  /** The value that means done. */
  @property({ type: Number }) max = 100;

  /** Shows activity without a known amount. Implied when `value` is unset. */
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  private shownValue = '';

  /** Shape: a horizontal bar, or a circular gauge. */
  @property({ reflect: true }) variant: 'linear' | 'ring' = 'linear';

  /** Visible label and accessible name. */
  @property() label = '';

  /** Prints the value as a percentage. */
  @property({ type: Boolean, reflect: true, attribute: 'show-value' }) showValue = false;

  /** Color of the fill. Success and warning are derived from the theme's danger color. */
  @property({ reflect: true }) tone: 'accent' | 'success' | 'warning' | 'danger' = 'accent';

  /** Size of the bar or ring. */
  @property({ reflect: true }) size: Size = 'md';

  /** Accessible text for the value, such as "3 of 10 files". Defaults to the percentage. */
  @property({ attribute: 'value-text' }) valueText = '';

  private hasSlotted = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar');
  }

  private get unknown(): boolean {
    return this.indeterminate || this.value == null || Number.isNaN(this.value);
  }

  /** Progress as a fraction from 0 to 1 (0 when indeterminate). */
  get fraction(): number {
    if (this.unknown || !(this.max > 0)) return 0;
    return Math.min(1, Math.max(0, this.value! / this.max));
  }

  private get percent(): string {
    return `${Math.round(this.fraction * 100)}%`;
  }

  protected override render() {
    const text = this.unknown ? '' : this.percent;
    const label = html`<slot @slotchange=${this.onSlot}>${this.label}</slot>`;
    const hasLabel = !!this.label || this.hasSlotted;
    if (this.variant === 'ring') {
      return html`<div class="gauge surface" style="--_pv:${this.fraction}">
          <div part="track" class="groove surface">
            <div part="fill" class="spin"></div>
            <div part="cap" class="cap surface">
              ${this.showValue && text ? html`<span part="value" class="value">${text}</span>` : nothing}
            </div>
          </div>
        </div>
        <div part="label" class="ring-label ${hasLabel ? 'has' : ''}">${label}</div>`;
    }
    return html`<div part="label" class="head ${hasLabel || (this.showValue && text) ? 'has' : ''}">
        <span>${label}</span>
        ${this.showValue && text ? html`<span part="value" class="value">${text}</span>` : nothing}
      </div>
      <div part="track" class="track surface">
        <div part="fill" class="fill surface" style="--_pv:${this.fraction}"></div>
        <div class="fill surface runner" aria-hidden="true"></div>
      </div>`;
  }

  private onSlot(e: Event): void {
    const has = (e.target as HTMLSlotElement).assignedNodes().some((n) => n.textContent?.trim());
    if (has !== this.hasSlotted) {
      this.hasSlotted = has;
      this.requestUpdate();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const unknown = this.unknown;
    this.aria('aria-valuemin', '0');
    this.aria('aria-valuemax', String(this.max));
    this.aria('aria-valuenow', unknown ? null : String(Math.min(this.max, Math.max(0, this.value!))));
    this.aria('aria-valuetext', unknown ? null : this.valueText || this.percent);
    if (this.label && !this.hasAttribute('aria-labelledby')) {
      if (!this.hasAttribute('aria-label') || this.dataset.trAutoLabel !== undefined) {
        this.aria('aria-label', this.label);
        this.dataset.trAutoLabel = '';
      }
    }
    // the indeterminate look is driven by the attribute
    this.toggleAttribute('data-unknown', unknown);
    // The percentage cross-fades instead of flicking over.
    const valueEl = this.renderRoot.querySelector<HTMLElement>('.value');
    const shown = valueEl?.textContent ?? '';
    if (valueEl && this.shownValue && shown && shown !== this.shownValue) crossfadeText(valueEl, this.shownValue, { duration: 140 });
    this.shownValue = shown;
  }
}

define('tr-progress', TrProgress);

declare global {
  interface HTMLElementTagNameMap {
    'tr-progress': TrProgress;
  }
}
