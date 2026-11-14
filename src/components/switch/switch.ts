import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { PressController } from '../../interaction/press.js';
import { ToggleController } from '../../interaction/toggle.js';

/**
 * A physical slide switch: a raised thumb travelling in a recessed track. When on, the track
 * fills with the accent color and shows an "I" mark; when off it shows an "O" mark, so state
 * never depends on color or position alone.
 *
 * @summary On/off switch (role="switch"), form-associated.
 * @tag tr-switch
 * @role switch
 *
 * @slot - Visible label. Clicking it toggles the switch. Also the accessible name.
 *
 * @csspart track - The recessed track.
 * @csspart thumb - The sliding thumb.
 * @csspart label - Wrapper around the label slot.
 *
 * @cssprop --tr-switch-on-color - Track fill when on. Defaults to --tr-color-accent.
 * @cssprop --tr-switch-width - Track width. Defaults by size (2.75em, 3.25em, 3.75em).
 * @cssprop --tr-switch-height - Track height. Defaults by size (1.625em, 1.875em, 2.125em).
 * @cssprop --tr-switch-thumb-inset - Gap between the thumb and the track edge. Defaults by size (about 0.19em).
 * @cssprop --tr-switch-track-radius - Corner radius of the track. Defaults to a pill.
 * @cssprop --tr-switch-thumb-radius - Corner radius of the thumb. Defaults to 50% (round).
 *
 * @fires input - The user toggled the switch.
 * @fires change - The user toggled the switch.
 *
 * @example <tr-switch checked>Wi-Fi</tr-switch>
 * @example <tr-switch name="alerts" material="metal" size="lg">Alerts</tr-switch>
 */
