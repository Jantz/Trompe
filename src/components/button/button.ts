import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { submitFor } from '../../internal/submitter.js';
import { define } from '../../internal/trompe-element.js';
import type { Size, Tone } from '../../internal/types.js';
import { PressController } from '../../interaction/press.js';

/**
 * A physical push button. It rests raised, rises slightly under the pointer, and sinks into its
 * housing when pressed, moving away from the light. With `toggle` it latches down and lights its
 * lamp while `pressed`.
 *
 * @summary Push button or latching toggle button.
 * @tag tr-button
 * @role button
 *
 * @slot - Button label.
 * @slot start - Icon or content before the label.
 * @slot end - Icon or content after the label.
 *
 * @csspart control - The physical button surface.
 * @csspart label - Wrapper around the default slot.
 * @csspart lamp - Indicator lamp shown when `toggle` is set.
 *
 * @cssprop --tr-button-padding-inline - Horizontal padding. Defaults by size.
 * @cssprop --tr-button-radius - Corner radius. Defaults to --tr-radius-md.
 * @cssprop --tr-button-lamp-color - Colour of a lit `toggle` lamp. Defaults to --tr-color-accent.
 *
 * @fires click - Native click, also fired for Enter and Space.
 * @fires change - Fired when a `toggle` button flips `pressed`.
 *
 * @example <tr-button tone="accent">Save</tr-button>
 * @example <tr-button tone="accent" type="submit" loading>Place order</tr-button>
 * @example <tr-button toggle pressed material="metal">Mute</tr-button>
 * @example <tr-button shape="circle" profile="dome" finish="gloss" aria-label="Play"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4 2l10 6-10 6z"/></svg></tr-button>
 */
