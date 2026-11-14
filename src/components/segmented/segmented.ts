import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { TrOption } from '../select/option.js';

/**
 * A row of mechanical keys set into a recessed tray, of which exactly one stays latched down.
 * The latched key sinks below the tray rim, shifts away from the light and lights its lamp
 * (which fills, where the others show a hollow ring), so the choice reads from position and
 * shape, not only color. Follows the WAI-ARIA APG radio group pattern (role="radiogroup", keys
 * are role="radio") with a roving tabindex. Form-associated: submits `name=value`.
 *
 * Children are `tr-option` elements (the same element `tr-select` uses): give each a `value`
 * and a label, optionally an icon in its `start` slot, and `disabled` to make it unavailable.
 * For an icon-only key, give the option an `aria-label`.
 *
 * Keyboard: Tab enters on the latched key; arrow keys move to and latch the previous/next key
 * (wrapping, skipping disabled ones); Home/End latch the first/last; Space latches the focused key.
 *
 * @summary Segmented control (role="radiogroup") of tr-option keys, form-associated.
 * @tag tr-segmented
 * @role radiogroup
 *
 * @slot - The `tr-option` keys.
 *
 * @csspart tray - The recessed tray holding the keys.
 *
 * @cssprop --tr-segmented-radius - Corner radius of the tray. Defaults to --tr-radius-md.
 * @cssprop --tr-segmented-height - Height of a key. Defaults by size (2em, 2.25em, 2.6em).
 * @cssprop --tr-segmented-gap - Space between keys. Defaults to 0.25em.
 * @cssprop --tr-option-lamp-color - Lamp color of the latched key. Defaults to --tr-color-accent.
 *
 * @fires input - The user latched a different key.
 * @fires change - The user latched a different key.
 *
 * @example <tr-segmented aria-label="View" value="grid"><tr-option value="list">List</tr-option><tr-option value="grid">Grid</tr-option><tr-option value="board">Board</tr-option></tr-segmented>
 * @example <tr-segmented name="range" material="metal" size="sm" aria-label="Range"><tr-option>Day</tr-option><tr-option>Week</tr-option><tr-option>Month</tr-option></tr-segmented>
 */
