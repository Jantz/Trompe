import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Orientation, Size } from '../../internal/types.js';
import { TrRadio } from './radio.js';

/**
 * A set of `tr-radio` sockets of which exactly one can be selected. Follows the WAI-ARIA APG
 * radio group pattern: Tab moves into and out of the group, landing on the selected radio
 * (or the first one); arrow keys move the selection and wrap; Space selects the focused radio.
 * The group is form-associated: it submits `name=value` and supports `required`.
 *
 * @summary Radio group (role="radiogroup") holding tr-radio children, form-associated.
 * @tag tr-radio-group
 * @role radiogroup
 *
 * @slot - The `tr-radio` elements (other content, such as dividers, is allowed).
 *
 * @csspart label - The visible group label.
 * @csspart group - Wrapper laying the radios out.
 *
 * @cssprop --tr-radio-group-gap - Space between radios. Defaults to 0.6em (vertical) or 1.25em (horizontal).
 *
 * @fires input - The user selected a radio.
 * @fires change - The user selected a radio.
 *
 * @example <tr-radio-group label="Shipping" name="ship" value="std"><tr-radio value="std">Standard</tr-radio><tr-radio value="exp">Express</tr-radio></tr-radio-group>
 * @example <tr-radio-group aria-label="Size" orientation="horizontal" required><tr-radio value="s">S</tr-radio><tr-radio value="m">M</tr-radio><tr-radio value="l">L</tr-radio></tr-radio-group>
 */
export class TrRadioGroup extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        display: inline-flex;
        flex-direction: column;
        gap: 0.5em;
        vertical-align: top;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .label {
        font-size: 0.8125em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
      }
      .label[hidden] {
        display: none;
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--tr-radio-group-gap, 0.6em);
      }
      :host([orientation='horizontal']) .group {
        flex-direction: row;
        flex-wrap: wrap;
        gap: var(--tr-radio-group-gap, 0.5em 1.25em);
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) ::slotted(tr-radio),
      :host(:state(disabled)) ::slotted(tr-radio) {
        cursor: not-allowed;
        opacity: 1;
      }
    `,
  ];

  /** Visible group label. Also the accessible name (as aria-label) unless you set your own. */
  @property({ reflect: true }) label = '';

  /** Value of the selected radio, or '' when none is selected. */
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

  /** Requires a selection for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Layout of the radios. Arrow keys work in both directions either way. */
  @property({ reflect: true }) orientation: Orientation = 'vertical';

  /** Size of the radios and labels. */
  @property({ reflect: true }) size: Size = 'md';

  private defaultValue: string | null = null;
  private observer = new MutationObserver((records) => this.onMutation(records));
  private ownsLabel = false;

  constructor() {
    super();
    this.role_ = 'radiogroup';
    this.hostFocusable = false;
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['checked', 'disabled'] });
    if (!this.valueSet) {
      const checked = this.radios.find((r) => r.hasAttribute('checked'));
      if (checked) this.value = checked.getAttribute('value') ?? '';
    }
    // Captured once: reconnecting (moving the control) must not turn the current value into the default.
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  /** The radios in this group, in document order. */
  get radios(): TrRadio[] {
    return [...this.querySelectorAll('tr-radio')].filter((r) => r.closest('tr-radio-group') === this) as TrRadio[];
  }

  /** The validity state, as on a native control. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Moves focus to the selected radio, or the first enabled one. */
  override focus(options?: FocusOptions): void {
    this.tabStop()?.focus(options);
  }

  protected override render() {
    return html`<span part="label" class="label" aria-hidden="true" ?hidden=${!this.label}>${this.label}</span>
      <div part="group" class="group"><slot @slotchange=${this.sync}></slot></div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label')) {
      // aria-labelledby cannot reach into shadow DOM, so name the host directly.
      if (this.label && (this.ownsLabel || !this.hasAttribute('aria-label'))) {
        this.aria('aria-label', this.label);
        this.ownsLabel = true;
      } else if (!this.label && this.ownsLabel) {
        this.aria('aria-label', null);
        this.ownsLabel = false;
      }
    }
    this.aria('aria-required', this.required ? 'true' : null);
    this.aria('aria-orientation', this.orientation);
    this.sync();
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }

  private enabled(): TrRadio[] {
    return this.isDisabled ? [] : this.radios.filter((r) => !r.disabled);
  }

  private tabStop(): TrRadio | undefined {
    const enabled = this.enabled();
    return enabled.find((r) => r.checked) ?? enabled[0];
  }

  /** Mirrors `value` onto the radios, sets the roving tabindex, form value and validity. */
  private sync = (): void => {
    const radios = this.radios;
    for (const r of radios) {
      const on = this.value !== '' && r.value === this.value;
      if (r.checked !== on) r.checked = on;
      if (this.size && r.size !== this.size) r.size = this.size;
    }
    const stop = this.tabStop();
    for (const r of radios) r.tabIndex = r === stop ? 0 : -1;
    const selected = radios.find((r) => r.checked);
    this.internals.setFormValue(selected ? this.value : null, this.value);
    if (this.required && !selected) {
      this.internals.setValidity({ valueMissing: true }, 'Select an option to continue.', radios[0]);
    } else {
      this.internals.setValidity({});
    }
  };

  private onMutation(records: MutationRecord[]): void {
    // Someone set `checked` on a radio directly: adopt it as the group value.
    for (const rec of records) {
      const t = rec.target;
      if (rec.type === 'attributes' && rec.attributeName === 'checked' && t instanceof TrRadio && t.hasAttribute('checked') && t.value !== this.value) {
        this.value = t.value;
      }
    }
    this.sync();
  }

  private select(radio: TrRadio, focus: boolean): void {
    if (focus) radio.focus();
    if (radio.value === this.value) return;
    this.value = radio.value;
    this.sync();
    this.emit('input');
    this.emit('change');
  }

  private onClick = (event: MouseEvent): void => {
    const radio = event.composedPath().find((n): n is TrRadio => n instanceof TrRadio);
    if (!radio || radio.closest('tr-radio-group') !== this) return;
    if (this.isDisabled || radio.disabled) {
      event.preventDefault();
      return;
    }
    if (event.composedPath().some((n) => n instanceof HTMLAnchorElement)) return;
    this.select(radio, true);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const current = event.target;
    if (!(current instanceof TrRadio) || this.isDisabled) return;
    const enabled = this.enabled();
    const i = enabled.indexOf(current);
    if (i < 0) return;
    let next: TrRadio | undefined;
    const rtl = getComputedStyle(this).direction === 'rtl';
    switch (event.key) {
      case 'ArrowDown':
        next = enabled[(i + 1) % enabled.length];
        break;
      case 'ArrowUp':
        next = enabled[(i - 1 + enabled.length) % enabled.length];
        break;
      case 'ArrowRight':
        next = enabled[(i + (rtl ? -1 : 1) + enabled.length) % enabled.length];
        break;
      case 'ArrowLeft':
        next = enabled[(i + (rtl ? 1 : -1) + enabled.length) % enabled.length];
        break;
      case ' ':
        event.preventDefault();
        this.select(current, false);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next) this.select(next, true);
  };
}

define('tr-radio-group', TrRadioGroup);

declare global {
  interface HTMLElementTagNameMap {
    'tr-radio-group': TrRadioGroup;
  }
}
