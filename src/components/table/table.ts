import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/**
 * Styles for the native table inside tr-table. They have to live in the table's own tree (the
 * document, or the shadow root that holds it), so tr-table adopts them there once, in the
 * lowest-priority layer: any page CSS wins.
 */
const TABLE_CSS = `
@layer trompe.components {
:where(tr-table) > table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
  color: inherit;
  font-size: inherit;
}
:where(tr-table) > table > caption {
  caption-side: top;
  text-align: start;
  padding: 0 var(--_cell-x) 0.6em;
  font-weight: var(--tr-font-weight-strong, 600);
}
:where(tr-table) :where(th, td) {
  padding: var(--_cell-y) var(--_cell-x);
  text-align: start;
  vertical-align: middle;
  border-bottom: 1px solid var(--_rule);
  /* an engraved line: the cut catches light on its far edge */
  box-shadow: inset 0 -1px 0 0 var(--_rule-light);
}
:where(tr-table) :where(thead th, thead td) {
  position: var(--_sticky, static);
  top: 0;
  z-index: 1;
  padding-block: calc(var(--_cell-y) * 0.8);
  font-size: 0.75em;
  font-weight: var(--tr-font-weight-strong, 600);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tr-color-ink-muted);
  white-space: nowrap;
  background: var(--_head-bg);
  border-bottom-color: var(--_rule-strong);
}
:where(tr-table) :where(tbody tr:last-child) > :where(th, td),
:where(tr-table) :where(tfoot tr:last-child) > :where(th, td) {
  border-bottom-color: transparent;
  box-shadow: none;
}
:where(tr-table) :where(tfoot) :where(th, td) {
  font-weight: var(--tr-font-weight-strong, 600);
  border-top: 1px solid var(--_rule-strong);
}
:where(tr-table) :where(td, th):where([data-numeric], .num) {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
:where(tr-table) :where(tbody tr) {
  transition: background-color var(--tr-motion-duration-release, 160ms);
}
:where(tr-table[striped]) :where(tbody tr:nth-child(even)) {
  background: color-mix(in oklch, var(--tr-color-ink) 3.5%, transparent);
}
:where(tr-table:not([hover='false'])) :where(tbody tr:hover) {
  background: color-mix(in oklch, var(--tr-color-ink) 6%, transparent);
}
:where(tr-table) :where(tbody tr[aria-selected='true']) {
  background: color-mix(in oklch, var(--tr-color-accent) 14%, transparent);
}
:where(tr-table) :where(tbody tr[aria-selected='true']) > :first-child {
  box-shadow: inset 3px 0 0 var(--tr-color-accent), inset 0 -1px 0 0 var(--_rule-light);
}
:where(tr-table) :where(th[aria-sort], th[data-sort]) {
  cursor: pointer;
  user-select: none;
}
:where(tr-table) :where(th[aria-sort], th[data-sort]):hover {
  color: var(--tr-color-ink);
}
:where(tr-table) :where(th[aria-sort], th[data-sort])::after {
  content: '';
  display: inline-block;
  width: 0.55em;
  height: 0.55em;
  margin-inline-start: 0.45em;
  vertical-align: 0.05em;
  background: currentColor;
  /* a diamond (sortable) that folds into an up or down triangle */
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  opacity: 0.35;
  transition: clip-path var(--tr-motion-duration-release, 160ms), opacity var(--tr-motion-duration-release, 160ms);
}
:where(tr-table) th[aria-sort='ascending']::after {
  clip-path: polygon(50% 15%, 100% 75%, 50% 75%, 0 75%);
  opacity: 1;
  color: var(--tr-color-accent);
}
:where(tr-table) th[aria-sort='descending']::after {
  clip-path: polygon(50% 25%, 100% 25%, 50% 85%, 0 25%);
  opacity: 1;
  color: var(--tr-color-accent);
}
:where(tr-table) :where(th[data-sort]):focus-visible {
  outline: 2px solid var(--tr-color-focus);
  outline-offset: -2px;
}
/* Narrow containers: each row becomes a small card of label / value pairs. */
@container tr-table (max-width: 34em) {
  :where(tr-table:not([stack='never'])) > table,
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot),
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr {
    display: block;
  }
  :where(tr-table:not([stack='never'])) > table > thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr {
    padding: calc(var(--_cell-y) * 0.6) 0;
    border-bottom: 1px solid var(--_rule);
    box-shadow: inset 0 -1px 0 0 var(--_rule-light);
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr:last-child {
    border-bottom: 0;
    box-shadow: none;
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr > :where(td, th) {
    display: grid;
    grid-template-columns: minmax(6em, 38%) 1fr;
    gap: 0.75em;
    align-items: center;
    padding-block: calc(var(--_cell-y) * 0.35);
    border: 0;
    box-shadow: none;
    text-align: start;
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr > :where(td, th)::before {
    content: attr(data-label);
    font-size: 0.75em;
    font-weight: var(--tr-font-weight-strong, 600);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--tr-color-ink-muted);
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr > :where(td, th):not([data-label])::before,
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr > :where(td, th)[data-label='']::before {
    content: none;
  }
  :where(tr-table:not([stack='never'])) > table > :where(tbody, tfoot) > tr > :where(td, th):where([data-label=''], :not([data-label])) {
    grid-template-columns: 1fr;
  }
}
}
`;

