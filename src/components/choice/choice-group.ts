import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import { SizeTransition } from '../../interaction/smooth.js';
import { TrChoiceCard } from './choice-card.js';

/**
 * A set of selectable `tr-choice-card`s laid out as a responsive grid: plan pickers, shipping
 * options, account types, templates. By default exactly one card can be chosen (radio group
 * semantics: one Tab stop, arrow keys move and choose, wrapping). With `multiple`, any number can
 * be chosen (checkbox semantics: each card is a Tab stop, Space or Enter toggles it).
 *
 * The group is form-associated: it submits `name=value` (one entry per chosen card when
 * `multiple`), supports `required`, and shows a `hint` and an `error` under the cards, like
 * `tr-input`. Cards fill columns at least `--tr-choice-min` wide (15em) and wrap, so the grid
 * never scrolls sideways on a phone; `columns` caps how many sit in a row.
 *
 * @summary Selectable card group (role="radiogroup", or "group" when multiple), form-associated.
 * @tag tr-choice-group
 * @role radiogroup
 *
 * @slot - The `tr-choice-card` elements.
 *
 * @csspart label - The visible group label.
 * @csspart grid - The grid laying the cards out.
 * @csspart hint - The help text under the cards.
 * @csspart error - The error message under the cards.
 *
 * @cssprop --tr-choice-min - Narrowest a card column may get before the grid wraps. Defaults to 15em.
 * @cssprop --tr-choice-gap - Space between cards. Defaults to 0.75em.
 *
 * @fires input - The user chose (or, when multiple, toggled) a card.
 * @fires change - The user chose (or, when multiple, toggled) a card.
 *
 * @example <tr-choice-group label="Plan" name="plan" value="pro" columns="3"><tr-choice-card value="free">Free<span slot="description">1 project</span><span slot="end">$0</span></tr-choice-card><tr-choice-card value="pro">Pro<span slot="description">Unlimited projects</span><span slot="end">$12/mo</span></tr-choice-card><tr-choice-card value="team">Team<span slot="description">Shared billing</span><span slot="end">$30/mo</span></tr-choice-card></tr-choice-group>
 * @example <tr-choice-group label="Delivery" name="ship" required hint="Prices include tax."><tr-choice-card value="std">Standard<span slot="description">3 to 5 days</span><span slot="end">Free</span></tr-choice-card><tr-choice-card value="exp">Express<span slot="description">Tomorrow</span><span slot="end">$9</span></tr-choice-card></tr-choice-group>
 * @example <tr-choice-group label="Training days" name="days" multiple value="mon,thu"><tr-choice-card value="mon">Monday</tr-choice-card><tr-choice-card value="tue">Tuesday</tr-choice-card><tr-choice-card value="thu">Thursday</tr-choice-card></tr-choice-group>
 */
