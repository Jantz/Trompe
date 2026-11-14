import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

/** Named lamp colors. Any other value of `color` is used as a CSS color. */
export const ledColors: Record<string, string> = {
  red: 'oklch(64% 0.25 27)',
  green: 'oklch(82% 0.24 142)',
  amber: 'oklch(82% 0.17 68)',
  yellow: 'oklch(92% 0.19 102)',
  blue: 'oklch(66% 0.2 256)',
  white: 'oklch(97% 0.02 250)',
};

/**
 * An indicator lamp: a domed lens seated in a small bezel. Off, the lens is dark tinted plastic that
 * still shows its color and a specular glint from the room light. On, the die burns white-hot in the
 * centre, the lens fills with color and blooms onto the panel around it.
 *
 * Accessibility: with `label` the lamp is `role="img"` named "{label}: on" / "off" / "blinking",
 * so its state is never conveyed by color or light alone. Without `label` (and without your own
 * aria-label) it is decorative and hidden from assistive technology, for use inside a control that
 * already exposes the state (for example a toggle button). Blinking stops, steady on, under
 * prefers-reduced-motion.
 *
 * @summary Indicator lamp (LED) with an off lens, glow, bloom and blink.
 * @tag tr-led
 * @role img
 *
 * @csspart housing - The bezel the lens is seated in (a Trompe surface: follows material).
 * @csspart lens - The lens in its off state.
 * @csspart light - The lit layer over the lens (glow and bloom).
 *
 * @cssprop --tr-led-color - Lamp color. Overrides the `color` attribute default.
 * @cssprop --tr-led-size - Lens diameter (or height for bar). Defaults by size: 0.6em, 0.8em, 1.1em.
 * @cssprop --tr-led-glow - Bloom strength, 0 to 2. Defaults to 1 (scaled by realism).
 * @cssprop --tr-led-bezel - Width of the bezel ring around the lens. Defaults to 0.18 x size; 0 for none.
 * @cssprop --tr-led-blink-period - One on/off cycle when blinking. Defaults to 1s.
 *
 * @example <tr-led on color="green" label="Power"></tr-led>
 * @example <tr-led blink color="red" label="Record" size="lg"></tr-led>
 * @example <tr-led on shape="bar" color="amber" label="Clip" material="chrome"></tr-led>
 */
