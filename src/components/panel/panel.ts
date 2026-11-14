import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/** Fixed, irregular screw-slot angles: real screws never line up. */
const SCREW_ANGLES = [-28, 63, 14, -71];

/**
 * A chassis, faceplate or card: the physical surface other controls are mounted on. Optionally
 * fastened with four corner screws and framed by a machined bezel around an inset well, like the
 * front panel of studio gear. It is a size container (`container-name: tr-panel`), so its
 * contents can respond to the panel's width with container queries.
 *
 * Purely presentational: it has no role. Put a heading in the `header` slot, or wrap it in a
 * `<section aria-labelledby>`, if the panel is a region.
 *
 * @summary Chassis, faceplate or card surface with optional screws and bezel.
 * @tag tr-panel
 *
 * @slot - Panel content.
 * @slot header - Title strip above the content, separated by an engraved line.
 * @slot footer - Strip below the content, separated by an engraved line.
 *
 * @csspart chassis - The physical panel surface.
 * @csspart header - Wrapper around the header slot.
 * @csspart content - Wrapper around the default slot (without `bezel`).
 * @csspart bezel - The machined frame around the well (with `bezel`).
 * @csspart well - The inset content well (with `bezel`).
 * @csspart footer - Wrapper around the footer slot.
 * @csspart screw - Each corner screw.
 *
 * @cssprop --tr-panel-container-type - container-type of the panel. Defaults to inline-size, which means the panel takes its width from its container, not its content: in shrink-to-fit layouts (auto grid tracks, inline-flex) give it a width or set this to normal.
 * @cssprop --tr-panel-radius - Corner radius. Defaults to --tr-radius-lg.
 * @cssprop --tr-panel-reflect - 0..1 strength of gloss, mirror and brushed reflections on the panel face. Defaults to 0.4.
 * @cssprop --tr-panel-padding - Inner padding. Defaults by the `padding` attribute.
 * @cssprop --tr-panel-gap - Space between header, content and footer. Defaults to 0.75em.
 * @cssprop --tr-panel-bezel-width - Width of the chamfered lip around the well. Defaults to 0.3em.
 * @cssprop --tr-panel-well-color - Color of the inset well. Defaults to --tr-color-well.
 * @cssprop --tr-panel-screw-size - Diameter of the corner screws. Defaults to 0.8em.
 * @cssprop --tr-panel-screw-inset - Distance from the corner to the screw center. Defaults to 0.95em.
 * @cssprop --tr-panel-screw-color - Screw head color. Defaults to the metal material.
 * @cssprop --tr-panel-screw-cross - 1 for cross-head (Phillips) screws, 0 for slotted. Defaults to 0.
 *
 * @example <tr-panel screws material="metal"><span slot="header">Channel 1</span>…</tr-panel>
 * @example <tr-panel bezel screws padding="lg" material="metal" finish="brushed">…</tr-panel>
 */