const adopted = new WeakSet<Document | ShadowRoot>();
function adopt(root: Node): void {
  const r = root as Document | ShadowRoot;
  if (adopted.has(r) || !('adoptedStyleSheets' in r)) return;
  adopted.add(r);
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(TABLE_CSS);
    r.adoptedStyleSheets = [...r.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = TABLE_CSS;
    (r instanceof Document ? r.head : r).append(style);
  }
}

const cellText = (c: Element) => (c.textContent ?? '').trim();

/**
 * A data table set into the material: wrap a normal `<table>` (thead/tbody/tfoot) and it gets a
 * recessed tray, engraved row rules, small-caps headers, tabular figures, hover and selected rows
 * (`<tr aria-selected="true">`), and sort arrows. Keep your own semantic table: every framework can
 * render rows into it as usual.
 *
 * Responsive by default: when the table is narrower than 34em, each row turns into a card of
 * label/value pairs. The labels come from the header cells and are copied to each cell's
 * `data-label` automatically (set it yourself to override, or `data-label=""` to hide one).
 *
 * Sorting: give a header `data-sort` (any key) and clicking it, or Enter on it, cycles
 * `aria-sort` and fires a cancelable `sort` event with `{ key, column, direction }`. Re-order your
 * data in the handler. With `autosort`, the table re-orders its own rows (plain HTML only; don't
 * use it when a framework renders the rows), and the rows glide to their new places.
 *
 * Numbers: add `data-numeric` (or class "num") to cells to right-align them.
 *
 * @summary Data table: a native <table> in a recessed tray, sortable, stacks into cards on phones.
 * @tag tr-table
 *
 * @slot - A native `<table>`.
 *
 * @csspart tray - The tray around the table (scrolls horizontally when `stack="never"`).
 *
 * @cssprop --tr-table-cell-padding-x - Horizontal cell padding. Defaults by density.
 * @cssprop --tr-table-cell-padding-y - Vertical cell padding. Defaults by density.
 * @cssprop --tr-table-max-height - Height after which the body scrolls under a sticky header. Defaults to none.
 * @cssprop --tr-table-radius - Corner radius of the tray. Defaults to --tr-radius-lg.
 *
 * @fires sort - A sortable header was activated. Cancelable. `detail: { key, column, direction }`.
 *
 * @example <tr-table><table><thead><tr><th data-sort="name">Name</th><th>Role</th><th data-numeric data-sort="seats">Seats</th></tr></thead><tbody><tr><td>Ada Lovelace</td><td>Owner</td><td data-numeric>12</td></tr></tbody></table></tr-table>
 * @example <tr-table density="compact" striped variant="plain"><table>…</table></tr-table>
 */
