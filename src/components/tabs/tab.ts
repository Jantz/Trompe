import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { PressController } from '../../interaction/press.js';

let nextId = 0;

/**
 * One tab of a `tr-tabs` set. In the default `folder` look it is a file-folder tab: the selected
 * tab stands taller, joins the panel below it with no seam and carries a raised marker bar, while
 * the others sit tucked behind the folder, lower and dimmer. In the `keys` look it is a latching
 * key: the selected key is pressed into the strip and its lamp is lit. The selected tab is also
 * set in bold, so selection never relies on color.
 *
 * Place it directly inside `tr-tabs`; the parent manages selection, focus and ARIA linkage.
 *
 * @summary A tab (role="tab") inside tr-tabs.
 * @tag tr-tab
 * @role tab
 *
 * @slot - Tab label.
 * @slot start - Icon before the label.
 * @slot end - Content after the label, such as a tr-badge count.
 *
 * @csspart tab - The physical tab surface.
 * @csspart label - Wrapper around the label slot.
 * @csspart marker - The selection marker (folder) or lamp (keys).
 *
 * @cssprop --tr-tab-padding-inline - Horizontal padding. Defaults to 1.1em.
 * @cssprop --tr-tab-radius - Corner radius of the tab. Defaults to --tr-radius-md.
 * @cssprop --tr-tab-marker-color - Color of the selection marker and lamp. Defaults to --tr-color-accent.
 *
 * @example <tr-tab panel="general">General</tr-tab>
 * @example <tr-tab disabled>Billing</tr-tab>
 */
