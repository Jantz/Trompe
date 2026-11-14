import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';
import { reducedMotion } from '../../interaction/motion.js';

type Slot = number | 'gap';

/**
 * The page numbers to show: always `2 * siblings + 5` slots once there are more pages than that
 * (first, a gap or number, the siblings around the current page, a gap or number, last), so the
 * bar keeps its width while the reader moves through the pages.
 */
export function pageSlots(page: number, pages: number, siblings = 1): Slot[] {
  const s = Math.max(0, Math.floor(siblings));
  const count = 2 * s + 5;
  if (pages <= count) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= s + 3) return [...Array.from({ length: count - 2 }, (_, i) => i + 1), 'gap', pages];
  if (page >= pages - s - 2) return [1, 'gap', ...Array.from({ length: count - 2 }, (_, i) => pages - (count - 3) + i)];
  return [1, 'gap', ...Array.from({ length: 2 * s + 1 }, (_, i) => page - s + i), 'gap', pages];
}

/**
 * Page navigation for long lists and tables: previous and next keys around a row of page numbers
 * set into a recessed tray. The current page is a lit key cap that glides from number to number.
 * The bar shows a fixed number of slots (first, last, the pages around the current one and
 * gaps), so it keeps its width as the reader pages through.
 *
 * When its container is too narrow for the full row, it switches by itself to a compact
 * "Page 3 of 12" with previous and next keys, so it never overflows a phone. Set `compact` to use
 * that form always.
 *
 * It is a navigation landmark named by `label` ("Pagination"). Page keys are named "Page 4" and
 * the current one has aria-current="page". Clicking a key sets `page` and fires `change` with
 * `detail.page`; load or show that page in your handler.
 *
 * @summary Pagination (role="navigation"): page keys with first, last, gaps and prev/next; compact on narrow screens.
 * @tag tr-pagination
 * @role navigation
 *
 * @csspart tray - The recessed tray holding the keys.
 * @csspart key - Every key (page numbers, gaps, previous, next).
 * @csspart current - The lit cap marking the current page.
 * @csspart status - The "Page 3 of 12" text of the compact form.
 *
 * @cssprop --tr-pagination-align - Where the bar sits in its line: start, center or end. Defaults to center.
 * @cssprop --tr-pagination-key-size - Height and smallest width of a key. Defaults by size (2em, 2.25em, 2.6em).
 *
 * @fires change - The user picked a page. `detail.page` is the new page (1-based).
 *
 * @example <tr-pagination total="240" page-size="20" page="3"></tr-pagination>
 * @example <tr-pagination pages="12" page="6" siblings="1" label="Results pages"></tr-pagination>
 * @example <tr-pagination pages="40" page="7" compact></tr-pagination>
 */