export class TrSegmented extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_seg-h: var(--tr-segmented-height, 2.25em);
        --_seg-pad: 0.95em;
        --_trad: var(--tr-segmented-radius, var(--tr-radius-md, 10px));
        --_seg-radius: calc(var(--_trad) - 3px);
        display: inline-flex;
        vertical-align: middle;
        max-width: 100%;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_seg-h: var(--tr-segmented-height, 2em);
        --_seg-pad: 0.75em;
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_seg-h: var(--tr-segmented-height, 2.6em);
        --_seg-pad: 1.15em;
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .tray {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        /* Equal columns as wide as the widest key; they shrink (labels ellipsize) only when the
           tray itself is squeezed. */
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        flex: 1;
        gap: var(--tr-segmented-gap, 0.25em);
        padding: 0.25em;
        border-radius: var(--_trad);
        min-width: 0;
      }
      :host([full-width]) {
        display: flex;
      }
      /* full-width keys are sized by the tray, not their labels, so each can be a size container */
      :host([full-width]) ::slotted(tr-option) {
        container: tr-segment / inline-size;
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) ::slotted(tr-option),
      :host(:state(disabled)) ::slotted(tr-option) {
        cursor: not-allowed;
        pointer-events: none;
      }
      @media (forced-colors: active) {
        .tray {
          border-color: ButtonText;
        }
      }
    `,
  ];

  /** Value of the latched key, or '' for none. */
  @property()
  get value(): string {
    return this._value;
  }
  set value(v: string) {
    this._value = v;
    this.valueSet = true;
  }
  private _value = '';
  /** Whether `value` was ever assigned (attribute or property), so a [selected]/[checked] child never overrides it. */
  private valueSet = false;

  /** Requires a choice for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Size of the keys. */
  @property({ reflect: true }) size: Size = 'md';

  /** Stretches the control to the width of its container, sharing it equally between keys. */
  @property({ type: Boolean, reflect: true, attribute: 'full-width' }) fullWidth = false;

  /** Accessible name of the group (not shown). Sets aria-label unless you set your own. */
  @property({ reflect: true }) label = '';

  private ownsLabel = false;

  private defaultValue: string | null = null;
  private observer = new MutationObserver(() => this.sync());

  constructor() {
    super();
    this.role_ = 'radiogroup';
    this.hostFocusable = false;
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observer.observe(this, { childList: true, attributes: true, subtree: true, attributeFilter: ['disabled', 'value'] });
    if (!this.valueSet) {
      // Read attributes, not TrOption properties: the children may not be upgraded yet (innerHTML).
      const sel = [...this.children].find((c) => c.localName === 'tr-option' && c.hasAttribute('selected'));
      if (sel) this.value = sel.getAttribute('value') ?? (sel.getAttribute('label') || sel.textContent || '').replace(/\s+/g, ' ').trim();
    }
    // Captured once: reconnecting (moving the control) must not turn the current value into the default.
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  /** The keys, in order. */
  get options(): TrOption[] {
    return [...this.children].filter((c): c is TrOption => c instanceof TrOption);
  }

  /** The validity state. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Moves focus to the latched key, or the first enabled one. */
  override focus(options?: FocusOptions): void {
    this.tabStop()?.focus(options);
  }

  protected override render() {
    return html`<div part="tray" class="tray surface"><slot @slotchange=${this.sync}></slot></div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label')) {
      if (this.label && (this.ownsLabel || !this.hasAttribute('aria-label'))) {
        this.aria('aria-label', this.label);
        this.ownsLabel = true;
      } else if (!this.label && this.ownsLabel) {
        this.aria('aria-label', null);
        this.ownsLabel = false;
      }
    }
    this.aria('aria-required', this.required ? 'true' : null);
    this.aria('aria-orientation', 'horizontal');
    this.sync();
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }

  private enabled(): TrOption[] {
    return this.isDisabled ? [] : this.options.filter((o) => !o.disabled);
  }

  private tabStop(): TrOption | undefined {
    const e = this.enabled();
    return e.find((o) => o.selected) ?? e[0];
  }

  private sync = (): void => {
    const opts = this.options;
    for (const o of opts) {
      if (o.getAttribute('data-mode') !== 'segment') {
        o.setAttribute('data-mode', 'segment');
        o.setAttribute('role', 'radio');
        o.requestUpdate();
      }
      o.selected = this.value !== '' && o.value === this.value;
    }
    const stop = this.tabStop();
    for (const o of opts) o.tabIndex = o === stop ? 0 : -1;
    const sel = opts.find((o) => o.selected);
    this.internals.setFormValue(sel ? this.value : null, this.value);
    if (this.required && !sel) this.internals.setValidity({ valueMissing: true }, 'Choose an option to continue.', opts[0]);
    else this.internals.setValidity({});
  };

  private select(o: TrOption, focus: boolean): void {
    if (focus) o.focus();
    if (o.value === this.value) return;
    this.value = o.value;
    this.sync();
    this.emit('input');
    this.emit('change');
  }

  private onClick = (e: MouseEvent): void => {
    const o = e.composedPath().find((n): n is TrOption => n instanceof TrOption);
    if (!o || o.parentElement !== this || o.disabled || this.isDisabled) return;
    this.select(o, true);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const cur = e.target;
    if (!(cur instanceof TrOption) || this.isDisabled) return;
    const list = this.enabled();
    const i = list.indexOf(cur);
    if (i < 0) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const n = list.length;
    let next: TrOption | undefined;
    switch (e.key) {
      case 'ArrowRight':
        next = list[(i + (rtl ? -1 : 1) + n) % n];
        break;
      case 'ArrowLeft':
        next = list[(i + (rtl ? 1 : -1) + n) % n];
        break;
      case 'ArrowDown':
        next = list[(i + 1) % n];
        break;
      case 'ArrowUp':
        next = list[(i - 1 + n) % n];
        break;
      case 'Home':
        next = list[0];
        break;
      case 'End':
        next = list[n - 1];
        break;
      case ' ':
        e.preventDefault();
        this.select(cur, false);
        return;
      default:
        return;
    }
    e.preventDefault();
    if (next) this.select(next, true);
  };
}

define('tr-segmented', TrSegmented);

declare global {
  interface HTMLElementTagNameMap {
    'tr-segmented': TrSegmented;
  }
}
