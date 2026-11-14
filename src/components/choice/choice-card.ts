import { css, html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { PressController } from '../../interaction/press.js';
// Importing a card defines its group too (and the group imports the card).
import './choice-group.js';

/**
 * One selectable card inside a `tr-choice-group`: a plan, a shipping option, an account type, a
 * workout template. The card is a raised plate; hovering lifts it a little, and choosing it
 * presses it into the surface with an accent rim, while a lit bead seats in its socket (a check
 * drops into a square socket when the group is `multiple`). The choice reads from depth, rim and
 * indicator, not only colour.
 *
 * The default slot is the title. Put a short line in the `description` slot, an icon or picture
 * in `start` and a price or figure in `end`. Wide cards lay out in a row; narrow cards (under
 * 24em, as in a three-column plan picker) stack: icon and indicator on top, then the title,
 * description and figure.
 *
 * Selection, focus and the form value are managed by the parent `tr-choice-group`.
 *
 * @summary Selectable card (role="radio", or "checkbox" in a multiple group); use inside tr-choice-group.
 * @tag tr-choice-card
 * @role radio
 *
 * @slot - Title. Also the start of the accessible name.
 * @slot description - Supporting text under the title.
 * @slot start - Icon, logo or picture.
 * @slot end - A figure such as a price ("$12/mo") or a delivery date.
 *
 * @csspart card - The card plate.
 * @csspart title - Wrapper around the title.
 * @csspart description - Wrapper around the description slot.
 * @csspart end - Wrapper around the end slot.
 * @csspart indicator - The socket holding the bead or check.
 *
 * @cssprop --tr-choice-card-padding - Inner padding. Defaults to 1em 1.1em.
 * @cssprop --tr-choice-card-radius - Corner radius. Defaults to --tr-radius-lg.
 * @cssprop --tr-choice-card-accent - Colour of the rim and indicator when chosen. Defaults to --tr-color-accent.
 *
 * @example <tr-choice-group label="Plan" name="plan" value="pro"><tr-choice-card value="free">Free<span slot="description">For trying things out</span><span slot="end">$0</span></tr-choice-card><tr-choice-card value="pro">Pro<span slot="description">Unlimited projects</span><span slot="end">$12/mo</span></tr-choice-card></tr-choice-group>
 */
export class TrChoiceCard extends TrompeElement {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled || this.groupDisabled });

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_acc: var(--tr-choice-card-accent, var(--tr-color-accent));
        --_rad: var(--tr-choice-card-radius, var(--tr-radius-lg, 14px));
        display: block;
        position: relative;
        min-width: 0;
        container: tr-choice-card / inline-size;
        cursor: pointer;
        user-select: none;
        outline: none;
        touch-action: manipulation;
        line-height: 1.3;
      }
      .card {
        --_tr-z: 1;
        /* text sits on this plate: tame reflections, keep any texture */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.35);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        --_reflect: 0.45;
        /* --_sel (registered) fades the chosen tint with the press */
        --_sel: 0;
        --_base: color-mix(in oklab, var(--_m-base), color-mix(in oklab, var(--_m-base), var(--_acc) 9%) calc(var(--_sel) * 100%));
        display: flex;
        align-items: flex-start;
        gap: 0.85em;
        height: 100%;
        padding: var(--tr-choice-card-padding, 1em 1.1em);
        border-radius: var(--_rad);
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          --_sel var(--tr-motion-duration-release, 160ms) ease-out,
          border-color var(--tr-motion-duration-release, 160ms) ease-out,
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      /* the accent rim: drawn over the 1px edge so the border width never changes */
      .card::after {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        border: 2px solid var(--_acc);
        box-shadow:
          0 0 0 1px color-mix(in oklch, var(--_acc) 18%, transparent),
          0 0 calc(4px + var(--_r) * 10px) color-mix(in oklch, var(--_acc) calc(var(--_r) * 30%), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host(:hover) .card {
        --_tr-z: 1.6;
      }
      :host([data-tr-pressed]) .card {
        --_tr-z: 0.2;
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      :host([selected]) .card {
        --_tr-z: -0.6;
        --_sel: 1;
        translate: calc(var(--_sx) * 0.5px) calc(var(--_sy) * 0.5px);
      }
      :host([selected][data-tr-pressed]) .card {
        --_tr-z: -1;
      }
      :host([selected]) .card::after {
        opacity: 1;
      }
      :host(:focus-visible) .card {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 3px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }

      .start {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 1.3em;
      }
      ::slotted([slot='start']) {
        flex: none;
        max-width: 3.5em;
        max-height: 3.5em;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2em;
      }
      .title {
        font-weight: var(--tr-font-weight-strong, 600);
        overflow-wrap: anywhere;
      }
      .description {
        font-size: 0.875em;
        color: color-mix(in oklch, currentColor 72%, transparent);
        overflow-wrap: anywhere;
      }
      .end {
        flex: none;
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      [hidden] {
        display: none !important;
      }

      /* ---- indicator: a socket with a lit bead (single) or a check (multiple) ---- */
      .socket {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        --_tex: none;
        flex: none;
        position: relative;
        width: 1.25em;
        height: 1.25em;
        margin-top: 0.03em;
        border-radius: 50%;
        transition: border-color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([data-multiple]) .socket {
        border-radius: 0.3em;
      }
      .socket::after {
        content: '';
        position: absolute;
        inset: -35%;
        border-radius: 50%;
        background: radial-gradient(closest-side, color-mix(in oklch, var(--_acc) calc(var(--_r) * 50%), transparent), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--tr-motion-duration-travel, 220ms);
      }
      :host([selected]) .socket::after {
        opacity: 1;
      }
      .bead {
        --_tr-z: 1;
        --_base: var(--_acc);
        --_curve: 0.9;
        --_brush: 0;
        --_spin: 0;
        --_tex: none;
        --_gloss: max(var(--tr-f-gloss, var(--tr-m-gloss, 0)), 0.55);
        position: absolute;
        inset: 22%;
        border-radius: 50%;
        border-color: color-mix(in oklch, var(--_acc), var(--_sh) 30%);
        opacity: 0;
        scale: 0.2;
        transition:
          opacity var(--tr-motion-duration-press, 70ms),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      :host([data-multiple]) .bead {
        inset: 8%;
        border-radius: 0.2em;
        --_curve: 0.35;
      }
      :host([selected]) .bead {
        opacity: 1;
        scale: 1;
      }
      .check {
        position: absolute;
        inset: 8%;
        width: 84%;
        height: 84%;
        fill: none;
        stroke: var(--tr-color-accent-ink, #fff);
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 14;
        stroke-dashoffset: 14;
        transition: stroke-dashoffset var(--tr-motion-duration-travel, 220ms) ease-out 40ms;
      }
      :host(:not([data-multiple])) .check {
        display: none;
      }
      :host([selected]) .check {
        stroke-dashoffset: 0;
      }

      /* ---- narrow cards stack: icon and indicator on top, then text and figure ---- */
      @container tr-choice-card (max-width: 24em) {
        .card {
          display: grid;
          grid-template-columns: 1fr auto;
          grid-template-areas: 'start ind' 'text text' 'end end';
          align-items: start;
          gap: 0.55em 0.75em;
        }
        .card.no-start {
          grid-template-areas: 'text ind' 'end end';
        }
        .start {
          grid-area: start;
          justify-content: flex-start;
        }
        .text {
          grid-area: text;
        }
        .end {
          grid-area: end;
          text-align: start;
          font-size: 1.15em;
        }
        .socket {
          grid-area: ind;
        }
      }

      :host([disabled]),
      :host([data-group-disabled]) {
        cursor: not-allowed;
      }
      :host([disabled]) .card,
      :host([data-group-disabled]) .card {
        opacity: 0.5;
        --_tr-z: 0.5;
      }
      @media (pointer: coarse) {
        .card {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        :host([selected]) .card::after {
          border-color: Highlight;
          forced-color-adjust: none;
        }
        .socket {
          border-color: ButtonText;
          background: Field;
        }
        .bead {
          background: Highlight;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Value the group takes when this card is chosen. Defaults to the title text. */
  @property({ reflect: true }) value = '';

  /** Whether this card is chosen. Managed by the group; set it in markup to pick the initial choice. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Makes this card unavailable. Arrow keys skip it. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Set by the group when the whole group is disabled. */
  @state() groupDisabled = false;

  @state() private has = { start: false, description: false, end: false };

  /** The value used by the group: `value`, or the title text. */
  get choiceValue(): string {
    if (this.value) return this.value;
    return [...this.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && !n.hasAttribute('slot')))
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', this.closest('tr-choice-group')?.hasAttribute('multiple') ? 'checkbox' : 'radio');
  }

  protected override render() {
    const { start, description, end } = this.has;
    return html`<div part="card" class="card surface ${start ? '' : 'no-start'}">
      <span class="start" ?hidden=${!start}><slot name="start" @slotchange=${this.onSlot}></slot></span>
      <span class="text">
        <span part="title" class="title"><slot></slot></span>
        <span part="description" class="description" ?hidden=${!description}><slot name="description" @slotchange=${this.onSlot}></slot></span>
      </span>
      <span part="end" class="end" ?hidden=${!end}><slot name="end" @slotchange=${this.onSlot}></slot></span>
      <span part="indicator" class="socket surface" aria-hidden="true"
        ><span class="bead surface"></span
        ><svg class="check" viewBox="0 0 16 16"><path d="M3.6 8.4l2.9 2.9 5.9-6.6" /></svg
      ></span>
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-checked', String(this.selected));
    this.aria('aria-disabled', this.disabled || this.groupDisabled ? 'true' : null);
    this.toggleAttribute('data-group-disabled', this.groupDisabled);
  }

  private onSlot(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    const filled = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
    this.has = { ...this.has, [slot.name]: filled };
  }
}

define('tr-choice-card', TrChoiceCard);

declare global {
  interface HTMLElementTagNameMap {
    'tr-choice-card': TrChoiceCard;
  }
}