export class TrChoiceGroup extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_min: var(--tr-choice-min, 15em);
        --_gap: var(--tr-choice-gap, 0.75em);
        --_cols: 0;
        display: block;
        min-width: 0;
        font-size: var(--tr-font-size-md, 1em);
      }
      .label {
        display: block;
        margin-bottom: 0.6em;
        font-size: 0.8125em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
      }
      .label[hidden] {
        display: none;
      }
      .grid {
        display: grid;
        gap: var(--_gap);
        /* columns at least --_min wide (never wider than the group), filling the row */
        grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--_min)), 1fr));
      }
      /* columns="n": at most n per row, still wrapping on narrow screens */
      :host([columns]) .grid {
        grid-template-columns: repeat(
          auto-fill,
          minmax(min(100%, max(var(--_min), calc((100% - (var(--_cols) - 1) * var(--_gap)) / var(--_cols)))), 1fr)
        );
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.85;
      }
      /* hint and error under the cards, as on tr-input: they fade, and the box glides to its height */
      .messages {
        margin-top: 0.15em;
      }
      .stack {
        display: grid;
      }
      .msg {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        margin-top: calc(0.45em / 0.8125);
        font-size: 0.8125em;
        line-height: 1.35;
        user-select: text;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.2, 0.7, 0.2, 1),
          display var(--tr-motion-duration-release, 160ms) allow-discrete;
      }
      .msg[hidden] {
        display: none;
        opacity: 0;
        translate: 0 -0.3em;
        transition-timing-function: ease-in;
      }
      @starting-style {
        .msg {
          opacity: 0;
          translate: 0 -0.3em;
        }
      }
      .hint {
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .error {
        --_err-ink: var(--tr-color-danger-ink, #fff);
        color: color-mix(in oklch, var(--tr-color-danger) 78%, currentColor);
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error svg {
        flex: none;
        margin-top: 0.12em;
      }
      :host([data-user-invalid]) ::slotted(tr-choice-card:not([selected])) {
        --tr-color-edge: var(--tr-color-danger);
      }
    `,
  ];

  /** Visible group label. Also the accessible name (as aria-label) unless you set your own. */
  @property({ reflect: true }) label = '';

  /**
   * Value of the chosen card, or '' when none is chosen. With `multiple`, the chosen values
   * joined by commas ("mon,thu"); set it the same way, or use `values`.
   */
  @property()
  get value(): string {
    return this._values.join(',');
  }
  set value(v: string) {
    const old = this.value;
    this._values = this.split(v ?? '');
    this.valueSet = true;
    this.requestUpdate('value', old);
  }

  /** The chosen values as an array (one item at most unless `multiple`). */
  get values(): string[] {
    return [...this._values];
  }
  set values(v: string[]) {
    const old = this.value;
    this._values = [...new Set((v ?? []).map(String).filter(Boolean))];
    if (!this.multiple) this._values = this._values.slice(0, 1);
    this.valueSet = true;
    this.requestUpdate('value', old);
  }

  private _values: string[] = [];
  /** Whether `value` was ever assigned, so a [selected] card never overrides it. */
  private valueSet = false;

  /** Lets any number of cards be chosen (checkbox semantics). */
  @property({ type: Boolean, reflect: true }) multiple = false;

  /** Requires a choice for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** At most this many cards per row (they still wrap on narrow screens). Unset: as many as fit. */
  @property({ type: Number, reflect: true }) columns?: number;

  /** Help text under the cards. Read out as the group's description. */
  @property({ reflect: true }) hint = '';

  /**
   * Error message under the cards. Setting it marks the group invalid (a custom validity error)
   * until it is cleared.
   */
  @property({ reflect: true }) error = '';

  /** The hint/error area glides to its new height instead of pushing content in one frame. */
  protected readonly messageSize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.messages'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.stack'),
  }));
  /** Kept after the error clears, so the message fades out with its words still in it. */
  private shownError = '';
  private ownsLabel = false;
  private defaultValue: string | null = null;
  private observer = new MutationObserver((records) => this.onMutation(records));

  constructor() {
    super();
    this.role_ = 'radiogroup';
    this.hostFocusable = false;
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['selected', 'disabled', 'value'] });
    if (!this.valueSet) {
      // Read attributes: the cards may not be upgraded yet (innerHTML).
      const chosen = this.cardElements().filter((c) => c.hasAttribute('selected'));
      if (chosen.length) {
        this._values = this.multiple ? chosen.map((c) => this.cardValue(c)) : [this.cardValue(chosen[0]!)];
      }
    }
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  /** The cards in this group, in document order. */
  get cards(): TrChoiceCard[] {
    return this.cardElements().filter((c): c is TrChoiceCard => c instanceof TrChoiceCard);
  }

  /** The validity state, as on a native control. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Checks validity and shows the browser's message when invalid. */
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Moves focus to the chosen card, or the first enabled one. */
  override focus(options?: FocusOptions): void {
    (this.enabled().find((c) => c.selected) ?? this.enabled()[0])?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('multiple')) {
      this.role_ = this.multiple ? 'group' : 'radiogroup';
      this.setAttribute('role', this.role_);
      if (!this.multiple && this._values.length > 1) this._values = this._values.slice(0, 1);
      // value="mon,thu" may have been read before the multiple attribute: split it now.
      if (this.multiple) this._values = [...new Set(this._values.flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean))];
    }
    if (changed.has('columns')) this.style.setProperty('--_cols', String(Math.max(1, Math.round(this.columns ?? 0)) || 1));
  }

  protected override render() {
    return html`<span part="label" class="label" aria-hidden="true" ?hidden=${!this.label}>${this.label}</span>
      <div part="grid" class="grid"><slot @slotchange=${this.sync}></slot></div>
      <div class="messages">
        <div class="stack">
          <div part="hint" class="msg hint" ?hidden=${!this.hint}>${this.hint}</div>
          <div part="error" class="msg error" ?hidden=${!this.error}>
            <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
            <span class="error-text">${this.error || this.shownError}</span>
          </div>
        </div>
      </div>`;
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
    // aria-required belongs to radiogroup, not to group.
    this.aria('aria-required', this.required && !this.multiple ? 'true' : null);
    this.aria('aria-description', [this.error, this.hint].filter(Boolean).join('. ') || null);
    this.aria('aria-invalid', this.error ? 'true' : null);
    if (changed.has('error')) {
      if (this.error) {
        this.shownError = this.error;
        this.setAttribute('data-user-invalid', '');
      } else if (changed.get('error')) this.removeAttribute('data-user-invalid');
    }
    this.sync();
  }

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
    this.removeAttribute('data-user-invalid');
  }

  formStateRestoreCallback(state: string | FormData): void {
    this.value = typeof state === 'string' ? state : [...state.values()].map(String).join(',');
  }

  private split(v: string): string[] {
    const parts = this.multiple ? v.split(',') : [v];
    return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
  }

  private cardElements(): Element[] {
    return [...this.querySelectorAll('tr-choice-card')].filter((c) => c.closest('tr-choice-group') === this);
  }

  private cardValue(c: Element): string {
    if (c instanceof TrChoiceCard) return c.choiceValue;
    return c.getAttribute('value') || (c.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private enabled(): TrChoiceCard[] {
    return this.isDisabled ? [] : this.cards.filter((c) => !c.disabled);
  }

  /** Mirrors the value onto the cards, sets roles, the tab stops, form value and validity. */
  private sync = (): void => {
    const cards = this.cards;
    const role = this.multiple ? 'checkbox' : 'radio';
    for (const c of cards) {
      const on = this._values.includes(c.choiceValue);
      if (c.selected !== on) c.selected = on;
      if (c.getAttribute('role') !== role) c.setAttribute('role', role);
      c.toggleAttribute('data-multiple', this.multiple);
      if (c.groupDisabled !== this.isDisabled) c.groupDisabled = this.isDisabled;
    }
    const enabled = this.enabled();
    const stop = enabled.find((c) => c.selected) ?? enabled[0];
    for (const c of cards) {
      const t = this.isDisabled || c.disabled ? -1 : this.multiple || c === stop ? 0 : -1;
      // compare the attribute: a custom element without one already reports tabIndex -1
      if (c.getAttribute('tabindex') !== String(t)) c.setAttribute('tabindex', String(t));
    }
    const chosen = cards.filter((c) => c.selected).map((c) => c.choiceValue);
    if (!chosen.length) this.internals.setFormValue(null, this.value);
    else if (this.multiple && this.name) {
      const fd = new FormData();
      for (const v of chosen) fd.append(this.name, v);
      this.internals.setFormValue(fd, this.value);
    } else this.internals.setFormValue(chosen.join(','), this.value);
    const anchor = stop ?? cards[0];
    if (this.error) this.internals.setValidity({ customError: true }, this.error, anchor);
    else if (this.required && !chosen.length) this.internals.setValidity({ valueMissing: true }, this.multiple ? 'Choose at least one option.' : 'Choose an option to continue.', anchor);
    else this.internals.setValidity({});
  };

  private onMutation(records: MutationRecord[]): void {
    for (const rec of records) {
      const t = rec.target;
      // Someone set `selected` on a card directly: adopt it.
      if (rec.type === 'attributes' && rec.attributeName === 'selected' && t instanceof TrChoiceCard && t.closest('tr-choice-group') === this) {
        const v = t.choiceValue;
        const has = this._values.includes(v);
        if (t.selected && !has) this._values = this.multiple ? [...this._values, v] : [v];
        else if (!t.selected && has) this._values = this._values.filter((x) => x !== v);
      }
    }
    this.sync();
  }

  private toggle(card: TrChoiceCard, focus: boolean): void {
    if (focus) card.focus();
    const v = card.choiceValue;
    if (this.multiple) {
      // Kept in card order, so `values` and the submitted entries read like the page.
      const on = (c: TrChoiceCard) => (c === card ? !this._values.includes(v) : this._values.includes(c.choiceValue));
      this._values = this.cards.filter(on).map((c) => c.choiceValue);
    } else {
      if (this._values[0] === v) return;
      this._values = [v];
    }
    this.valueSet = true;
    if (this.hasAttribute('data-user-invalid') && !this.error) this.removeAttribute('data-user-invalid');
    this.sync();
    this.requestUpdate('value');
    this.emit('input');
    this.emit('change');
  }

  private onClick = (e: MouseEvent): void => {
    const path = e.composedPath();
    const card = path.find((n): n is TrChoiceCard => n instanceof TrChoiceCard);
    if (!card || card.closest('tr-choice-group') !== this) return;
    // Links and controls inside a card do their own thing.
    const inner = path.slice(0, path.indexOf(card));
    if (inner.some((n) => n instanceof HTMLAnchorElement || n instanceof HTMLButtonElement || (n instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)))) return;
    if (this.isDisabled || card.disabled) {
      e.preventDefault();
      return;
    }
    this.toggle(card, true);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const current = e.target;
    if (!(current instanceof TrChoiceCard) || this.isDisabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const enabled = this.enabled();
    const i = enabled.indexOf(current);
    if (i < 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (this.multiple || !current.selected) this.toggle(current, false);
      return;
    }
    const rtl = getComputedStyle(this).direction === 'rtl';
    const n = enabled.length;
    let next: TrChoiceCard | undefined;
    switch (e.key) {
      case 'ArrowDown':
        next = enabled[(i + 1) % n];
        break;
      case 'ArrowUp':
        next = enabled[(i - 1 + n) % n];
        break;
      case 'ArrowRight':
        next = enabled[(i + (rtl ? -1 : 1) + n) % n];
        break;
      case 'ArrowLeft':
        next = enabled[(i + (rtl ? 1 : -1) + n) % n];
        break;
      case 'Home':
        next = enabled[0];
        break;
      case 'End':
        next = enabled[n - 1];
        break;
      default:
        return;
    }
    e.preventDefault();
    if (!next) return;
    // Radio semantics: arrows move and choose. Checkbox semantics: arrows only move focus.
    if (this.multiple) next.focus();
    else this.toggle(next, true);
  };
}

define('tr-choice-group', TrChoiceGroup);

declare global {
  interface HTMLElementTagNameMap {
    'tr-choice-group': TrChoiceGroup;
  }
}
