import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';
import { TrChip } from './chip.js';

/**
 * A row of `tr-chip`s that wraps onto as many lines as it needs: time slots, sizes, filters,
 * categories. By default exactly one chip can be chosen (radio group semantics: one Tab stop,
 * arrow keys move and choose, wrapping). With `multiple`, any number can be chosen (checkbox
 * semantics: each chip is a Tab stop, Space or Enter toggles it).
 *
 * The group is form-associated: it submits `name=value` (one entry per chosen chip when
 * `multiple`), supports `required`, and shows a `hint` and an `error` under the chips, like
 * `tr-input`. A group of only `removable` chips is a list of tags instead (role="list"); it
 * holds no value.
 *
 * @summary Wrapping chip group (role="radiogroup", or "group" when multiple), form-associated.
 * @tag tr-chip-group
 * @role radiogroup
 *
 * @slot - The `tr-chip` elements.
 *
 * @csspart label - The visible group label.
 * @csspart chips - The wrapping row of chips.
 * @csspart hint - The help text under the chips.
 * @csspart error - The error message under the chips.
 *
 * @cssprop --tr-chip-gap - Space between chips. Defaults to 0.5em.
 *
 * @fires input - The user chose (or, when multiple, toggled) a chip.
 * @fires change - The user chose (or, when multiple, toggled) a chip.
 *
 * @example <tr-chip-group label="Time" name="slot" value="09:30" required><tr-chip>09:00</tr-chip><tr-chip>09:30</tr-chip><tr-chip disabled>10:00</tr-chip><tr-chip>10:30</tr-chip><tr-chip>11:00</tr-chip></tr-chip-group>
 * @example <tr-chip-group label="Cuisine" name="cuisine" multiple value="thai,veg"><tr-chip value="thai" count="12">Thai</tr-chip><tr-chip value="it" count="8">Italian</tr-chip><tr-chip value="veg" count="5">Vegetarian</tr-chip></tr-chip-group>
 * @example <tr-chip-group label="Labels"><tr-chip removable>Bug</tr-chip><tr-chip removable>Design</tr-chip><tr-chip removable>Docs</tr-chip></tr-chip-group>
 */
