import { property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { TrompeElement } from './trompe-element.js';

/**
 * Base for interactive, form-associated Trompe controls.
 *
 * The host element itself carries the ARIA role (via ElementInternals) and receives focus, so
 * `aria-label`, `<label for>`, slotted text and `fieldset[disabled]` all work like native controls.
 */
export class FormControl extends TrompeElement {
  static formAssociated = true;

  protected readonly internals: ElementInternals;

  /** Name submitted with the form. */
  @property({ reflect: true }) name = '';

  /** Disables the control: not focusable, not editable, not submitted. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Disabled by an ancestor fieldset. */
  @state() protected formDisabled = false;

  /** ARIA role applied to the host. */
  protected role_: string | null = null;

  /** Whether the host should be in the tab order when enabled. Text inputs delegate focus instead. */
  protected hostFocusable = true;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }

  /** True when disabled directly or through a fieldset. */
  get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  /** The form this control belongs to, if any. */
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.role_ && !this.hasAttribute('role')) this.setAttribute('role', this.role_);
    this.syncFocusable();
  }

  formDisabledCallback(disabled: boolean): void {
    this.formDisabled = disabled;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('disabled') || changed.has('formDisabled')) this.syncFocusable();
  }

  private syncFocusable(): void {
    const off = this.isDisabled;
    this.aria('aria-disabled', off ? 'true' : null);
    try {
      if (off) this.internals.states.add('disabled');
      else this.internals.states.delete('disabled');
    } catch {
      /* CustomStateSet unsupported: the [disabled] attribute still styles it */
    }
    if (!this.hostFocusable) return;
    if (off) {
      if (this.getAttribute('tabindex') === '0') this.removeAttribute('tabindex');
    } else if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
  }

  /**
   * Sets (or removes, for null) an ARIA attribute on the host. Real attributes rather than
   * ElementInternals reflection, so every assistive technology and test tool sees them.
   */
  protected aria(name: `aria-${string}`, value: string | null): void {
    if (value === null) this.removeAttribute(name);
    else if (this.getAttribute(name) !== value) this.setAttribute(name, value);
  }

  /** Fires a bubbling, composed native event, so every framework can listen with its usual syntax. */
  protected emit(type: 'input' | 'change'): void {
    this.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
  }
}