export class TrLed extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 1;
        --_curve-default: 0.7;
        --_size: var(--tr-led-size, 0.8em);
        --_glow: calc(var(--tr-led-glow, 1) * (0.35 + var(--_r)));
        display: inline-block;
        vertical-align: middle;
        line-height: 0;
      }
      :host([size='sm']) {
        --_size: var(--tr-led-size, 0.6em);
      }
      :host([size='lg']) {
        --_size: var(--tr-led-size, 1.1em);
      }
      .housing {
        --_tr-z: var(--_depth);
        --_ring: var(--tr-led-bezel, calc(var(--_size) * 0.18));
        display: inline-block;
        padding: var(--_ring);
        border-radius: 50%;
      }
      .lens,
      .light {
        --_w: var(--_size);
        display: block;
        width: var(--_w);
        height: var(--_size);
        border-radius: 50%;
      }
      :host([shape='square']) .housing {
        border-radius: calc(var(--_size) * 0.22);
      }
      :host([shape='square']) .lens,
      :host([shape='square']) .light {
        border-radius: calc(var(--_size) * 0.12);
      }
      :host([shape='bar']) .housing {
        border-radius: calc(var(--_size) * 0.25);
      }
      :host([shape='bar']) .lens,
      :host([shape='bar']) .light {
        --_w: calc(var(--_size) * 2.6);
        border-radius: calc(var(--_size) * 0.14);
      }
      .lens {
        position: relative;
        /* off: tinted plastic, darker at the rim, a hint of the die visible in the middle */
        background:
          radial-gradient(
            ellipse 52% 40% at calc(50% - var(--_sx) * 18%) calc(50% - var(--_sy) * 24%),
            oklch(100% 0 0 / calc(0.1 + var(--_r) * 0.35)) 0%,
            oklch(100% 0 0 / calc(var(--_r) * 0.08)) 60%,
            transparent 100%
          ),
          radial-gradient(
            closest-side at 50% 54%,
            oklch(from var(--_c) calc(l * 0.36 + 0.06) calc(c * 0.55) h) 0%,
            oklch(from var(--_c) calc(l * 0.26 + 0.03) calc(c * 0.5) h) 55%,
            oklch(from var(--_c) calc(l * 0.12 + 0.02) calc(c * 0.35) h) 100%
          );
        box-shadow:
          inset calc(var(--_sx) * var(--_size) * 0.08) calc(var(--_sy) * var(--_size) * 0.1) calc(var(--_size) * 0.12) oklch(0% 0 0 / 0.55),
          inset 0 0 0 max(1px, calc(var(--_size) * 0.04)) oklch(0% 0 0 / 0.45);
      }
      /* on: everything lives on one layer so blinking only animates opacity (compositor-only) */
      .light {
        position: absolute;
        inset: 0;
        opacity: 0;
        background:
          radial-gradient(
            closest-side at 50% 52%,
            oklch(from var(--_c) 0.99 calc(c * 0.18) h) 0%,
            oklch(from var(--_c) calc(l * 0.25 + 0.75) calc(c * 0.7) h) 22%,
            var(--_c) 55%,
            oklch(from var(--_c) calc(l * 0.78) c h) 88%,
            oklch(from var(--_c) calc(l * 0.6) c h) 100%
          );
        box-shadow:
          0 0 calc(var(--_size) * 0.25 * var(--_glow)) oklch(from var(--_c) l c h / 0.9),
          0 0 calc(var(--_size) * 0.9 * var(--_glow)) oklch(from var(--_c) l c h / 0.55),
          0 0 calc(var(--_size) * 2.2 * var(--_glow)) oklch(from var(--_c) l c h / calc(0.28 * min(1, var(--_glow)))),
          inset 0 0 calc(var(--_size) * 0.12) oklch(from var(--_c) calc(l * 0.5) c h / 0.8);
        transition: opacity 60ms linear;
      }
      /* the lens is a dome: it keeps reflecting the room light whether lit or not */
      .lens::after {
        content: '';
        position: absolute;
        z-index: 1;
        left: 22%;
        top: 12%;
        width: 44%;
        height: 30%;
        translate: calc(var(--_sx) * -12%) calc(var(--_sy) * -18%);
        border-radius: 50%;
        background: radial-gradient(closest-side, oklch(100% 0 0 / calc(0.25 + var(--_r) * 0.55)), transparent);
        pointer-events: none;
      }
      :host([shape='bar']) .lens::after {
        left: 8%;
        width: 84%;
        top: 10%;
        height: 32%;
        border-radius: 999px;
      }
      :host([on]) .light,
      :host([blink]) .light {
        opacity: var(--tr-led-brightness, 1);
      }
      :host(:not([on]):not([blink])) .light {
        transition-duration: 140ms;
      }
      :host([blink]) .light {
        animation: tr-led-blink var(--tr-led-blink-period, 1s) step-end infinite;
      }
      @keyframes tr-led-blink {
        50% {
          opacity: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([blink]) .light {
          animation: none;
        }
      }
      @media (forced-colors: active) {
        .lens {
          forced-color-adjust: none;
          background: Canvas;
          box-shadow: inset 0 0 0 1px CanvasText;
        }
        .lens::after {
          display: none;
        }
        .light {
          forced-color-adjust: none;
          background: Highlight;
          box-shadow: none;
        }
      }
    `,
  ];

  /** Whether the lamp is lit. */
  @property({ type: Boolean, reflect: true }) on = false;

  /** Flashes the lamp on and off (implies lit). Steady under prefers-reduced-motion. */
  @property({ type: Boolean, reflect: true }) blink = false;

  /** Lamp color: a named color or any CSS color. --tr-led-color overrides the default. */
  @property({ reflect: true }) color: 'red' | 'green' | 'amber' | 'yellow' | 'blue' | 'white' | (string & {}) = 'green';

  /** Lens size. */
  @property({ reflect: true }) size: Size = 'md';

  /** Lens outline: round, square, or a wide rectangular bar. */
  @property({ reflect: true }) shape: 'round' | 'square' | 'bar' = 'round';

  /** What the lamp indicates, e.g. "Power". Makes it an image named "{label}: on|off|blinking". */
  @property({ reflect: true }) label = '';

  private managedName = false;

  protected override render() {
    const named = ledColors[this.color];
    const c = named ?? (this.color || ledColors.green);
    return html`<span part="housing" class="housing surface"
      ><span part="lens" class="lens" style=${styleMap({ '--_c': `var(--tr-led-color, ${c})` })}
        ><span part="light" class="light"></span></span
    ></span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label') || changed.has('on') || changed.has('blink')) this.syncAria();
  }

  /** The state word used in the accessible name. */
  get stateText(): 'on' | 'off' | 'blinking' {
    return this.blink ? 'blinking' : this.on ? 'on' : 'off';
  }

  private syncAria(): void {
    if (this.label) {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', `${this.label}: ${this.stateText}`);
      this.removeAttribute('aria-hidden');
      this.managedName = true;
      return;
    }
    if (this.managedName) {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.managedName = false;
    }
    if (this.hasAttribute('aria-label') || this.hasAttribute('aria-labelledby')) {
      if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
      this.removeAttribute('aria-hidden');
    } else {
      this.setAttribute('aria-hidden', 'true');
    }
  }
}

define('tr-led', TrLed);

declare global {
  interface HTMLElementTagNameMap {
    'tr-led': TrLed;
  }
}