export class TrChipGroup extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
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
      .chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--tr-chip-gap, 0.5em);
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.85;
      }
      /* hint and error under the chips, as on tr-input: they fade, and the box glides to its height */
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
      :host([data-user-invalid]) ::slotted(tr-chip:not([selected])) {
        --tr-color-edge: var(--tr-color-danger);
      }
    `,
  ];

  /** Visible group label. Also the accessible name (as aria-label) unless you set your own. */
  @property({ reflect: true }) label = '';

  /**
   * Value of the chosen chip, or '' when none is chosen. With `multiple`, the chosen values
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
  /** Whether `value` was ever assigned, so a [selected] chip never overrides it. */
  private valueSet = false;

  /** Lets any number of chips be chosen (checkbox semantics). */
  @property({ type: Boolean, reflect: true }) multiple = false;

  /** Requires a choice for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Help text under the chips. Read out as the group's description. */
  @property({ reflect: true }) hint = '';

  /**
   * Error message under the chips. Setting it marks the group invalid (a custom validity error)
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
    this.observer.observe(this, { subtree: true, childList: true, attributes: true, attributeFilter: ['selected', 'disabled', 'value', 'removable', 'hidden'] });
    if (!this.valueSet) {
      // Read attributes: the chips may not be upgraded yet (innerHTML).
      const chosen = this.chipElements().filter((c) => c.hasAttribute('selected'));
      if (chosen.length) {
        this._values = this.multiple ? chosen.map((c) => this.chipValue(c)) : [this.chipValue(chosen[0]!)];
      }
    }
    if (this.defaultValue === null) this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  /** The chips in this group, in document order. */
  get chips(): TrChip[] {
    return this.chipElements().filter((c): c is TrChip => c instanceof TrChip);
  }

  /** The chips that can be chosen: not removable, not hidden. */
  private get pickable(): TrChip[] {
    return this.chips.filter((c) => !c.removable && !c.hidden);
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

  /** Moves focus to the chosen chip, or the first enabled one (or the first × key in a tag list). */
  override focus(options?: FocusOptions): void {
    const target = this.enabled().find((c) => c.selected) ?? this.enabled()[0] ?? this.chips.find((c) => c.removable && !c.hidden);
    target?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('multiple')) {
      this.role_ = this.multiple ? 'group' : 'radiogroup';
      if (!this.multiple && this._values.length > 1) this._values = this._values.slice(0, 1);
      // value="mon,thu" may have been read before the multiple attribute: split it now.
      if (this.multiple) this._values = [...new Set(this._values.flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean))];
    }
  }

  protected override render() {
    return html`<span part="label" class="label" aria-hidden="true" ?hidden=${!this.label}>${this.label}</span>
      <div part="chips" class="chips"><slot @slotchange=${this.sync}></slot></div>
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
    // a hint that changes wording cross-fades instead of flicking over
    if (changed.get('hint') && this.hint) crossfadeText(this.renderRoot.querySelector<HTMLElement>('.hint'), changed.get('hint') as string);
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

  private chipElements(): Element[] {
    return [...this.querySelectorAll('tr-chip')].filter((c) => c.closest('tr-chip-group') === this);
  }

  private chipValue(c: Element): string {
    if (c instanceof TrChip) return c.chipValue;
    return c.getAttribute('value') || (c.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private enabled(): TrChip[] {
    return this.isDisabled ? [] : this.pickable.filter((c) => !c.disabled);
  }

  /** Mirrors the value onto the chips, sets roles, the tab stops, form value and validity. */
  private sync = (): void => {
    const all = this.chips;
    const tags = all.length > 0 && all.every((c) => c.removable);
    const groupRole = tags ? 'list' : this.multiple ? 'group' : 'radiogroup';
    if (this.getAttribute('role') !== groupRole) this.setAttribute('role', groupRole);
    for (const c of all) {
      if (c.removable && c.getAttribute('role') !== (tags ? 'listitem' : null)) {
        if (tags) c.setAttribute('role', 'listitem');
        else c.removeAttribute('role');
      }
      if (c.removable && c.groupDisabled !== this.isDisabled) c.groupDisabled = this.isDisabled;
    }
    const chips = this.pickable;
    const role = this.multiple ? 'checkbox' : 'radio';
    for (const c of chips) {
      const on = this._values.includes(c.chipValue);
      if (c.selected !== on) c.selected = on;
      if (c.getAttribute('role') !== role) c.setAttribute('role', role);
      if (c.groupDisabled !== this.isDisabled) c.groupDisabled = this.isDisabled;
    }
    const enabled = this.enabled();
    const stop = enabled.find((c) => c.selected) ?? enabled[0];
    for (const c of chips) {
      const t = this.isDisabled || c.disabled ? -1 : this.multiple || c === stop ? 0 : -1;
      // compare the attribute: a custom element without one already reports tabIndex -1
      if (c.getAttribute('tabindex') !== String(t)) c.setAttribute('tabindex', String(t));
    }
    const chosen = chips.filter((c) => c.selected).map((c) => c.chipValue);
    if (!chosen.length) this.internals.setFormValue(null, this.value);
    else if (this.multiple && this.name) {
      const fd = new FormData();
      for (const v of chosen) fd.append(this.name, v);
      this.internals.setFormValue(fd, this.value);
    } else this.internals.setFormValue(chosen.join(','), this.value);
    const anchor = stop ?? chips[0];
    if (this.error) this.internals.setValidity({ customError: true }, this.error, anchor);
    else if (this.required && !chosen.length) this.internals.setValidity({ valueMissing: true }, this.multiple ? 'Choose at least one option.' : 'Choose an option to continue.', anchor);
    else this.internals.setValidity({});
  };

  private onMutation(records: MutationRecord[]): void {
    for (const rec of records) {
      const t = rec.target;
      // Someone set `selected` on a chip directly: adopt it.
      if (rec.type === 'attributes' && rec.attributeName === 'selected' && t instanceof TrChip && t.closest('tr-chip-group') === this) {
        const v = t.chipValue;
        const has = this._values.includes(v);
        if (t.selected && !has) this._values = this.multiple ? [...this._values, v] : [v];
        else if (!t.selected && has) this._values = this._values.filter((x) => x !== v);
      }
    }
    this.sync();
  }

  private toggle(chip: TrChip, focus: boolean): void {
    if (focus) chip.focus();
    const v = chip.chipValue;
    if (this.multiple) {
      // Kept in chip order, so `values` and the submitted entries read like the page.
      const on = (c: TrChip) => (c === chip ? !this._values.includes(v) : this._values.includes(c.chipValue));
      this._values = this.pickable.filter(on).map((c) => c.chipValue);
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
    const chip = path.find((n): n is TrChip => n instanceof TrChip);
    if (!chip || chip.removable || chip.closest('tr-chip-group') !== this) return;
    // Links and controls inside a chip do their own thing.
    const inner = path.slice(0, path.indexOf(chip));
    if (inner.some((n) => n instanceof HTMLAnchorElement || n instanceof HTMLButtonElement || (n instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)))) return;
    if (this.isDisabled || chip.disabled) {
      e.preventDefault();
      return;
    }
    this.toggle(chip, true);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const current = e.target;
    if (!(current instanceof TrChip) || current.removable || this.isDisabled || e.altKey || e.ctrlKey || e.metaKey) return;
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
    let next: TrChip | undefined;
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

define('tr-chip-group', TrChipGroup);

declare global {
  interface HTMLElementTagNameMap {
    'tr-chip-group': TrChipGroup;
  }
}
