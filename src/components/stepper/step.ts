import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/** Where a step stands. Set by the parent `tr-stepper` from its `current` step. */
export type StepState = 'complete' | 'current' | 'upcoming';

/**
 * One step of a `tr-stepper`. The default slot is its label; put a short line in
 * `slot="description"`. Its number, check mark, connecting track and state come from the parent
 * stepper: complete steps show a lit check engraved into an accent plate, the current one stands
 * raised with an accent rim, upcoming ones are printed on the floor of their socket.
 *
 * Mark a step that needs attention with `error` (a danger rim and "!" replace its number), or one
 * that cannot be visited with `disabled`. Give it a `value` to select it by name through the
 * stepper's `value`.
 *
 * @summary One step of a tr-stepper (role="listitem"): number or check, label and description.
 * @tag tr-step
 * @role listitem
 *
 * @slot - The step's label.
 * @slot description - A short line under the label.
 *
 * @csspart step - The step's content (a button when the stepper is `clickable`).
 * @csspart marker - The round socket holding the number, check or "!".
 * @csspart label - The label.
 * @csspart description - The description line.
 * @csspart rail - The track from this step to the next.
 *
 * @example <tr-stepper current="1"><tr-step>Service</tr-step><tr-step>Clinician<span slot="description">Pick who you see</span></tr-step><tr-step error>Details</tr-step></tr-stepper>
 */
