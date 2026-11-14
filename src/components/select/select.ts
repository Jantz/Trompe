import { css, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { TrOption } from './option.js';

const anchorSupport = typeof CSS !== 'undefined' && CSS.supports('anchor-name', '--a');
let nextId = 0;

/**
 * A single-choice dropdown: a raised key with an engraved chevron that opens a floating sheet
 * (depth 3) of `tr-option` rows in the top layer. Follows the WAI-ARIA APG select-only combobox
 * pattern: focus stays on the trigger (role="combobox") and the highlighted row is announced
 * through aria-activedescendant. Form-associated: submits `name=value`, supports `required`
 * and reset.
 *
 * Keyboard: closed, Down/Up/Enter/Space/Alt+Down open it, Home/End open on the first/last row,
 * and typing opens it on the first matching row. Open, Up/Down move, Home/End and
 * PageUp/PageDown jump, Enter/Space/Tab/Alt+Up choose and close, Escape closes without choosing,
 * typing jumps to a matching row. Clicking outside closes it.
 *
 * @summary Select-only combobox (role="combobox") with a listbox popup, form-associated.
 * @tag tr-select
 * @role combobox
 *
 * @slot - The `tr-option` elements.
 *
 * @csspart label - The visible label.
 * @csspart trigger - The raised key that shows the current choice.
 * @csspart value - The current choice (or placeholder) text.
 * @csspart chevron - The engraved chevron.
 * @csspart listbox - The floating sheet holding the options.
 *
 * @cssprop --tr-select-radius - Corner radius of trigger and sheet. Defaults to --tr-radius-md.
 * @cssprop --tr-select-height - Height of the trigger. Defaults by size (2.25em, 2.5em, 2.75em).
 * @cssprop --tr-select-max-height - Height the sheet scrolls at. Defaults to 18em.
 * @cssprop --tr-select-width - Width of the control. Defaults to 14em.
 *
 * @fires input - The user chose a different option.
 * @fires change - The user chose a different option.
 * @fires open - The listbox opened (does not bubble).
 * @fires close - The listbox closed (does not bubble).
 *
 * @example <tr-select label="Country" name="country" placeholder="Choose…" required><tr-option value="nl">Netherlands</tr-option><tr-option value="jp">Japan</tr-option></tr-select>
 * @example <tr-select aria-label="Sort by" value="new" material="metal"><tr-option value="new">Newest</tr-option><tr-option value="top">Top rated</tr-option></tr-select>
 */
export class TrSelect extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_depth: 1;
        --_curve-default: 0.35;
        --_h: var(--tr-select-height, var(--tr-control-md, 2.5em));
        --_rad: var(--tr-select-radius, var(--tr-radius-md, 10px));
        display: inline-flex;
        flex-direction: column;
        gap: 0.35em;
        width: var(--tr-select-width, 14em);
        max-width: 100%;
        vertical-align: middle;
        font-size: var(--tr-font-size-md, 1em);
        user-select: none;
      }
      :host([size='sm']) {
        --_h: var(--tr-select-height, var(--tr-control-sm, 2.25em));
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_h: var(--tr-select-height, var(--tr-control-lg, 2.75em));
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
      .trigger {
        --_tr-z: var(--_depth);
        anchor-name: --tr-select-trigger;
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-height: var(--_h);
        padding: 0 0.4em 0 0.85em;
        border-radius: var(--_rad);
        cursor: pointer;
        line-height: 1.2;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host(:hover) .trigger {
        --_tr-z: calc(var(--_depth) + 0.5);
      }
      :host(:active) .trigger,
      :host([open]) .trigger {
        --_tr-z: -1;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
        background-color: color-mix(in oklch, var(--_face), var(--_sh) calc(6% - var(--_r) * 4%));
      }
      .value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .value.placeholder {
        font-weight: var(--tr-font-weight-regular, 400);
        color: color-mix(in oklch, currentColor 68%, transparent);
      }
      /* the chevron is cut into a small recessed pocket at the end of the key */
      .pocket {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) 8%);
        --_gloss: 0;
        --_mirror: 0;
        --_brush: 0;
        --_spin: 0;
        --_curve: 0;
        flex: none;
        display: grid;
        place-items: center;
        width: calc(var(--_h) - 0.8em);
        height: calc(var(--_h) - 0.8em);
        border-radius: calc(var(--_rad) - 4px);
      }
      .chevron {
        width: 0.85em;
        height: 0.85em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        /* engraved: the groove's lower lip catches light */
        filter: drop-shadow(
          calc(var(--_sx) * -0.8px) calc(var(--_sy) * -0.8px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent)
        );
        transition: rotate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([open]) .chevron {
        rotate: 180deg;
      }
      .listbox {
        --_tr-z: 3;
        --_curve: 0;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0.3em;
        min-width: 10em;
        max-height: var(--tr-select-max-height, 18em);
        overflow: auto;
        overscroll-behavior: contain;
        /* a sheet of rows: pill radii from skins are clamped so rows never clip */
        border-radius: min(var(--_rad), 0.9em);
        font-size: inherit;
        font-family: var(--tr-font-family);
        color: var(--_ink);
        user-select: none;
      }
      .listbox:popover-open {
        display: grid;
        gap: 2px;
        animation: tr-select-in var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      .listbox.anchored {
        position-anchor: --tr-select-trigger;
        top: anchor(bottom);
        left: anchor(left);
        min-width: anchor-size(width);
        margin-block: 0.4em;
        position-try-fallbacks: flip-block;
      }
      @keyframes tr-select-in {
        from {
          opacity: 0;
          translate: 0 -0.3em;
          scale: 0.98;
        }
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) .trigger,
      :host(:state(disabled)) .trigger {
        --_tr-z: 0;
        cursor: not-allowed;
        translate: none;
      }
      :host([data-user-invalid]) .trigger {
        --_edge: var(--tr-color-danger);
        border-width: 1.5px;
      }
      @media (pointer: coarse) {
        .trigger {
          min-height: max(var(--_h), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        .trigger {
          border-color: ButtonText;
        }
        .listbox {
          border: 1px solid CanvasText;
        }
      }
    `,
  ];

  /** Visible label. Also the accessible name (as aria-label) unless you set your own. */
  @property({ reflect: true }) label = '';

  /** Value of the chosen option, or '' when nothing is chosen. */
  @property() value = '';

  /** Text shown while nothing is chosen. With a placeholder, no option is chosen by default. */
  @property() placeholder = '';

  /** Requires a choice for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Whether the listbox is showing. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Size of the control. */
  @property({ reflect: true }) size: Size = 'md';

  @query('.listbox') private listbox!: HTMLElement;
  @query('.trigger') private trigger!: HTMLElement;

  private defaultValue = '';
  private activeIndex = -1;
  private typeBuffer = '';
  private typeTimer = 0;
  private ownsLabel = false;
  private readonly listboxId = `tr-select-listbox-${++nextId}`;
  private observer = new MutationObserver(() => this.requestUpdate());

  constructor() {
    super();
    this.role_ = 'combobox';
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('focusout', this.onFocusOut);
    this.addEventListener('pointermove', this.onPointerMove);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.aria('aria-haspopup', 'listbox');
    this.observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'label', 'disabled'] });
    if (!this.hasAttribute('value')) {
      const sel = this.options.find((o) => o.hasAttribute('selected'));
      if (sel) this.value = sel.value;
    }
    this.defaultValue = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
    document.removeEventListener('pointerdown', this.onOutside, true);
  }

  /** The options, in document order. */
  get options(): TrOption[] {
    return [...this.querySelectorAll('tr-option')] as TrOption[];
  }

  /** The chosen option, if any. */
  get selectedOption(): TrOption | undefined {
    return this.value === '' && !this.options.some((o) => o.value === '') ? undefined : this.options.find((o) => o.value === this.value);
  }

  /** The validity state, as on a native select. */
  get validity(): ValidityState {
    return this.internals.validity;
  }

  /** Checks validity without showing a message. */
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Opens the listbox. */
  show(): void {
    if (this.isDisabled || this.open) return;
    const s = this.selectedOption;
    this.activeIndex = s && !s.disabled ? this.options.indexOf(s) : this.enabledIndex(0, 1);
    this.open = true;
  }

  /** Closes the listbox without choosing. */
  hide(): void {
    this.open = false;
  }

  protected override render() {
    const sel = this.selectedOption;
    const text = sel?.label ?? this.placeholder;
    return html`<span part="label" class="label" aria-hidden="true" ?hidden=${!this.label}>${this.label}</span>
      <span part="trigger" class="trigger surface focus-ring">
        <span part="value" class="value ${sel ? '' : 'placeholder'}">${text || ' '}</span>
        <span class="pocket surface" aria-hidden="true">
          <svg part="chevron" class="chevron" viewBox="0 0 16 16"><path d="M4 6.2l4 4 4-4" /></svg>
        </span>
      </span>
      <div part="listbox" class="listbox surface ${anchorSupport ? 'anchored' : ''}" id=${this.listboxId} role="listbox" popover="manual"
        aria-label=${this.label || this.getAttribute('aria-label') || 'Options'} @mousedown=${(e: Event) => e.preventDefault()}>
        <slot @slotchange=${() => this.requestUpdate()}></slot>
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
    if (changed.has('open')) this.applyOpen(changed.get('open') !== undefined);
    this.aria('aria-expanded', String(this.open));
    this.aria('aria-required', this.required ? 'true' : null);
    this.syncOptions();
  }

  formResetCallback(): void {
    this.value = this.defaultValue;
    this.removeAttribute('data-user-invalid');
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }

  private enabledIndex(from: number, step: 1 | -1): number {
    const opts = this.options;
    for (let i = from; i >= 0 && i < opts.length; i += step) if (!opts[i]!.disabled) return i;
    return -1;
  }

  private syncOptions = (): void => {
    const opts = this.options;
    // Like a native select: without a placeholder, the first enabled option is chosen by default.
    if (!this.placeholder && this.value === '' && opts.length && !opts.some((o) => o.value === '')) {
      const first = opts.find((o) => !o.disabled);
      if (first) {
        this.value = first.value;
        if (!this.hasUpdated || this.defaultValue === '') this.defaultValue = first.value;
      }
    }
    const sel = this.selectedOption;
    opts.forEach((o, i) => {
      o.selected = o === sel;
      o.active = this.open && i === this.activeIndex;
    });
    const active = this.open ? opts[this.activeIndex] : undefined;
    this.aria('aria-activedescendant', active ? active.id : null);
    this.internals.setFormValue(sel ? this.value : null, this.value);
    if (this.required && (!sel || this.value === '')) {
      this.internals.setValidity({ valueMissing: true }, 'Choose an option to continue.', this.trigger ?? undefined);
    } else {
      this.internals.setValidity({});
    }
  };

  private applyOpen(fire: boolean): void {
    const lb = this.listbox;
    if (!lb) return;
    if (this.open) {
      const opts = this.options;
      if (this.activeIndex < 0) {
        const s = this.selectedOption;
        this.activeIndex = s ? opts.indexOf(s) : this.enabledIndex(0, 1);
      }
      try {
        lb.showPopover();
      } catch {
        /* not connected */
      }
      if (!anchorSupport) this.place();
      this.syncOptions();
      this.scrollActive();
      document.addEventListener('pointerdown', this.onOutside, true);
      if (fire) this.dispatchEvent(new Event('open'));
    } else {
      try {
        lb.hidePopover();
      } catch {
        /* already hidden */
      }
      this.activeIndex = -1;
      document.removeEventListener('pointerdown', this.onOutside, true);
      if (fire) this.dispatchEvent(new Event('close'));
    }
  }

  /** JS placement for browsers without CSS anchor positioning. */
  private place(): void {
    const r = this.trigger.getBoundingClientRect();
    const lb = this.listbox;
    lb.style.minWidth = `${r.width}px`;
    lb.style.left = `${r.left}px`;
    const below = innerHeight - r.bottom;
    const h = lb.offsetHeight;
    if (below < h + 8 && r.top > below) lb.style.top = `${Math.max(4, r.top - h - 6)}px`;
    else lb.style.top = `${r.bottom + 6}px`;
  }

  private scrollActive(): void {
    const o = this.options[this.activeIndex];
    if (!o || !this.listbox) return;
    const lb = this.listbox;
    const top = o.offsetTop;
    const bottom = top + o.offsetHeight;
    if (top < lb.scrollTop) lb.scrollTop = top - 4;
    else if (bottom > lb.scrollTop + lb.clientHeight) lb.scrollTop = bottom - lb.clientHeight + 4;
  }

  private setActive(i: number): void {
    if (i < 0) return;
    this.activeIndex = i;
    this.syncOptions();
    this.scrollActive();
  }

  private choose(i: number): void {
    const o = this.options[i];
    if (!o || o.disabled) return;
    const changed = o.value !== this.value || !this.selectedOption;
    this.value = o.value;
    this.removeAttribute('data-user-invalid');
    if (changed) {
      this.emit('input');
      this.emit('change');
    }
  }

  private typeahead(key: string): void {
    clearTimeout(this.typeTimer);
    this.typeTimer = window.setTimeout(() => (this.typeBuffer = ''), 500);
    this.typeBuffer += key.toLowerCase();
    const opts = this.options;
    const n = opts.length;
    const start = this.activeIndex;
    // Repeating one letter cycles through the options that start with it.
    const same = this.typeBuffer.split('').every((c) => c === this.typeBuffer[0]);
    const needle = same ? this.typeBuffer[0]! : this.typeBuffer;
    const offset = same && this.typeBuffer.length > 1 ? 1 : this.typeBuffer.length === 1 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      const i = (((start + offset + k) % n) + n) % n;
      const o = opts[i]!;
      if (!o.disabled && o.label.toLowerCase().startsWith(needle)) {
        this.setActive(i);
        return;
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target !== this || this.isDisabled) return;
    const opts = this.options;
    const last = this.enabledIndex(opts.length - 1, -1);
    const first = this.enabledIndex(0, 1);
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!this.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        this.show();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        this.show();
        this.setActive(e.key === 'Home' ? first : last);
      } else if (printable) {
        e.preventDefault();
        this.show();
        this.typeahead(e.key);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        if (e.altKey) break;
        e.preventDefault();
        this.setActive(this.enabledIndex(this.activeIndex + 1, 1) >= 0 ? this.enabledIndex(this.activeIndex + 1, 1) : this.activeIndex);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) {
          this.choose(this.activeIndex);
          this.hide();
          return;
        }
        this.setActive(this.enabledIndex(this.activeIndex - 1, -1) >= 0 ? this.enabledIndex(this.activeIndex - 1, -1) : this.activeIndex);
        return;
      case 'Home':
        e.preventDefault();
        this.setActive(first);
        return;
      case 'End':
        e.preventDefault();
        this.setActive(last);
        return;
      case 'PageDown':
        e.preventDefault();
        this.setActive(this.enabledIndex(Math.min(opts.length - 1, this.activeIndex + 10), -1));
        return;
      case 'PageUp':
        e.preventDefault();
        this.setActive(this.enabledIndex(Math.max(0, this.activeIndex - 10), 1));
        return;
      case 'Enter':
        e.preventDefault();
        this.choose(this.activeIndex);
        this.hide();
        return;
      case ' ':
        e.preventDefault();
        if (this.typeBuffer) {
          this.typeahead(' ');
          return;
        }
        this.choose(this.activeIndex);
        this.hide();
        return;
      case 'Escape':
        e.preventDefault();
        this.hide();
        return;
      case 'Tab':
        this.choose(this.activeIndex);
        this.hide();
        return;
      default:
        if (printable) {
          e.preventDefault();
          this.typeahead(e.key);
        }
    }
  };

  private onClick = (e: MouseEvent): void => {
    if (this.isDisabled) {
      e.preventDefault();
      return;
    }
    const path = e.composedPath();
    const opt = path.find((n): n is TrOption => n instanceof TrOption);
    if (opt) {
      if (opt.disabled) return;
      this.choose(this.options.indexOf(opt));
      this.hide();
      this.focus();
      return;
    }
    if (path.includes(this.listbox)) return;
    this.open = !this.open;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.open) return;
    const opt = e.composedPath().find((n): n is TrOption => n instanceof TrOption);
    if (!opt || opt.disabled) return;
    const i = this.options.indexOf(opt);
    if (i !== this.activeIndex) {
      this.activeIndex = i;
      this.syncOptions();
    }
  };

  private onOutside = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  private onFocusOut = (): void => {
    // APG: leaving the combobox closes the listbox.
    if (this.open) this.hide();
  };
}

define('tr-select', TrSelect);

declare global {
  interface HTMLElementTagNameMap {
    'tr-select': TrSelect;
  }
}
