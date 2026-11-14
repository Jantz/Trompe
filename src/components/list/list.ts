import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { TrListItem } from './list-item.js';

/**
 * A list of content rows for settings, records or files. Rows sit in a recessed tray (`inset`,
 * default), on a raised card (`card`), or directly on the page (`flush`), separated by engraved
 * divider lines.
 *
 * By default it is a plain list (role="list"). With `selectable` it becomes a listbox
 * (WAI-ARIA APG): one Tab stop, Up/Down move between rows, Home/End jump to the ends, and
 * type-ahead finds a row by its first letters. Single selection follows focus; with `multiple`,
 * Space toggles the focused row and Shift+Up/Down extends. A selected row sinks into the tray
 * and shows a check mark, so selection never relies on color.
 *
 * @summary Content list, or selectable listbox, of tr-list-item rows.
 * @tag tr-list
 * @role list
 *
 * @slot - tr-list-item elements.
 *
 * @csspart surface - The tray or card the rows sit in.
 *
 * @cssprop --tr-list-radius - Corner radius. Defaults to --tr-radius-lg.
 * @cssprop --tr-list-padding - Space between the tray edge and the rows. Defaults to 0.25em (0 for flush).
 *
 * @fires input - The selection changed by user action.
 * @fires change - The selection changed by user action. Read `value` or `selectedValues`.
 *
 * @example <tr-list label="Account"><tr-list-item>Email<span slot="description">ada@example.com</span><tr-button slot="end" size="sm">Change</tr-button></tr-list-item></tr-list>
 * @example <tr-list selectable label="Files" value="b"><tr-list-item value="a">Notes.md</tr-list-item><tr-list-item value="b">Plan.md</tr-list-item></tr-list>
 */