export class TrStep extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_m: var(--tr-stepper-marker-size, 2.25em);
        --_g: var(--tr-stepper-track-width, 0.32em);
        --_rg: 0.45em;
        --_dm: 0ms;
        --_df: 0ms;
        --_dh: var(--tr-motion-duration-travel, 220ms);
        --_t: var(--tr-motion-duration-release, 160ms);
        position: relative;
        display: block;
        flex: 1 1 0;
        min-width: 0;
        list-style: none;
        transition: opacity var(--_t) ease-out;
      }
      :host([data-orientation='vertical']) {
        --_rg: 0.3em;
        flex: none;
        padding-bottom: var(--tr-stepper-gap, 1.75em);
      }
      :host([data-orientation='vertical'][data-last]) {
        padding-bottom: 0;
      }
      :host([disabled]) {
        opacity: 0.5;
      }
      /* parts take their state at once until the stepper has placed them (no animation on load) */
      :host(:not([data-ready])) *,
      :host(:not([data-ready])) *::before,
      :host(:not([data-ready])) *::after {
        transition: none !important;
      }

      /* ---------- the track: each step draws the stretch to the next one (steps share one width) ---------- */
      .rail {
        position: absolute;
        top: calc(var(--_m) / 2 - var(--_g) / 2);
        inset-inline-start: calc(50% + var(--_m) / 2 + var(--_rg));
        inset-inline-end: calc(-50% + var(--_m) / 2 + var(--_rg));
        height: var(--_g);
        pointer-events: none;
      }
      :host([data-last]) .rail {
        visibility: hidden;
      }
      :host([data-orientation='vertical']) .rail {
        top: calc(var(--_m) + var(--_rg));
        bottom: var(--_rg);
        inset-inline-start: calc(var(--_m) / 2 - var(--_g) / 2);
        inset-inline-end: auto;
        width: var(--_g);
        height: auto;
      }
      .groove {
        --_tr-z: -1.4;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        --_tex: none;
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        border-radius: var(--tr-radius-pill, 999px);
      }
      .fill {
        --_tr-z: 0.4;
        --_base: var(--tr-color-accent);
        --_edge: transparent;
        --_curve: 0.7;
        --_gloss: 0.6;
        --_brush: 0;
        --_spin: 0;
        --_mirror: 0;
        --_tex: none;
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        border-radius: inherit;
        translate: -101% 0;
        transition: translate var(--_dh) var(--_ease, ease-in-out) var(--_df);
      }
      :host(:dir(rtl)) .fill {
        translate: 101% 0;
      }
      :host([data-orientation='vertical']) .fill {
        translate: 0 -101%;
      }
      :host([data-filled]) .fill {
        translate: none;
      }

      /* ---------- the step: marker over label (or beside it, vertical) ---------- */
      .step {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5em;
        width: 100%;
        margin: 0;
        padding: 0 0.25em;
        border: 0;
        border-radius: var(--tr-radius-md, 10px);
        background: none;
        color: inherit;
        font: inherit;
        text-align: center;
        outline: none;
        -webkit-tap-highlight-color: transparent;
      }
      :host([data-orientation='vertical']) .step {
        flex-direction: row;
        align-items: flex-start;
        gap: 0.85em;
        padding: 0;
        text-align: start;
      }
      button.step {
        cursor: pointer;
      }
      button.step[aria-disabled='true'] {
        cursor: default;
      }
      :host([disabled]) button.step {
        cursor: not-allowed;
      }
      button.step:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 3px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }

      .marker {
        position: relative;
        flex: none;
        display: grid;
        place-items: center;
        width: var(--_m);
        height: var(--_m);
      }
      .socket {
        --_tr-z: -1.2;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        --_tex: none;
        position: absolute;
        inset: 0;
        border-radius: 50%;
        box-sizing: border-box;
      }
      /* the halo of a lit step, spilling onto the material around the socket */
      .halo {
        position: absolute;
        inset: -40%;
        border-radius: 50%;
        background: radial-gradient(closest-side, color-mix(in oklch, var(--_tone) calc(var(--_r) * 45%), transparent), transparent);
        opacity: 0;
        pointer-events: none;
        transition:
          opacity var(--_dh) ease-out var(--_dm),
          --_tone var(--_t) ease-out var(--_dm);
      }
      /* the plate that rises in the socket: material for the current step, lit accent when done */
      .cap {
        --_tr-z: -1;
        --_base: color-mix(in oklab, var(--_m-base), var(--tr-color-accent) calc(var(--_sel) * 100%));
        --_ink: color-mix(in oklab, var(--_m-ink), var(--tr-color-accent-ink, #fff) calc(var(--_sel) * 100%));
        --_curve: var(--tr-p-curve, 0.55);
        /* a done plate is glazed at least 0.45; follows --_sel, so the glaze fades in and out with the colour */
        --_gloss: calc(
          var(--tr-f-gloss, var(--tr-m-gloss, 0)) +
            var(--_sel) * max(0, 0.45 - var(--tr-f-gloss, var(--tr-m-gloss, 0)))
        );
        --_tex: none;
        position: absolute;
        inset: 12%;
        border-radius: 50%;
        box-sizing: border-box;
        border-color: color-mix(in oklch, var(--_base), var(--_sh) 28%);
        opacity: 0;
        scale: 0.7;
        transition:
          --_tr-z var(--_dh) var(--tr-motion-easing-spring, ease-out) var(--_dm),
          --_sel var(--_dh) ease-out var(--_dm),
          opacity var(--_t) ease-out var(--_dm),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out) var(--_dm);
      }
      /* the rim: accent on the current step, danger on a step with an error */
      .rim {
        position: absolute;
        inset: 6%;
        border-radius: 50%;
        border: 2px solid var(--_tone);
        box-shadow: 0 0 calc(3px + var(--_r) * 8px) color-mix(in oklch, var(--_tone) calc(var(--_r) * 40%), transparent);
        opacity: 0;
        pointer-events: none;
        transition:
          opacity var(--_t) ease-out var(--_dm),
          --_tone var(--_t) ease-out var(--_dm);
      }
      .glyphs {
        position: relative;
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }
      .glyphs > * {
        grid-area: 1 / 1;
        transition:
          opacity var(--_t) ease-out var(--_dm),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out) var(--_dm),
          color var(--_t) ease-out var(--_dm);
      }
      .num {
        color: color-mix(in oklch, var(--tr-color-ink) 58%, transparent);
      }
      .check,
      .bang {
        width: 52%;
        height: 52%;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0;
        scale: 0.6;
      }
      /* engraved into the lit plate: a dark cut with the light catching its lower lip */
      .check {
        stroke: var(--tr-color-accent-ink, #fff);
        stroke-width: 2.6;
        stroke-dasharray: 16;
        stroke-dashoffset: 16;
        filter: drop-shadow(0 calc(var(--_sy, 1) * -0.6px) 0 color-mix(in oklch, var(--_sh, #000) calc(var(--_r, 0.5) * 45%), transparent))
          drop-shadow(0 calc(var(--_sy, 1) * 0.6px) 0 color-mix(in oklab, var(--_hl, #fff) calc(var(--_r, 0.5) * 35%), transparent));
        transition:
          opacity var(--_t) ease-out var(--_dm),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out) var(--_dm),
          stroke-dashoffset var(--_dh) ease-out calc(var(--_dm) + 60ms);
      }
      .bang {
        stroke: var(--tr-color-danger);
        stroke-width: 2.8;
      }

      /* current: the plate stands raised in its socket, rimmed in accent */
      :host([data-state='current']) {
        --_tone: var(--tr-color-accent);
      }
      :host([data-state='current']) .cap {
        --_tr-z: 1.3;
        opacity: 1;
        scale: 1;
      }
      :host([data-state='current']) .rim,
      :host([data-state='current']) .halo {
        opacity: 1;
      }
      :host([data-state='current']) .num {
        color: var(--tr-color-ink);
      }
      /* complete: a lit accent plate, set flush, with the check cut into it */
      :host([data-state='complete']) {
        --_tone: var(--tr-color-accent);
      }
      :host([data-state='complete']) .cap {
        --_tr-z: 0.35;
        --_sel: 1;
        opacity: 1;
        scale: 1;
      }
      :host([data-state='complete']) .halo {
        opacity: 0.55;
      }
      :host([data-state='complete']) .num {
        opacity: 0;
        scale: 0.6;
      }
      :host([data-state='complete']) .check {
        opacity: 1;
        scale: 1;
        stroke-dashoffset: 0;
      }
      /* error: a danger rim and "!" in place of the number or check */
      :host([error]) {
        --_tone: var(--tr-color-danger);
      }
      :host([error]) .cap {
        --_sel: 0;
        --_tr-z: 1;
        opacity: 1;
        scale: 1;
      }
      :host([error]) .rim {
        opacity: 1;
      }
      :host([error]) .halo {
        opacity: 0.6;
      }
      :host([error]) .num,
      :host([error]) .check {
        opacity: 0;
        scale: 0.6;
      }
      :host([error]) .bang {
        opacity: 1;
        scale: 1;
      }
      /* a pickable step's plate lifts under the pointer */
      :host([data-pickable]) button.step:hover .cap {
        --_tr-z: 1.7;
        opacity: 1;
        scale: 1;
      }
      :host([data-pickable][data-state='complete']) button.step:hover .cap {
        --_tr-z: 0.9;
      }
      :host([data-pickable]) button.step:active .cap {
        --_tr-z: -0.2;
        transition-duration: var(--tr-motion-duration-press, 70ms);
        transition-delay: 0ms;
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: 0.15em;
        min-width: 0;
        max-width: 100%;
      }
      :host([data-orientation='vertical']) .text {
        padding-top: calc((var(--_m) - 1.3em) / 2);
      }
      .label {
        font-weight: var(--tr-font-weight-strong, 600);
        line-height: 1.3;
        overflow-wrap: anywhere;
        /* upcoming steps read quieter, still at text contrast */
        color: var(--tr-color-ink-muted);
        transition: color var(--_t) ease-out var(--_dm);
      }
      :host([data-state='current']) .label {
        color: var(--tr-color-ink);
      }
      :host([data-state='complete']) .label {
        color: color-mix(in oklch, var(--tr-color-ink) 80%, var(--tr-color-ink-muted));
      }
      :host([error]) .label {
        color: var(--tr-color-danger);
      }
      .description {
        font-size: 0.8125em;
        line-height: 1.35;
        overflow-wrap: anywhere;
        color: var(--tr-color-ink-muted);
      }
      .description:not(.has) {
        display: none;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (forced-colors: active) {
        .fill,
        :host([data-state='complete']) .cap {
          background: Highlight;
          forced-color-adjust: none;
        }
        .rim {
          border-color: Highlight;
        }
        :host([error]) .rim {
          border-color: Mark;
        }
        .check {
          stroke: HighlightText;
          filter: none;
        }
        .bang {
          stroke: CanvasText;
        }
      }
    `,
  ];

  /** Name of the step, for the stepper's `value`. */
  @property({ reflect: true }) value = '';

  /** The step needs attention (a danger rim and "!" replace its number). */
  @property({ type: Boolean, reflect: true }) error = false;

  /** The step cannot be picked. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Set by the stepper: complete, current or upcoming. */
  @property({ attribute: false }) state: StepState = 'upcoming';

  /** Set by the stepper: position in the list, from 0. */
  @property({ attribute: false }) index = 0;

  /** Set by the stepper: steps are buttons. */
  @property({ attribute: false }) clickable = false;

  /** Set by the stepper: this step can be picked now. */
  @property({ attribute: false }) pickable = false;

  /** Set by the stepper: this step holds the stepper's one Tab stop. */
  @property({ attribute: false }) tabbable = false;

  private hasDescription = false;

  /** The label's text, without the description. */
  get labelText(): string {
    let s = '';
    for (const n of this.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) s += n.textContent;
      else if (n instanceof Element && !n.hasAttribute('slot')) s += n.textContent;
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
  }

  /** Focuses the step's button (when the stepper is clickable). */
  override focus(options?: FocusOptions): void {
    const b = this.renderRoot?.querySelector<HTMLElement>('button.step');
    if (b) b.focus(options);
    else super.focus(options);
  }

  protected override render() {
    const s = this.state;
    const status = this.error ? 'needs attention' : s === 'complete' ? 'completed' : '';
    const inner = html`<span part="marker" class="marker" aria-hidden="true">
        <span class="halo"></span>
        <span class="socket surface"></span>
        <span class="cap surface"></span>
        <span class="rim"></span>
        <span class="glyphs">
          <span class="num">${this.index + 1}</span>
          <svg class="check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
          <svg class="bang" viewBox="0 0 16 16"><path d="M8 3.5v6M8 12.6v.1" /></svg>
        </span>
      </span>
      <span class="text">
        <span part="label" class="label"><slot @slotchange=${this.onSlot}></slot></span>
        <span part="description" class="description ${this.hasDescription ? 'has' : ''}"><slot name="description" @slotchange=${this.onSlot}></slot></span>
        <span class="sr">${status ? `, ${status}` : ''}</span>
      </span>`;
    const rails = html`<span part="rail" class="rail" aria-hidden="true"><span class="groove surface"><span class="fill surface"></span></span></span>`;
    if (!this.clickable) return html`${rails}<div part="step" class="step">${inner}</div>`;
    return html`${rails}<button
        part="step"
        class="step"
        type="button"
        tabindex=${this.tabbable ? '0' : '-1'}
        aria-current=${s === 'current' ? 'step' : nothing}
        aria-disabled=${this.pickable ? 'false' : 'true'}
        @click=${this.onClick}
      >
        ${inner}
      </button>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('data-state', this.state);
    // one aria-current per step: on the button when steps are clickable (that is what gets focus)
    this.aria('aria-current', this.state === 'current' && !this.clickable ? 'step' : null);
    this.toggleAttribute('data-pickable', this.clickable && this.pickable);
    // the stepper re-reads what it shows (labels, errors) when one of these changes
    if (changed.has('value') || changed.has('error') || changed.has('disabled')) {
      if (this.hasUpdated && (changed.get('value') !== undefined || changed.get('error') !== undefined || changed.get('disabled') !== undefined)) {
        this.dispatchEvent(new Event('tr-step-change', { bubbles: true, composed: true }));
      }
    }
  }

  private onSlot = (): void => {
    const d = this.querySelector(':scope > [slot="description"]') !== null;
    if (d !== this.hasDescription) {
      this.hasDescription = d;
      this.requestUpdate();
    }
    this.dispatchEvent(new Event('tr-step-change', { bubbles: true, composed: true }));
  };

  private onClick = (): void => {
    if (!this.pickable || this.disabled) return;
    this.dispatchEvent(new CustomEvent('tr-step-pick', { bubbles: true, composed: true, detail: { step: this } }));
  };
}

define('tr-step', TrStep);

declare global {
  interface HTMLElementTagNameMap {
    'tr-step': TrStep;
  }
}