export class TrTab extends TrompeElement {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled });

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_pad: var(--tr-tab-padding-inline, 1.1em);
        --_rad: var(--tr-tab-radius, var(--tr-radius-md, 10px));
        --_mark: var(--tr-tab-marker-color, var(--tr-color-accent));
        display: inline-flex;
        position: relative;
        flex: none;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        outline: none;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        width: 100%;
        min-height: 2.5em;
        padding: 0 var(--_pad);
        line-height: 1.2;
        white-space: nowrap;
        font-weight: var(--tr-font-weight-regular, 400);
        /* text sits on this plate: tame reflections */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          background-color var(--tr-motion-duration-release, 160ms),
          color var(--tr-motion-duration-release, 160ms),
          font-weight var(--tr-motion-duration-release, 160ms),
          --_sel var(--tr-motion-duration-travel, 220ms) ease-out,
          min-height var(--tr-motion-duration-travel, 220ms) ease-out,
          padding var(--tr-motion-duration-travel, 220ms) ease-out,
          margin var(--tr-motion-duration-travel, 220ms) ease-out,
          clip-path var(--tr-motion-duration-travel, 220ms) ease-out;
      }
      /* bold label, but reserve the bold width so tabs never jump */
      .label {
        display: inline-grid;
      }
      .label::after {
        content: attr(data-text);
        font-weight: var(--tr-font-weight-strong, 600);
        visibility: hidden;
        height: 0;
        overflow: hidden;
      }
      :host([selected]) .tab {
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .marker {
        display: none;
      }

      /* ---------- folder: tabs tucked behind the folder, the selected one in front ---------- */
      :host([data-variant='folder']) {
        /* the folder surface sits at z-index 1: unselected tabs go behind it, the selected in front */
        z-index: 0;
        /* the tab comes forward as it rises (z-index steps 0, 1, 2 during the move) */
        transition: z-index var(--tr-motion-duration-release, 160ms) step-end;
      }
      :host([data-variant='folder'][selected]) {
        z-index: 2;
        transition-timing-function: step-start;
      }
      :host([data-variant='folder']) .tab {
        --_tr-z: 1;
        border-radius: var(--_rad) var(--_rad) 0 0;
        /* --_sel (registered, 0 tucked .. 1 selected) blends every colour between the two states */
        --_sel: 0;
        /* tucked behind: darker, lower, dimmer ink */
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) calc((7% + var(--tr-lift, 0) * 10%) * (1 - var(--_sel))));
        --_ink: color-mix(in oklch, var(--_m-ink) calc(70% + var(--_sel) * 30%), var(--_base));
        --_join: color-mix(in oklch, var(--_face), var(--_hl) calc(var(--_spec) * 52%));
        --_layer: linear-gradient(to bottom, transparent 35%, color-mix(in oklch, var(--_join) calc(var(--_sel) * 100%), transparent) calc(100% - 3px));
        translate: 0 0.3em;
        padding-bottom: 0.3em;
        clip-path: inset(-2em -2em -2em -2em);
      }
      :host([data-variant='folder']:hover:not([selected]):not([disabled])) .tab {
        translate: 0 0.12em;
        --_ink: var(--_m-ink);
      }
      /* the selected tab grows down over the folder's top edge, its foot trimmed off, and its face
         blends into the folder's lit top so tab and folder read as one piece */
      :host([data-variant='folder'][selected]) .tab {
        --_sel: 1;
        translate: none;
        min-height: calc(2.5em + 0.3em);
        padding-bottom: 4px;
        margin-bottom: -4px;
        clip-path: inset(-2em -2em 2px -2em);
      }
      /* concave flares where the tab foot meets the folder */
      :host([data-variant='folder']) .tab::after {
        content: '';
        opacity: 0;
        transition: opacity var(--tr-motion-duration-travel, 220ms) ease-out;
        position: absolute;
        bottom: 2px;
        height: var(--_flare);
        inset-inline: calc(-1 * var(--_flare) - 1px);
        --_flare: min(0.5em, var(--_rad));
        pointer-events: none;
        background:
          radial-gradient(circle at 0 0, transparent calc(var(--_flare) - 1px), var(--_edge) var(--_flare), var(--_join) calc(var(--_flare) + 0.5px)) left bottom / calc(var(--_flare) + 1px) 100% no-repeat,
          radial-gradient(circle at 100% 0, transparent calc(var(--_flare) - 1px), var(--_edge) var(--_flare), var(--_join) calc(var(--_flare) + 0.5px)) right bottom / calc(var(--_flare) + 1px) 100% no-repeat;
      }
      :host([data-variant='folder'][selected]) .tab::after {
        opacity: 1;
      }
      :host([data-variant='folder']) .marker {
        display: block;
        position: absolute;
        inset: 0.28em 30% auto;
        height: 0.22em;
        border-radius: 1em;
        background: var(--_mark);
        box-shadow:
          0 calc(var(--_sy) * 1px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 70%), transparent),
          inset 0 calc(var(--_sy) * -1px) 1px color-mix(in oklch, var(--_sh) calc(var(--_r) * 35%), transparent),
          0 0 calc(var(--_r) * 6px) color-mix(in oklch, var(--_mark) calc(var(--_r) * 60%), transparent);
        opacity: 0;
        scale: 0.4 1;
        transition:
          opacity var(--tr-motion-duration-release, 160ms),
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([data-variant='folder'][selected]) .marker {
        opacity: 1;
        scale: 1 1;
      }
      /* vertical folder: tabs on the start side, joining the folder's left edge */
      :host([data-variant='folder'][data-orientation='vertical']) .tab {
        justify-content: flex-start;
        border-radius: var(--_rad) 0 0 var(--_rad);
        translate: 0.3em 0;
        padding-bottom: 0;
        padding-right: calc(var(--_pad) + 0.3em);
      }
      :host([data-variant='folder'][data-orientation='vertical']:hover:not([selected]):not([disabled])) .tab {
        translate: 0.12em 0;
      }
      :host([data-variant='folder'][data-orientation='vertical']) .tab {
        --_layer: linear-gradient(to right, transparent 55%, color-mix(in oklch, var(--_join) calc(var(--_sel) * 100%), transparent) calc(100% - 3px));
      }
      :host([data-variant='folder'][data-orientation='vertical'][selected]) .tab {
        translate: none;
        min-height: 2.5em;
        padding-bottom: 0;
        margin-bottom: 0;
        padding-right: calc(var(--_pad) + 4px);
        padding-left: calc(var(--_pad) + 0.3em);
        width: calc(100% + 4px);
        margin-right: -4px;
        clip-path: inset(-2em 2px -2em -2em);
      }
      :host([data-variant='folder'][data-orientation='vertical']) .tab::after {
        display: none;
      }
      :host([data-variant='folder'][data-orientation='vertical']) .marker {
        inset: 25% auto 25% 0.3em;
        width: 0.22em;
        height: auto;
        scale: 1 0.4;
      }
      :host([data-variant='folder'][data-orientation='vertical'][selected]) .marker {
        scale: 1 1;
      }

      /* ---------- keys: latching keys in a recessed strip ---------- */
      :host([data-variant='keys']) .tab {
        --_tr-z: 1;
        --_curve-default: 0.3;
        border-radius: calc(var(--_rad) * 0.7);
        min-height: 2.25em;
      }
      :host([data-variant='keys']:hover:not([selected]):not([disabled])) .tab {
        --_tr-z: 1.5;
      }
      :host([data-variant='keys'][data-tr-pressed]:not([disabled])) .tab,
      :host([data-variant='keys'][selected]) .tab {
        --_tr-z: -1;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        background-color: color-mix(in oklch, var(--_face), var(--_sh) calc(6% - var(--_r) * 3%));
      }
      :host([data-variant='keys']) .marker {
        display: block;
        flex: none;
        width: 0.45em;
        height: 0.45em;
        border-radius: 50%;
        background: color-mix(in oklch, var(--_ink) 22%, transparent);
        box-shadow: inset 0 1px 1px color-mix(in oklch, var(--_sh) 40%, transparent);
        transition: background-color var(--tr-motion-duration-release, 160ms), box-shadow var(--tr-motion-duration-release, 160ms);
      }
      :host([data-variant='keys'][selected]) .marker {
        background: var(--_mark);
        box-shadow:
          0 0 calc(2px + var(--_r) * 6px) var(--_mark),
          inset 0 -1px 1px color-mix(in oklch, var(--_sh) 30%, transparent);
      }

      :host([disabled]) {
        cursor: not-allowed;
      }
      :host([disabled]) .tab {
        opacity: 0.5;
      }
      :host(:focus-visible) .tab {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: -4px;
      }
      ::slotted(svg) {
        flex: none;
      }
      @media (pointer: coarse) {
        .tab {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        :host([selected]) .tab {
          border: 2px solid Highlight;
        }
        :host([selected]) .marker {
          background: Highlight;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Whether this tab is the selected one. Managed by tr-tabs; set it to choose the initial tab. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Disables the tab: skipped by arrow keys and not selectable. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** `name` of the tr-tab-panel this tab shows. Unset = the panel at the same position. */
  @property({ reflect: true }) panel = '';

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('slot')) this.setAttribute('slot', 'tab');
    this.setAttribute('role', 'tab');
    if (!this.id) this.id = `tr-tab-${++nextId}`;
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
  }

  protected override render() {
    return html`<span part="tab" class="tab surface">
      <span part="marker" class="marker" aria-hidden="true"></span>
      <slot name="start"></slot>
      <span part="label" class="label" data-text=${this.labelText}><slot @slotchange=${this.onSlotChange}></slot></span>
      <slot name="end"></slot>
    </span>`;
  }

  private labelText = '';

  private onSlotChange(e: Event): void {
    const nodes = (e.target as HTMLSlotElement).assignedNodes({ flatten: true });
    this.labelText = nodes.map((n) => n.textContent ?? '').join('').trim();
    this.requestUpdate();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-selected', String(this.selected));
    this.aria('aria-disabled', this.disabled ? 'true' : null);
  }
}

define('tr-tab', TrTab);

declare global {
  interface HTMLElementTagNameMap {
    'tr-tab': TrTab;
  }
}