export class TrTable extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_cell-x: var(--tr-table-cell-padding-x, 1em);
        --_cell-y: var(--tr-table-cell-padding-y, 0.75em);
        --_rule: color-mix(in oklch, var(--tr-color-shadow, #000) calc(10% + var(--_r) * 8%), transparent);
        --_rule-strong: color-mix(in oklch, var(--tr-color-edge) 55%, transparent);
        --_rule-light: color-mix(in oklch, var(--tr-color-highlight, #fff) calc(var(--_r) * 22% * (1 - var(--tr-lift, 0) * 0.7)), transparent);
        --_head-bg: transparent;
        container: tr-table / inline-size;
        display: block;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([density='compact']) {
        --_cell-x: var(--tr-table-cell-padding-x, 0.75em);
        --_cell-y: var(--tr-table-cell-padding-y, 0.45em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([density='comfortable']) {
        --_cell-x: var(--tr-table-cell-padding-x, 1.25em);
        --_cell-y: var(--tr-table-cell-padding-y, 1em);
      }
      .tray {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--tr-color-well), var(--tr-color-surface) 45%);
        --_ink: var(--tr-color-ink);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        display: block;
        padding: 0.25em 0;
        border-radius: var(--tr-table-radius, var(--tr-radius-lg, 14px));
        max-height: var(--tr-table-max-height, none);
        overflow: auto;
        overscroll-behavior: contain;
      }
      :host([variant='raised']) .tray {
        --_tr-z: 2;
        --_base: var(--_m-base);
        --_ink: var(--_m-ink);
        --_reflect: 0.3;
      }
      :host([variant='plain']) .tray {
        --_tr-z: 0;
        background: none;
        border-color: transparent;
        box-shadow: none;
        padding: 0;
      }
      :host([sticky-header]) {
        --_sticky: sticky;
        --_head-bg: var(--_m-base);
      }
      :host([sticky-header]:not([variant='raised'])) {
        --_head-bg: color-mix(in oklch, var(--tr-color-well), var(--tr-color-surface) 45%);
      }
      @media (forced-colors: active) {
        .tray {
          border: 1px solid CanvasText;
        }
      }
    `,
  ];

  /** Row height. */
  @property({ reflect: true }) density: 'compact' | 'regular' | 'comfortable' = 'regular';

  /** Physical treatment: recessed tray, raised card, or no tray (inside a panel). */
  @property({ reflect: true }) variant: 'well' | 'raised' | 'plain' = 'well';

  /** Tints every other row. */
  @property({ type: Boolean, reflect: true }) striped = false;

  /** Keeps the header visible while the body scrolls (set --tr-table-max-height). */
  @property({ type: Boolean, reflect: true, attribute: 'sticky-header' }) stickyHeader = false;

  /** `auto` stacks rows into cards in narrow containers; `never` scrolls sideways instead. */
  @property({ reflect: true }) stack: 'auto' | 'never' = 'auto';

  /** Re-orders its own rows when a sortable header is clicked (plain HTML only). */
  @property({ type: Boolean, reflect: true }) autosort = false;

  private observer?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    adopt(this.getRootNode());
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKey);
    this.observer = new MutationObserver(() => this.label());
    this.observer.observe(this, { childList: true, subtree: true, characterData: true });
    this.label();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  private get table(): HTMLTableElement | null {
    return this.querySelector(':scope > table');
  }

  /** Copies header text into each cell's data-label (for the stacked layout) and makes sortable headers focusable. */
  private label(): void {
    const t = this.table;
    if (!t) return;
    this.observer?.disconnect();
    const heads = [...(t.tHead?.rows[t.tHead.rows.length - 1]?.cells ?? [])];
    const names = heads.map(cellText);
    for (const body of [...t.tBodies, ...(t.tFoot ? [t.tFoot] : [])]) {
      for (const row of body.rows) {
        let col = 0;
        for (const cell of row.cells) {
          if (!cell.hasAttribute('data-label') || cell.hasAttribute('data-tr-label')) {
            const name = names[col] ?? '';
            if (cell.getAttribute('data-label') !== name) cell.setAttribute('data-label', name);
            cell.setAttribute('data-tr-label', '');
          }
          col += cell.colSpan || 1;
        }
      }
    }
    for (const th of heads) {
      if (th.hasAttribute('data-sort') && !th.hasAttribute('tabindex')) th.tabIndex = 0;
      if (th.hasAttribute('data-sort') && !th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'none');
    }
    this.observer?.observe(this, { childList: true, subtree: true, characterData: true });
  }

  private onClick = (e: Event): void => {
    const th = (e.target as Element).closest?.('th[data-sort]') as HTMLTableCellElement | null;
    if (th && this.contains(th)) this.sortBy(th);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const th = (e.target as Element).closest?.('th[data-sort]') as HTMLTableCellElement | null;
    if (!th || !this.contains(th)) return;
    e.preventDefault();
    this.sortBy(th);
  };

  /** Activates a sortable header, as a click does. */
  sortBy(th: HTMLTableCellElement): void {
    const heads = [...(th.parentElement?.children ?? [])] as HTMLTableCellElement[];
    const column = heads.indexOf(th);
    const direction = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
    const ok = this.dispatchEvent(
      new CustomEvent('sort', { bubbles: true, composed: true, cancelable: true, detail: { key: th.dataset.sort || cellText(th), column, direction } }),
    );
    if (!ok) return;
    for (const h of heads) if (h.hasAttribute('aria-sort')) h.setAttribute('aria-sort', h === th ? direction : 'none');
    if (this.autosort) this.reorder(column, direction);
  }

  private reorder(column: number, direction: 'ascending' | 'descending'): void {
    const body = this.table?.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    const key = (r: HTMLTableRowElement) => {
      const c = r.cells[column];
      const v = c?.dataset.value ?? cellText(c ?? r);
      const n = Number(v.replace(/[^\d.,-]/g, '').replace(/,/g, ''));
      return /\d/.test(v) && Number.isFinite(n) && !/[a-z]{2}/i.test(v.replace(/[$€£¥%]|kg|km|ms|px/gi, '')) ? n : v.toLowerCase();
    };
    const sign = direction === 'ascending' ? 1 : -1;
    rows.sort((a, b) => {
      const x = key(a), y = key(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sign;
    });
    body.append(...rows);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const r of rows) {
      const dy = before.get(r)! - r.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    }
  }

  protected override render() {
    return html`<div part="tray" class="tray surface"><slot @slotchange=${() => this.label()}></slot></div>`;
  }
}

define('tr-table', TrTable);

declare global {
  interface HTMLElementTagNameMap {
    'tr-table': TrTable;
  }
}