export class TrPagination extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_k: var(--tr-pagination-key-size, 2.25em);
        --_trad: var(--tr-radius-md, 10px);
        display: block;
        min-width: 0;
        max-width: 100%;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_k: var(--tr-pagination-key-size, 2em);
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        --_k: var(--tr-pagination-key-size, 2.6em);
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .bar {
        position: relative;
        display: flex;
        justify-content: var(--tr-pagination-align, center);
        min-width: 0;
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
        display: flex;
        align-items: center;
        gap: 0.2em;
        padding: 0.25em;
        border-radius: var(--_trad);
        width: max-content;
        max-width: none;
      }
      /* the full row stays laid out (to measure it) but hidden while the compact form shows */
      /* the hidden full row must not widen the page */
      :host([data-compact]) .bar {
        overflow-x: clip;
        overflow-clip-margin: 4px;
      }
      :host([data-compact]) .full {
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        inset-inline-start: 0;
        top: 0;
      }
      .compact {
        display: none;
      }
      :host([data-compact]) .compact {
        display: flex;
      }
      .key {
        position: relative;
        display: inline-grid;
        place-items: center;
        min-width: var(--_k);
        height: var(--_k);
        padding: 0 0.45em;
        margin: 0;
        border-radius: calc(var(--_trad) - 3px);
        font: inherit;
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        cursor: pointer;
        outline: none;
        -webkit-tap-highlight-color: transparent;
        transition: color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      .key:not(.surface) {
        border: 0;
        background: none;
        color: inherit;
      }
      .key > * {
        grid-area: 1 / 1;
      }
      .lab {
        position: relative;
        z-index: 1;
      }
      /* numbers and the status are boxes, so a cross-fade ghost of the old text lands exactly on them */
      /* the text and a fading copy of the old text share one grid cell */
      .lab,
      .status {
        display: inline-grid;
        justify-items: start;
      }
      .num,
      .status-text {
        grid-area: 1 / 1;
      }
      .ghost {
        pointer-events: none;
      }
      /* number keys print on the tray floor; a plate rises under the pointer */
      .plate {
        --_tr-z: 0.6;
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.4);
        --_tex: none;
        position: absolute;
        inset: 0;
        border-radius: inherit;
        opacity: 0;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          --_tr-z var(--tr-motion-duration-press, 70ms) ease-out;
      }
      .key.page:hover .plate {
        opacity: 1;
      }
      .key.page:active .plate {
        --_tr-z: -0.4;
      }
      .key.current {
        color: var(--tr-color-accent-ink, #fff);
        cursor: default;
      }
      .key.current .plate {
        opacity: 0;
      }
      .key.gap {
        cursor: default;
        color: color-mix(in oklch, currentColor 60%, transparent);
        letter-spacing: 0.08em;
      }
      /* previous and next are always raised keys */
      .key.step {
        --_tr-z: 1;
        --_curve: var(--tr-p-curve, 0.3);
        --_tex: none;
        width: var(--_k);
        padding: 0;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          opacity var(--tr-motion-duration-release, 160ms);
      }
      .key.step:hover {
        --_tr-z: 1.5;
      }
      .key.step:active {
        --_tr-z: -0.5;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .key.step[aria-disabled='true'] {
        --_tr-z: 0.3;
        opacity: 0.45;
        cursor: not-allowed;
        translate: none;
      }
      .key svg {
        width: 1em;
        height: 1em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .key:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 1px;
        z-index: 2;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      /* the lit cap of the current page: one element that glides between numbers */
      .thumb {
        --_tr-z: 1.2;
        --_base: var(--tr-color-accent);
        --_ink: var(--tr-color-accent-ink, #fff);
        --_curve: var(--tr-p-curve, 0.35);
        --_edge: color-mix(in oklch, var(--tr-color-accent), var(--_sh) 25%);
        --_tex: none;
        position: absolute;
        left: 0;
        top: 0;
        border-radius: calc(var(--_trad) - 3px);
        pointer-events: none;
        opacity: 0;
        transition:
          translate var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.3, 1.2, 0.4, 1),
          width var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.3, 1.2, 0.4, 1),
          opacity var(--tr-motion-duration-release, 160ms);
      }
      .thumb.placed {
        opacity: 1;
      }
      .thumb.snap {
        transition: none;
      }
      .status {
        position: relative;
        padding: 0 0.75em;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        font-weight: var(--tr-font-weight-strong, 600);
        font-size: 0.9375em;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (pointer: coarse) {
        :host {
          --_k: max(var(--tr-pagination-key-size, 2.25em), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        .tray {
          border: 1px solid ButtonText;
        }
        .thumb {
          background: Highlight;
          forced-color-adjust: none;
        }
        .key.current {
          color: HighlightText;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Current page, from 1. Kept within 1 and the number of pages. */
  @property({ type: Number, reflect: true }) page = 1;

  /** Number of items. With `page-size`, gives the number of pages. */
  @property({ type: Number, reflect: true }) total = 0;

  /** Items per page. */
  @property({ type: Number, reflect: true, attribute: 'page-size' }) pageSize = 10;

  /** Number of pages, when you know it directly. Wins over `total` / `page-size`. */
  @property({ type: Number, reflect: true }) pages?: number;

  /** Page numbers shown on each side of the current one. */
  @property({ type: Number, reflect: true }) siblings = 1;

  /** Always show the compact "Page 3 of 12" form. Without it, the compact form is used only when the full row does not fit. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Accessible name of the navigation landmark. */
  @property({ reflect: true }) label = 'Pagination';

  /** Size of the keys. */
  @property({ reflect: true }) size: Size = 'md';

  @state() private narrow = false;

  private ro: ResizeObserver | null = null;
  private shownText: string[] = [];
  private shownStatus: string | null = null;
  private focusCurrent = false;

  /** The number of pages (at least 1). */
  get pageCount(): number {
    if (this.pages !== undefined && this.pages !== null && Number.isFinite(Number(this.pages))) return Math.max(1, Math.floor(Number(this.pages)));
    const size = Math.max(1, Number(this.pageSize) || 10);
    return Math.max(1, Math.ceil((Number(this.total) || 0) / size));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'navigation');
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.fit(true));
      this.ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.ro = null;
  }

  /** Goes to a page (clamped) and fires `change` when it differs. */
  goTo(page: number): void {
    const p = Math.min(this.pageCount, Math.max(1, Math.round(page)));
    if (p === this.page) return;
    this.page = p;
    this.dispatchEvent(new CustomEvent('change', { detail: { page: p }, bubbles: true, composed: true }));
  }

  protected override willUpdate(): void {
    const n = this.pageCount;
    const p = Math.min(n, Math.max(1, Math.round(Number(this.page) || 1)));
    if (p !== this.page) this.page = p;
  }

  protected override render() {
    const n = this.pageCount;
    const page = this.page;
    const slots = pageSlots(page, n, this.siblings);
    const first = page <= 1;
    const last = page >= n;
    const prev = (id: string) =>
      html`<button part="key" class="key step surface" data-step=${id} aria-label="Previous page" aria-disabled=${first ? 'true' : 'false'} @click=${() => !first && this.step(-1)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
      </button>`;
    const next = (id: string) =>
      html`<button part="key" class="key step surface" data-step=${id} aria-label="Next page" aria-disabled=${last ? 'true' : 'false'} @click=${() => !last && this.step(1)}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
      </button>`;
    const compact = this.compact || this.narrow;
    return html`<div class="bar">
      <div part="tray" class="tray full surface" ?inert=${compact}>
        ${prev('prev')}
        <span part="current" class="thumb surface" aria-hidden="true"></span>
        ${repeat(
          slots,
          (_, i) => i,
          // One template for numbers and gaps, so a slot that turns from "2" into "…" keeps its
          // element and cross-fades instead of being swapped.
          (s) => {
            const gap = s === 'gap';
            const cur = s === page;
            return html`<button part="key" class="key ${gap ? 'gap' : 'page'} ${cur ? 'current' : ''}" tabindex=${gap ? '-1' : nothing}
              aria-hidden=${gap ? 'true' : nothing} ?disabled=${gap} aria-label=${gap ? nothing : `Page ${s}`} aria-current=${gap ? nothing : cur ? 'page' : 'false'}
              @click=${() => !gap && this.pick(s as number)}><span class="plate surface"></span><span class="lab"><span class="num">${gap ? '…' : s}</span></span></button>`;
          },
        )}
        ${next('next')}
      </div>
      <div class="tray compact surface" ?inert=${!compact} aria-hidden=${compact ? 'false' : 'true'}>
        ${prev('prev-c')}
        <span part="status" class="status" aria-live="polite"><span class="status-text">${`Page ${page} of ${n}`}</span></span>
        ${next('next-c')}
      </div>
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.aria('aria-label', this.label || 'Pagination');
    this.toggleAttribute('data-compact', this.compact || this.narrow);
    // Numbers that change in place (the window moving) cross-fade instead of flicking over.
    const nums = [...this.renderRoot.querySelectorAll<HTMLElement>('.full .key .num:not(.ghost)')];
    const texts = nums.map((el) => el.textContent ?? '');
    if (this.shownText.length === nums.length) nums.forEach((el, i) => texts[i] !== this.shownText[i] && this.swapText(el, this.shownText[i]!));
    this.shownText = texts;
    const status = this.renderRoot.querySelector<HTMLElement>('.status-text');
    const st = status?.textContent ?? '';
    if (status && this.shownStatus !== null && st !== this.shownStatus && this.hasAttribute('data-compact')) this.swapText(status, this.shownStatus);
    this.shownStatus = st;
    this.placeThumb(changed.has('page') && changed.get('page') !== undefined);
    if (this.focusCurrent) {
      this.focusCurrent = false;
      this.renderRoot.querySelector<HTMLElement>('.full .key.current')?.focus();
    }
    // A step key that just became disabled hands focus to the current page, not to the page body.
    const active = this.renderRoot instanceof ShadowRoot ? this.renderRoot.activeElement : null;
    if (active instanceof HTMLElement && active.getAttribute('aria-disabled') === 'true') {
      const compactView = this.hasAttribute('data-compact');
      const other = this.renderRoot.querySelector<HTMLElement>(
        compactView ? `[data-step=${active.dataset.step === 'prev-c' ? 'next-c' : 'prev-c'}]` : '.full .key.current',
      );
      other?.focus();
    }
    if (changed.has('pages') || changed.has('total') || changed.has('pageSize') || changed.has('siblings') || changed.has('size')) this.fit(false);
  }

  /**
   * Cross-fades a number or the status to its new text. The old text is a copy stacked in the same
   * grid cell (not positioned over it), so it sits exactly where the text was.
   */
  private swapText(el: HTMLElement, previous: string): void {
    if (typeof el.animate !== 'function') return;
    const still = reducedMotion(this);
    el.parentElement?.querySelectorAll('.ghost').forEach((g) => g.remove());
    if (previous.trim()) {
      const ghost = el.cloneNode(false) as HTMLElement;
      ghost.classList.add('ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = previous;
      el.after(ghost);
      ghost
        .animate([{ opacity: 1, translate: 'none' }, { opacity: 0, translate: still ? 'none' : '0 -0.3em' }], { duration: 140, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => ghost.remove(), () => ghost.remove());
    }
    el.animate([{ opacity: 0, translate: still ? 'none' : '0 0.3em' }, { opacity: 1, translate: 'none' }], { duration: 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }

  private pick(p: number): void {
    if (p === this.page) return;
    this.focusCurrent = true;
    this.goTo(p);
  }

  private step(d: number): void {
    this.goTo(this.page + d);
  }

  /** Glides the lit cap under the current page key. */
  private placeThumb(animate: boolean): void {
    const thumb = this.renderRoot.querySelector<HTMLElement>('.thumb');
    const key = this.renderRoot.querySelector<HTMLElement>('.full .key.current');
    if (!thumb || !key) return;
    const x = key.offsetLeft;
    const y = key.offsetTop;
    const w = key.offsetWidth;
    const h = key.offsetHeight;
    const first = !thumb.classList.contains('placed');
    const snap = first || !animate || reducedMotion(this);
    thumb.classList.toggle('snap', snap);
    thumb.style.translate = `${x}px ${y}px`;
    thumb.style.width = `${w}px`;
    thumb.style.height = `${h}px`;
    if (snap) {
      void thumb.offsetWidth;
      thumb.classList.remove('snap');
    }
    thumb.classList.add('placed');
  }

  /** Switches to the compact form when the full row is wider than the space it has. */
  private fit = (replace = true): void => {
    const full = this.renderRoot?.querySelector<HTMLElement>('.full');
    if (!full) return;
    const avail = this.clientWidth;
    if (!avail) return;
    const narrow = full.offsetWidth > avail + 0.5;
    if (narrow !== this.narrow) this.narrow = narrow;
    // Sizes changed (fonts loaded, container resized): keep the cap under its key.
    if (replace) this.placeThumb(false);
  };
}

define('tr-pagination', TrPagination);

declare global {
  interface HTMLElementTagNameMap {
    'tr-pagination': TrPagination;
  }
}