export class TrPanel extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 2;
        --_pad: var(--tr-panel-padding, 1.25em);
        --_gap: var(--tr-panel-gap, 0.75em);
        --_screw: var(--tr-panel-screw-size, 0.8em);
        --_screw-at: var(--tr-panel-screw-inset, 0.95em);
        --_radius: var(--tr-panel-radius, var(--tr-radius-lg, 16px));
        display: block;
        container-name: tr-panel;
        /* inline-size containment drops the panel's intrinsic width: in shrink-to-fit layouts
           (auto grid tracks, floats, inline-flex) give it a width or set this to normal */
        container-type: var(--tr-panel-container-type, inline-size);
      }
      :host([padding='none']) {
        --_pad: var(--tr-panel-padding, 0px);
      }
      :host([padding='sm']) {
        --_pad: var(--tr-panel-padding, 0.75em);
      }
      :host([padding='lg']) {
        --_pad: var(--tr-panel-padding, 2em);
      }
      .chassis {
        /* big faces read better with calmer reflections */
        --_reflect: var(--tr-panel-reflect, 0.4);
        --_tr-z: var(--_depth);
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
        min-height: 100%;
        padding: var(--_pad);
        border-radius: var(--_radius);
      }
      /* screws need clearance from the content */
      :host([screws]:not([padding='none'])) .chassis {
        padding: max(var(--_pad), calc(var(--_screw-at) + var(--_screw) / 2 + 0.35em));
      }
      :host([screws]:not([padding='none'])) .chassis.bezelled {
        padding: max(var(--_pad), calc(var(--_screw-at) * 2 + var(--_screw) / 2 - 0.2em));
      }
      .header,
      .footer {
        display: flex;
        align-items: center;
        gap: 0.75em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.04em;
      }
      .header {
        padding-bottom: var(--_gap);
        /* engraved line: a dark cut with the light catching its far edge */
        border-bottom: 1px solid color-mix(in oklch, var(--_sh) calc(20% + var(--_r) * 15%), transparent);
        box-shadow: 0 1px 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }
      .footer {
        padding-top: var(--_gap);
        border-top: 1px solid color-mix(in oklch, var(--_sh) calc(20% + var(--_r) * 15%), transparent);
        box-shadow: inset 0 1px 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }
      .header:not(.has),
      .footer:not(.has) {
        display: none;
      }
      .content {
        flex: 1;
        min-width: 0;
      }

      /* ---------- bezel: a machined lip around an inset well ---------- */
      .bezel {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: var(--tr-panel-bezel-width, 0.3em);
        border-radius: calc(var(--_radius) * 0.7);
        /* the chamfer slopes down into the well: the side facing the light is lit, the side
           nearest the light falls into shade */
        background:
          conic-gradient(
            from var(--tr-light-angle, 330deg),
            color-mix(in oklch, var(--_sh) calc(18% + var(--_r) * 40%), var(--_m-base)) 0deg,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 15%), var(--_m-base)) 80deg,
            color-mix(in oklch, var(--_hl) calc(30% + var(--_r) * 50%), var(--_m-base)) 180deg,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 15%), var(--_m-base)) 280deg,
            color-mix(in oklch, var(--_sh) calc(18% + var(--_r) * 40%), var(--_m-base)) 360deg
          );
        box-shadow:
          /* the crisp top edge of the cut */
          0 0 0 1px color-mix(in oklch, var(--_sh) calc(12% + var(--_r) * 18%), transparent),
          calc(var(--_sx) * -1px) calc(var(--_sy) * -1px) 0 1px color-mix(in oklch, var(--_hl) calc(var(--_r) * 50%), transparent);
      }
      .well {
        --_tr-z: -2;
        --_base: var(--tr-panel-well-color, var(--tr-color-well));
        --_ink: var(--tr-color-ink);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        flex: 1;
        padding: var(--_pad);
        border-radius: calc(var(--_radius) * 0.55);
      }
      :host([padding='none']) .well {
        padding: 0;
      }

      /* ---------- screws ---------- */
      .screw {
        --_la: calc(var(--tr-light-angle, 330deg) - var(--_rot));
        --_ssx: calc(-1 * sin(var(--_la)));
        --_ssy: cos(var(--_la));
        --_metal-base: var(--tr-panel-screw-color, var(--tr-material-metal-base, oklch(83% 0.006 250)));
        position: absolute;
        width: var(--_screw);
        aspect-ratio: 1;
        border-radius: 50%;
        translate: -50% -50%;
        pointer-events: none;
        background:
          /* lathe rings on the head */
          repeating-radial-gradient(
            circle,
            color-mix(in oklch, var(--_sh) calc(var(--_r) * 8%), transparent) 0 0.5px,
            transparent 0.5px 1.5px
          ),
          /* domed head lit from the scene light */
          radial-gradient(
            circle farthest-corner at calc(50% - var(--_sx) * 30%) calc(50% - var(--_sy) * 30%),
            color-mix(in oklch, var(--_hl) calc(30% + var(--_r) * 60%), var(--_metal-base)) 0%,
            var(--_metal-base) 35%,
            color-mix(in oklch, var(--_sh) calc(20% + var(--_r) * 45%), var(--_metal-base)) 100%
          );
        box-shadow:
          /* countersink: a dark ring, then the hole's far lip catching the light */
          0 0 0 1px color-mix(in oklch, var(--_sh) calc(30% + var(--_r) * 35%), transparent),
          calc(var(--_sx) * 0.8px) calc(var(--_sy) * 0.8px) 0 1.5px color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent),
          calc(var(--_sx) * 1px) calc(var(--_sy) * 1px) calc(1px + var(--_r) * 1.5px) 0 color-mix(in oklch, var(--_sh) calc(var(--_r) * 45%), transparent),
          inset calc(var(--_sx) * -0.6px) calc(var(--_sy) * -0.6px) 0 0.5px color-mix(in oklch, var(--_hl) calc(var(--_r) * 50%), transparent);
      }
      .screw::before,
      .screw::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 78%;
        height: 17%;
        translate: -50% -50%;
        rotate: var(--_rot);
        border-radius: 1px;
        background: color-mix(in oklch, var(--_sh) 75%, var(--_metal-base));
        /* depth of the slot: the wall nearest the light shades its floor, the far wall is lit */
        box-shadow:
          inset calc(var(--_ssx) * 1px) calc(var(--_ssy) * 1px) 0.5px color-mix(in oklch, var(--_sh) 80%, transparent),
          inset calc(var(--_ssx) * -0.7px) calc(var(--_ssy) * -0.7px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 45%), transparent);
      }
      .screw::before {
        rotate: calc(var(--_rot) + 90deg);
        width: 60%;
        opacity: var(--tr-panel-screw-cross, 0);
      }
      .screw:nth-of-type(1) {
        left: var(--_screw-at);
        top: var(--_screw-at);
      }
      .screw:nth-of-type(2) {
        left: calc(100% - var(--_screw-at));
        top: var(--_screw-at);
      }
      .screw:nth-of-type(3) {
        left: calc(100% - var(--_screw-at));
        top: calc(100% - var(--_screw-at));
      }
      .screw:nth-of-type(4) {
        left: var(--_screw-at);
        top: calc(100% - var(--_screw-at));
      }
      @media (forced-colors: active) {
        .chassis {
          border-color: CanvasText;
        }
        .bezel {
          background: CanvasText;
          forced-color-adjust: none;
        }
        .well {
          background: Canvas;
          forced-color-adjust: none;
        }
        .screw {
          background: CanvasText;
          forced-color-adjust: none;
        }
        .screw::before,
        .screw::after {
          background: Canvas;
          box-shadow: none;
        }
      }
    `,
  ];

  /** Draws four corner screws fastening the panel. */
  @property({ type: Boolean, reflect: true }) screws = false;

  /** Frames the content in a machined bezel around an inset well. */
  @property({ type: Boolean, reflect: true }) bezel = false;

  /** Inner padding. */
  @property({ reflect: true }) padding: 'none' | 'sm' | 'md' | 'lg' = 'md';

  private has = { header: false, footer: false };

  protected override render() {
    return html`<div part="chassis" class="chassis surface ${this.bezel ? 'bezelled' : ''}">
      ${this.screws
        ? SCREW_ANGLES.map((a) => html`<span part="screw" class="screw" style="--_rot: ${a}deg" aria-hidden="true"></span>`)
        : nothing}
      <div part="header" class="header ${this.has.header ? 'has' : ''}"><slot name="header" @slotchange=${this.onSlotChange}></slot></div>
      ${this.bezel
        ? html`<div part="bezel" class="bezel"><div part="well" class="well surface"><slot></slot></div></div>`
        : html`<div part="content" class="content"><slot></slot></div>`}
      <div part="footer" class="footer ${this.has.footer ? 'has' : ''}"><slot name="footer" @slotchange=${this.onSlotChange}></slot></div>
    </div>`;
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    const key = slot.name as 'header' | 'footer';
    const has = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
    if (has !== this.has[key]) {
      this.has = { ...this.has, [key]: has };
      this.requestUpdate();
    }
  }
}

define('tr-panel', TrPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tr-panel': TrPanel;
  }
}