export class TrButton extends FormControl {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.isDisabled });

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_depth: 1;
        --_curve-default: 0.35;
        --_h: var(--tr-control-md, 2.5em);
        --_pad: var(--tr-button-padding-inline, 1em);
        font-size: var(--tr-font-size-md, 1em);
        display: inline-block;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
      }
      :host([size='sm']) {
        --_h: var(--tr-control-sm, 2.25em);
        --_pad: var(--tr-button-padding-inline, 0.8em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_h: var(--tr-control-lg, 2.75em);
        --_pad: var(--tr-button-padding-inline, 1.25em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      :host([shape='pill']) {
        --_radius: var(--tr-radius-pill, 999px);
      }
      :host([shape='circle']) {
        --_radius: 50%;
        --_curve-default: 0.8;
        --_pad: 0;
      }
      :host([shape='circle']) .surface {
        width: var(--_h);
        aspect-ratio: 1;
      }
      .surface {
        --_tr-z: var(--_depth);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--tr-space-2, 8px);
        width: 100%;
        min-height: var(--_h);
        padding: 0 var(--_pad);
        border-radius: var(--tr-button-radius, var(--_radius, var(--tr-radius-md, 10px)));
        font-weight: var(--tr-font-weight-strong, 600);
        line-height: 1.2;
        letter-spacing: 0.01em;
        white-space: nowrap;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          background-color var(--tr-motion-duration-release, 160ms),
          color var(--tr-motion-duration-release, 160ms),
          border-color var(--tr-motion-duration-release, 160ms),
          opacity var(--tr-motion-duration-release, 160ms);
      }
      :host([tone='accent']) .surface {
        --_base: var(--tr-color-accent);
        --_ink: var(--tr-color-accent-ink);
      }
      :host([tone='danger']) .surface {
        --_base: var(--tr-color-danger);
        --_ink: var(--tr-color-danger-ink);
      }
      :host(:hover) .surface {
        --_tr-z: calc(var(--_depth) + 0.5);
      }
      :host([data-tr-pressed]) .surface,
      :host([data-active]) .surface,
      :host([toggle][pressed]) .surface {
        --_tr-z: -1;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
        transition-timing-function: var(--tr-motion-easing-press, ease-in);
        /* flat realism still shows the press */
        background-color: color-mix(in oklch, var(--_face), var(--_sh) calc(6% - var(--_r) * 4%));
      }
      :host([disabled]),
      :host(:state(disabled)) {
        cursor: not-allowed;
      }
      :host([disabled]) .surface,
      :host(:state(disabled)) .surface {
        --_tr-z: 0;
        opacity: 0.55;
        translate: none;
      }
      .label {
        display: inline-flex;
        align-items: center;
        gap: inherit;
      }
      ::slotted(svg),
      ::slotted([slot='start']),
      ::slotted([slot='end']) {
        flex: none;
      }
      .lamp {
        flex: none;
        width: 0.5em;
        height: 0.5em;
        border-radius: 50%;
        background: color-mix(in oklch, var(--_ink) 25%, transparent);
        box-shadow: inset 0 1px 1px color-mix(in oklch, var(--_sh) 40%, transparent);
        transition:
          background-color var(--tr-motion-duration-release, 160ms),
          box-shadow var(--tr-motion-duration-release, 160ms),
          opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([pressed]) .lamp {
        background: var(--tr-button-lamp-color, var(--tr-color-accent));
        box-shadow:
          0 0 calc(2px + var(--_r) * 6px) var(--tr-button-lamp-color, var(--tr-color-accent)),
          inset 0 -1px 1px color-mix(in oklch, var(--_sh) 30%, transparent);
      }
      .lamp[hidden] {
        display: none;
      }
      /* loading: the label fades out in place (the button keeps its size) and a spinner turns */
      .surface {
        position: relative;
      }
      ::slotted(*),
      .label {
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([loading]) .label,
      :host([loading]) .lamp,
      :host([loading]) ::slotted(*) {
        opacity: 0;
      }
      .spinner {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 1.15em;
        height: 1.15em;
        border-radius: 50%;
        border: 0.16em solid color-mix(in oklch, currentColor 25%, transparent);
        border-top-color: currentColor;
        opacity: 0;
        scale: 0.6;
        pointer-events: none;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
        animation: tr-button-spin 0.8s linear infinite;
      }
      :host([loading]) .spinner {
        opacity: 1;
        scale: 1;
      }
      :host([loading]) {
        cursor: progress;
      }
      @keyframes tr-button-spin {
        to {
          rotate: 1turn;
        }
      }
      @media (pointer: coarse) {
        .surface {
          min-height: max(var(--_h), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        :host([toggle][pressed]) .surface {
          border-width: 3px;
        }
        :host([pressed]) .lamp {
          background: Highlight;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Visual intent. */
  @property({ reflect: true }) tone: Tone = 'neutral';

  /** Control size. */
  @property({ reflect: true }) size: Size = 'md';

  /** Outline of the button. Use circle for icon-only transport buttons (give them an aria-label). */
  @property({ reflect: true }) shape: 'rect' | 'pill' | 'circle' = 'rect';

  /** Form behaviour when clicked inside a form. */
  @property({ reflect: true }) type: 'button' | 'submit' | 'reset' = 'button';

  /** Value submitted with the form when this button submits it. */
  @property() value = '';

  /** Makes the button latch: each click flips `pressed`. */
  @property({ type: Boolean, reflect: true }) toggle = false;

  /** Whether a `toggle` button is latched down. Exposed as aria-pressed. */
  @property({ type: Boolean, reflect: true }) pressed = false;

  /**
   * Shows a spinner in place of the label (the button keeps its size, so nothing moves) and
   * ignores clicks until cleared. Exposed as aria-busy. Use it while a submit is in flight.
   */
  @property({ type: Boolean, reflect: true }) loading = false;

  constructor() {
    super();
    this.role_ = 'button';
    this.addEventListener('click', this.onClick, { capture: true });
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('keyup', this.onKeyUp);
    this.addEventListener('blur', () => this.removeAttribute('data-active'));
  }

  protected override render() {
    return html`<span part="control" class="surface focus-ring">
      <span part="lamp" class="lamp" ?hidden=${!this.toggle}></span>
      <slot name="start"></slot>
      <span part="label" class="label"><slot></slot></span>
      <slot name="end"></slot>
      <span class="spinner" aria-hidden="true"></span>
    </span>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('pressed') || changed.has('toggle')) {
      this.aria('aria-pressed', this.toggle ? String(this.pressed) : null);
    }
    if (changed.has('loading')) this.aria('aria-busy', this.loading ? 'true' : null);
  }

  private onClick = (event: MouseEvent): void => {
    if (this.isDisabled || this.loading) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.toggle) {
      this.pressed = !this.pressed;
      // Fire change after the click handlers so listeners see the new state either way.
      queueMicrotask(() => this.emit('change'));
    }
    const form = this.form;
    if (!form) return;
    if (this.type === 'submit') {
      if (this.name) this.internals.setFormValue(this.value);
      // Recorded so a method="dialog" form's tr-dialog can read this button's value.
      submitFor(form, this);
      this.internals.setFormValue(null);
    } else if (this.type === 'reset') {
      form.reset();
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this || this.isDisabled) return;
    if (event.key === ' ') {
      event.preventDefault();
      this.setAttribute('data-active', '');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.click();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.target !== this || event.key !== ' ' || !this.hasAttribute('data-active')) return;
    this.removeAttribute('data-active');
    this.click();
  };
}

define('tr-button', TrButton);

declare global {
  interface HTMLElementTagNameMap {
    'tr-button': TrButton;
  }
}