export class TrSwitch extends FormControl {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.isDisabled });

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_depth: 1;
        --_w: var(--tr-switch-width, 3.25em);
        --_h: var(--tr-switch-height, 1.875em);
        --_gap: var(--tr-switch-thumb-inset, 0.1875em);
        --_on: var(--tr-switch-on-color, var(--tr-color-accent));
        display: inline-flex;
        align-items: center;
        gap: 0.75em;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
        font-size: var(--tr-font-size-md, 1em);
        min-height: var(--_h);
      }
      :host([size='sm']) {
        --_w: var(--tr-switch-width, 2.75em);
        --_h: var(--tr-switch-height, 1.625em);
        --_gap: var(--tr-switch-thumb-inset, 0.15em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_w: var(--tr-switch-width, 3.75em);
        --_h: var(--tr-switch-height, 2.125em);
        --_gap: var(--tr-switch-thumb-inset, 0.2em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .track {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_ink: var(--tr-color-ink-muted);
        --_edge: var(--_edge-strong);
        flex: none;
        position: relative;
        width: var(--_w);
        height: var(--_h);
        border-radius: var(--tr-switch-track-radius, var(--tr-radius-pill, 999px));
        transition: background-color var(--tr-motion-duration-travel, 220ms);
        /* the slot is lit from inside on: a soft glow pooling around the thumb's resting place */
        --_layer: radial-gradient(
          ellipse 70% 90% at 30% 50%,
          color-mix(in oklch, var(--_hl) calc(var(--_on-glow, 0) * var(--_r) * 28%), transparent),
          transparent 70%
        );
      }
      :host([checked]) .track {
        --_base: var(--_on);
        --_ink: var(--tr-color-accent-ink);
        --_on-glow: 1;
      }
      .mark {
        position: absolute;
        top: 50%;
        translate: 0 -50%;
        font: 600 calc(var(--_h) * 0.36) / 1 var(--tr-font-family-mono, monospace);
        color: var(--_ink);
        pointer-events: none;
      }
      .mark-on {
        left: calc(var(--_h) * 0.36);
        opacity: 0;
      }
      .mark-off {
        right: calc(var(--_h) * 0.3);
      }
      :host([checked]) .mark-on {
        opacity: 1;
      }
      :host([checked]) .mark-off {
        opacity: 0;
      }
      .thumb {
        --_tr-z: var(--_depth);
        position: absolute;
        --_curve: var(--tr-p-curve, 0.55);
        --_brush: 0;
        --_spin: var(--tr-f-spin, max(var(--tr-m-spin, 0), var(--tr-m-brush, 0) * 0.85));
        top: var(--_gap);
        left: var(--_gap);
        width: calc(var(--_h) - 2 * var(--_gap) - 2px);
        height: calc(var(--_h) - 2 * var(--_gap) - 2px);
        border-radius: var(--tr-switch-thumb-radius, 50%);
        /* Rest position comes from the state; while the hand is on the thumb, --tr-value-ratio
           (written by the toggle controller) takes over, then the thumb throws home on a spring. */
        translate: calc(var(--tr-value-ratio, var(--_rest)) * (var(--_w) - var(--_h))) 0;
        transition:
          translate var(--tr-motion-duration-throw, 220ms) var(--tr-motion-easing-throw, ease-out),
          --_tr-z var(--tr-motion-duration-release, 160ms);
      }
      :host {
        --_rest: 0;
      }
      :host([checked]) {
        --_rest: 1;
      }
      :host([data-dragging]) .thumb {
        transition:
          translate 50ms linear,
          --_tr-z var(--tr-motion-duration-release, 160ms);
      }
      :host([data-tr-pressed]) .thumb {
        --_tr-z: calc(var(--_depth) - 0.5);
      }
      .label {
        line-height: 1.3;
      }
      .label:not(.has-label) {
        display: none;
      }
      :host([disabled]),
      :host(:state(disabled)) {
        cursor: not-allowed;
        opacity: 0.55;
      }
      @media (pointer: coarse) {
        :host {
          min-height: var(--tr-control-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        :host([checked]) .track {
          background-color: Highlight;
          forced-color-adjust: none;
        }
        .thumb {
          background-color: ButtonText;
          forced-color-adjust: none;
        }
        :host([checked]) .mark {
          color: HighlightText;
        }
      }
    `,
  ];

  /** Whether the switch is on. */
  @property({ type: Boolean, reflect: true }) checked = false;

  /** Value submitted with the form when on. */
  @property() value = 'on';

  /** Requires the switch to be on for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Size of the switch. */
  @property({ reflect: true }) size: Size = 'md';

  /** The state a form reset restores. Captured on first connect only (`checked` reflects). */
  private defaultChecked: boolean | null = null;
  private hasLabel = false;

  /** Grab the thumb and throw it: resists in its own half, snaps over centre (see docs/interaction.md). */
  protected readonly throwCtl = new ToggleController(this, {
    checked: () => this.checked,
    toggle: () => this.toggle(),
    thumb: () => this.renderRoot?.querySelector('.thumb') ?? null,
    track: () => this.renderRoot?.querySelector('.track') ?? null,
    disabled: () => this.isDisabled,
  });

  constructor() {
    super();
    this.role_ = 'switch';
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultChecked === null) this.defaultChecked = this.hasAttribute('checked');
  }

  protected override render() {
    return html`<span part="track" class="track surface focus-ring">
        <span class="mark mark-on" aria-hidden="true">I</span>
        <span class="mark mark-off" aria-hidden="true">O</span>
        <span part="thumb" class="thumb surface"></span>
      </span>
      <span part="label" class="label ${this.hasLabel ? 'has-label' : ''}"
        ><slot @slotchange=${this.onSlotChange}></slot
      ></span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-checked', String(this.checked));
    this.aria('aria-required', this.required ? 'true' : null);
    this.internals.setFormValue(this.checked ? this.value : null, String(this.checked));
    if (this.required && !this.checked) {
      this.internals.setValidity({ valueMissing: true }, 'Turn this switch on to continue.');
    } else {
      this.internals.setValidity({});
    }
  }

  formResetCallback(): void {
    this.checked = this.defaultChecked ?? false;
  }

  formStateRestoreCallback(state: string): void {
    this.checked = state === 'true';
  }

  /** Flips the switch as if the user did, firing input and change. */
  toggle(force?: boolean): void {
    const next = force ?? !this.checked;
    if (next === this.checked) return;
    this.checked = next;
    this.emit('input');
    this.emit('change');
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.hasLabel = slot.assignedNodes({ flatten: true }).some((n) => n.textContent?.trim() || n.nodeType === 1);
    this.requestUpdate();
  }

  private onClick = (event: MouseEvent): void => {
    if (this.isDisabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // Let interactive content inside the label (links) do its own thing.
    const path = event.composedPath();
    if (path.some((n) => n instanceof HTMLAnchorElement)) return;
    this.toggle();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this || this.isDisabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggle();
    }
  };
}

define('tr-switch', TrSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'tr-switch': TrSwitch;
  }
}
