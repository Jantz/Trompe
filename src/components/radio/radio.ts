import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { PressController } from '../../interaction/press.js';
// Importing a radio defines its group too (and the group imports the radio).
import './radio-group.js';

/**
 * One choice inside a `tr-radio-group`: a round socket sunk into the surface. When selected a
 * domed, lit bead seats itself in the socket, so the state reads from the bead's presence, not
 * only from color. Selection, focus and form value are managed by the parent `tr-radio-group`.
 *
 * @summary Radio button (role="radio"); use inside tr-radio-group.
 * @tag tr-radio
 * @role radio
 *
 * @slot - Visible label. Also the accessible name.
 *
 * @csspart socket - The recessed round socket.
 * @csspart bead - The lit bead shown when selected.
 * @csspart label - Wrapper around the label slot.
 *
 * @cssprop --tr-radio-size - Diameter of the socket. Defaults to 1.25em.
 * @cssprop --tr-radio-on-color - Color of the bead. Defaults to --tr-color-accent.
 *
 * @example <tr-radio-group label="Plan"><tr-radio value="free">Free</tr-radio><tr-radio value="pro" checked>Pro</tr-radio></tr-radio-group>
 */
export class TrRadio extends TrompeElement {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled });

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_s: var(--tr-radio-size, 1.25em);
        --_on: var(--tr-radio-on-color, var(--tr-color-accent));
        display: inline-flex;
        align-items: center;
        gap: 0.65em;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        line-height: 1.3;
        min-height: var(--_s);
      }
      :host([size='sm']) {
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .socket {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        flex: none;
        position: relative;
        width: var(--_s);
        height: var(--_s);
        border-radius: 50%;
        transition: --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host(:hover) .socket {
        --_tr-z: -1.4;
      }
      /* the glow the bead throws onto the socket walls */
      .socket::after {
        content: '';
        position: absolute;
        inset: -35%;
        border-radius: 50%;
        background: radial-gradient(closest-side, color-mix(in oklch, var(--_on) calc(var(--_r) * 55%), transparent), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--tr-motion-duration-travel, 220ms);
      }
      :host([checked]) .socket::after {
        opacity: 1;
      }
      .bead {
        --_tr-z: 1;
        --_base: var(--_on);
        --_curve: var(--tr-p-curve, 0.9);
        --_brush: 0;
        --_spin: 0;
        --_gloss: max(var(--tr-f-gloss, var(--tr-m-gloss, 0)), 0.55);
        position: absolute;
        inset: 22%;
        border-radius: 50%;
        border-color: color-mix(in oklch, var(--_on), var(--_sh) 30%);
        opacity: 0;
        scale: 0.2;
        transition:
          opacity var(--tr-motion-duration-press, 70ms),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      :host([checked]) .bead {
        opacity: 1;
        scale: 1;
      }
      :host([data-tr-pressed]) .bead {
        scale: 0.85;
      }
      .label:not(.has-label) {
        display: none;
      }
      :host([disabled]) {
        cursor: not-allowed;
        opacity: 0.55;
      }
      @media (pointer: coarse) {
        :host {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
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

  /** Whether this radio is the selected one. Set it to select it (the group unchecks the others). */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Value the group takes when this radio is selected. */
  @property({ reflect: true }) value = '';

  /** Makes this choice unavailable. Arrow keys skip it. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Size of the radio. Usually set on the group. */
  @property({ reflect: true }) size?: Size;

  private hasLabel = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'radio');
  }

  protected override render() {
    return html`<span part="socket" class="socket surface focus-ring"><span part="bead" class="bead surface"></span></span>
      <span part="label" class="label ${this.hasLabel ? 'has-label' : ''}"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-checked', String(this.checked));
    this.aria('aria-disabled', this.disabled ? 'true' : null);
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.hasLabel = slot.assignedNodes({ flatten: true }).some((n) => n.textContent?.trim() || n.nodeType === 1);
    this.requestUpdate();
  }
}

define('tr-radio', TrRadio);

declare global {
  interface HTMLElementTagNameMap {
    'tr-radio': TrRadio;
  }
}