export class TrList extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        display: block;
        outline: none;
        font-size: var(--tr-font-size-md, 1em);
      }
      .surface {
        display: flex;
        /* a broad content surface: tame clear-coat and mirror reflections so text stays legible */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        flex-direction: column;
        padding: var(--tr-list-padding, 0.25em);
        border-radius: var(--tr-list-radius, var(--tr-radius-lg, 16px));
      }
      :host([variant='inset']) .surface {
        --_tr-z: -1;
        /* a tray cut into the material itself: stays readable whatever the theme's well color */
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) calc(5% + var(--tr-lift, 0) * 8%));
      }
      :host([variant='card']) .surface {
        --_tr-z: 1;
      }
      :host([variant='flush']) .surface {
        padding: var(--tr-list-padding, 0);
        background: none;
        border-color: transparent;
        box-shadow: none;
      }
      :host([variant='flush']) .surface::before {
        display: none;
      }
    `,
  ];

  /** Accessible name of the list. */
  @property() label = '';

  /** Surface the rows sit on. */
  @property({ reflect: true }) variant: 'inset' | 'card' | 'flush' = 'inset';

  /** Makes rows selectable: the list becomes a listbox and its rows options. */
  @property({ type: Boolean, reflect: true }) selectable = false;

  /** Allows selecting several rows (with `selectable`). */
  @property({ type: Boolean, reflect: true }) multiple = false;

  /** Value of the first selected row. Set it to select a single row. */
  @property({ reflect: true }) value = '';

  private typeahead = '';
  private typeaheadTimer?: ReturnType<typeof setTimeout>;
  private anchor?: TrListItem;

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('click', this.onClick);
    this.addEventListener('focusin', this.onFocusIn);
  }

  /** The tr-list-item rows, in order. */
  get items(): TrListItem[] {
    return [...this.children].filter((el): el is TrListItem => el.localName === 'tr-list-item');
  }

  /** Values of every selected row. */
  get selectedValues(): string[] {
    return this.items.filter((i) => i.selected).map((i) => i.value);
  }

  protected override render() {
    return html`<div part="surface" class="surface"><slot @slotchange=${this.sync}></slot></div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('role', this.selectable ? 'listbox' : 'list');
    this.aria('aria-label', this.label || null);
    this.aria('aria-multiselectable', this.selectable && this.multiple ? 'true' : null);
    if (changed.has('value') && this.selectable && this.value !== this.selectedValues[0]) {
      for (const item of this.items) item.selected = !!this.value && item.value === this.value;
    }
    this.sync();
  }

  private sync = (): void => {
    const items = this.items;
    if (this.selectable && this.value && !items.some((i) => i.selected)) {
      for (const item of items) item.selected = item.value === this.value;
    }
    const focusable = items.filter((i) => !i.disabled);
    const current = focusable.find((i) => i.getAttribute('tabindex') === '0') ?? focusable.find((i) => i.selected) ?? focusable[0];
    for (const item of items) {
      item.setAttribute('role', this.selectable ? 'option' : 'listitem');
      if (this.selectable) {
        item.setAttribute('aria-selected', String(item.selected));
        item.setAttribute('tabindex', item === current ? '0' : '-1');
      } else {
        item.removeAttribute('aria-selected');
        item.removeAttribute('tabindex');
      }
    }
    const first = this.selectedValues[0] ?? '';
    if (this.selectable && this.value !== first) this.value = first;
  };

  private commit(): void {
    this.sync();
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  private focusItem(item: TrListItem): void {
    for (const i of this.items) i.setAttribute('tabindex', i === item ? '0' : '-1');
    item.focus();
    item.scrollIntoView?.({ block: 'nearest' });
  }

  private selectOnly(item: TrListItem): boolean {
    let changed = false;
    for (const i of this.items) {
      const on = i === item;
      if (i.selected !== on) {
        i.selected = on;
        changed = true;
      }
    }
    return changed;
  }

  private itemFrom(e: Event): TrListItem | undefined {
    const item = (e.target as Element).closest?.('tr-list-item') as TrListItem | null;
    return item && item.parentElement === this ? item : undefined;
  }

  private onFocusIn = (e: FocusEvent): void => {
    if (!this.selectable) return;
    const item = this.itemFrom(e);
    if (item) for (const i of this.items) i.setAttribute('tabindex', i === item ? '0' : '-1');
  };

  private onClick = (e: MouseEvent): void => {
    if (!this.selectable) return;
    const item = this.itemFrom(e);
    if (!item || item.disabled) return;
    // let buttons and links inside the row do their own thing
    const path = e.composedPath();
    if (path.slice(0, path.indexOf(item)).some((n) => n instanceof HTMLElement && n.matches('a, button, input, select, textarea, [role=button], tr-button, tr-switch, tr-checkbox'))) return;
    this.focusItem(item);
    if (this.multiple) {
      if (e.shiftKey && this.anchor) this.selectRange(this.anchor, item);
      else {
        item.selected = !item.selected;
        this.anchor = item;
      }
      this.commit();
    } else if (this.selectOnly(item)) {
      this.commit();
    }
  };

  private selectRange(from: TrListItem, to: TrListItem): void {
    const items = this.items;
    const [a, b] = [items.indexOf(from), items.indexOf(to)].sort((x, y) => x - y);
    items.forEach((i, n) => {
      if (n >= a! && n <= b! && !i.disabled) i.selected = true;
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.selectable) return;
    const item = this.itemFrom(e);
    if (!item || e.target !== item) return;
    const items = this.items.filter((i) => !i.disabled);
    const at = items.indexOf(item);
    let target: TrListItem | undefined;
    switch (e.key) {
      case 'ArrowDown':
        target = items[Math.min(items.length - 1, at + 1)];
        break;
      case 'ArrowUp':
        target = items[Math.max(0, at - 1)];
        break;
      case 'Home':
        target = items[0];
        break;
      case 'End':
        target = items[items.length - 1];
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        if (this.multiple) {
          item.selected = !item.selected;
          this.anchor = item;
          this.commit();
        } else if (this.selectOnly(item)) this.commit();
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this.typeahead += e.key.toLowerCase();
          clearTimeout(this.typeaheadTimer);
          this.typeaheadTimer = setTimeout(() => (this.typeahead = ''), 500);
          const order = [...items.slice(at + 1), ...items.slice(0, at + 1)];
          if (this.typeahead.length > 1) order.unshift(item);
          target = order.find((i) => i.textContent?.trim().toLowerCase().startsWith(this.typeahead));
          if (!target) return;
        } else {
          return;
        }
    }
    e.preventDefault();
    if (!target) return;
    this.focusItem(target);
    if (this.multiple) {
      if (e.shiftKey && target !== item) {
        target.selected = true;
        this.commit();
      }
    } else if (this.selectOnly(target)) {
      this.commit();
    }
  };
}

define('tr-list', TrList);

declare global {
  interface HTMLElementTagNameMap {
    'tr-list': TrList;
  }
}
