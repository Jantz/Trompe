import { css, html, nothing, render as renderInto, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { FormControl } from '../../internal/form-control.js';
import { define } from '../../internal/trompe-element.js';
import { reducedMotion } from '../../interaction/motion.js';
import {
  addDays,
  addMonths,
  clampISO,
  daysInMonth,
  firstOfMonth,
  fromISO,
  isISO,
  isoWeek,
  localeOf,
  monthOf,
  splitRange,
  toISO,
  todayISO,
  weekStartOf,
} from './dates.js';

type View = 'days' | 'months' | 'years';

/** Builds a yyyy-mm month from a year and a 0-based month (any overflow rolls into the year). */
function ym(year: number, month0: number): string {
  const d = new Date(year, month0, 1, 12);
  return toISO(d).slice(0, 7);
}

/**
 * A month of days as small keys on a recessed tray. Pick one date, or a range with `range`.
 * The grid always has six weeks, so moving between months never changes its height; the new
 * month slides in from the side you travel to. The title switches to a month grid, then a year
 * grid, for long jumps.
 *
 * Follows the WAI-ARIA APG date grid: one day is in the tab order; arrows move by day and week,
 * Home/End go to the start/end of the week, PageUp/PageDown change the month (with Shift, the
 * year), Enter or Space choose. Each day is read out in full ("Tuesday 3 November 2026") with
 * its selected, disabled and today states.
 *
 * Form-associated: with a `name`, it submits its `value` like an input.
 *
 * @summary Calendar month grid: pick a date or a date range.
 * @tag tr-calendar
 *
 * @csspart calendar - The plate around the header and grid.
 * @csspart header - The row with the title and the previous/next keys.
 * @csspart title - The month and year (a key that opens the month and year grids).
 * @csspart previous - The previous month key.
 * @csspart next - The next month key.
 * @csspart grid - The recessed tray holding the days.
 * @csspart day - Each day cell.
 *
 * @cssprop --tr-calendar-cell-size - Size of a day key. Defaults to 2.5em (44px on touch screens).
 * @cssprop --tr-calendar-color - Selection colour. Defaults to --tr-color-accent.
 * @cssprop --tr-calendar-radius - Corner radius of the day keys. Defaults to 0.55em.
 *
 * @fires input - The selection changed, including the first click of a range (value is then a single date).
 * @fires change - A date, or a complete range, was chosen.
 *
 * @example <tr-calendar value="2026-11-03" label="Delivery day"></tr-calendar>
 * @example <tr-calendar range value="2026-11-03/2026-11-09" min="2026-11-01" label="Stay"></tr-calendar>
 * @example <tr-calendar week-numbers first-day-of-week="1" locale="de-DE"></tr-calendar>
 */
export class TrCalendar extends FormControl {
  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_cell: var(--tr-calendar-cell-size, 2.5em);
        --_sel-color: var(--tr-calendar-color, var(--tr-color-accent));
        --_sel-ink: var(--tr-calendar-ink, var(--tr-color-accent-ink, #fff));
        --_key-rad: var(--tr-calendar-radius, 0.55em);
        --_cols: 7;
        display: inline-block;
        max-width: 100%;
        vertical-align: top;
        font-size: var(--tr-font-size-md, 1em);
        user-select: none;
        -webkit-user-select: none;
      }
      :host([week-numbers]) {
        --_cols: 8;
      }
      @media (pointer: coarse) {
        :host {
          --_cell: var(--tr-calendar-cell-size, max(2.5em, 44px));
        }
      }
      .cal {
        --_tr-z: 1;
        --_curve: 0;
        /* a large plate carrying text: calm its reflections */
        --_reflect: 0.35;
        display: grid;
        gap: 0.5em;
        padding: 0.6em;
        border-radius: var(--tr-radius-lg, 14px);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 0.4em;
        min-width: 0;
      }
      .title {
        flex: 1;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35em;
        height: 2.25em;
        padding: 0 0.6em;
        border: 0;
        border-radius: var(--tr-radius-md, 10px);
        background: none;
        color: inherit;
        font: inherit;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.01em;
        cursor: pointer;
        transition: background-color var(--tr-motion-duration-release, 160ms);
      }
      .title:hover {
        background-color: color-mix(in oklch, currentColor 7%, transparent);
      }
      .title:focus-visible,
      .nav:focus-visible,
      .pick:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      /* the old title fades out on the same centre as the new one (see swapTitle) */
      .title-stack {
        position: relative;
        display: inline-block;
        white-space: nowrap;
      }
      .title-ghost {
        position: absolute;
        left: 50%;
        top: 0;
        transform: translateX(-50%);
        white-space: nowrap;
        pointer-events: none;
      }
      .title svg {
        flex: none;
        width: 0.7em;
        height: 0.7em;
        opacity: 0.6;
        transition: rotate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([data-view='months']) .title svg,
      :host([data-view='years']) .title svg {
        rotate: 180deg;
      }
      .nav {
        --_tr-z: 1;
        --_curve: 0.4;
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 2.25em;
        height: 2.25em;
        padding: 0;
        border-radius: 50%;
        font: inherit;
        cursor: pointer;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out),
          opacity var(--tr-motion-duration-release, 160ms);
      }
      .nav:hover {
        --_tr-z: 1.5;
      }
      .nav:active {
        --_tr-z: -0.5;
        translate: calc(var(--_sx) * 1px) calc(var(--_sy) * 1px);
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .nav:disabled {
        --_tr-z: 0;
        opacity: 0.4;
        cursor: default;
        translate: none;
      }
      .nav svg {
        width: 0.9em;
        height: 0.9em;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      :host(:dir(rtl)) .nav svg {
        scale: -1 1;
      }
      /* the recessed tray the keys sit in */
      .tray {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) 5%);
        --_gloss: 0;
        --_mirror: 0;
        --_brush: 0;
        --_spin: 0;
        --_curve: 0;
        padding: 0.3em;
        border-radius: calc(var(--_key-rad) + 0.3em);
      }
      .view {
        position: relative;
        /* the slide stays inside the tray; focus rings and key shadows may spill a little */
        overflow: clip;
        overflow-clip-margin: 0.3em;
        width: calc(var(--_cell) * var(--_cols));
        max-width: 100%;
        height: calc(var(--_cell) * 6 + 2em);
      }
      /* each month (or month/year grid) is rendered into its own box, so the old one can slide away */
      .box {
        position: absolute;
        inset: 0;
        /* always its own layer, so text does not snap by a pixel when a slide starts */
        will-change: transform;
      }
      .page {
        height: 100%;
        display: grid;
      }
      .page.days {
        grid-template-rows: 2em repeat(6, minmax(0, 1fr));
      }
      .page.months,
      .page.years {
        grid-template-rows: repeat(4, minmax(0, 1fr));
        gap: 0.25em;
        padding: 0.2em;
      }
      .ghost {
        pointer-events: none;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(var(--_cols), minmax(0, 1fr));
        min-height: 0;
      }
      .page.months .row,
      .page.years .row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.25em;
      }
      .dow,
      .wk {
        display: grid;
        place-items: center;
        font-size: 0.72em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: color-mix(in oklch, currentColor 62%, transparent);
      }
      .wk {
        font-variant-numeric: tabular-nums;
        text-transform: none;
        color: color-mix(in oklch, currentColor 48%, transparent);
      }
      .cell,
      .pick {
        position: relative;
        display: grid;
        place-items: center;
        min-width: 0;
        min-height: 0;
        border: 0;
        padding: 0;
        background: none;
        color: inherit;
        font: inherit;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        outline: none;
        transition: color var(--tr-motion-duration-release, 160ms);
      }
      .cell > *,
      .pick > * {
        grid-area: 1 / 1;
      }
      /* a range is one continuous tinted band under the keys */
      .band {
        position: absolute;
        inset: 10% 0;
        background: color-mix(in oklab, var(--_sel-color) 20%, transparent);
        opacity: 0;
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      .cell.in-range .band,
      .cell.range-start .band,
      .cell.range-end .band {
        opacity: 1;
      }
      .cell.range-start .band {
        left: 50%;
      }
      .cell.range-end .band {
        right: 50%;
      }
      .cell.range-start.range-end .band {
        opacity: 0;
      }
      .cell.row-start .band {
        left: 6%;
        border-start-start-radius: var(--_key-rad);
        border-end-start-radius: var(--_key-rad);
      }
      .cell.row-end .band {
        right: 6%;
        border-start-end-radius: var(--_key-rad);
        border-end-end-radius: var(--_key-rad);
      }
      .cell.preview .band {
        background: color-mix(in oklab, var(--_sel-color) 11%, transparent);
      }
      .plate {
        --_tr-z: 0.5;
        --_curve: 0.3;
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.4);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        --_brush: 0;
        --_spin: 0;
        /* --_sel (registered) fades the key from the material to the lit accent */
        --_sel: 0;
        --_base: color-mix(in oklab, var(--_m-base), var(--_sel-color) calc(var(--_sel) * 100%));
        --_ink: color-mix(in oklab, var(--_m-ink), var(--_sel-ink) calc(var(--_sel) * 100%));
        place-self: stretch;
        margin: 6%;
        border-radius: var(--_key-rad);
        opacity: 0;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          --_sel var(--tr-motion-duration-release, 160ms) ease-out,
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      .num {
        position: relative;
        font-size: 0.9375em;
        line-height: 1;
      }
      .pick .num {
        font-size: 0.875em;
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .cell.outside {
        color: color-mix(in oklch, currentColor 42%, transparent);
      }
      .cell:hover:not(.disabled) .plate,
      .pick:hover:not(:disabled) .plate,
      .cell:focus-visible .plate,
      .pick:focus-visible .plate {
        opacity: 1;
      }
      .cell:focus-visible .plate,
      .pick:focus-visible .plate {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 1px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .cell:active:not(.disabled) .plate,
      .pick:active:not(:disabled) .plate {
        --_tr-z: -0.5;
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      /* chosen: a lit key in the accent colour */
      .cell.selected .plate,
      .pick.selected .plate {
        --_sel: 1;
        --_tr-z: 1;
        opacity: 1;
        box-shadow:
          inset 0 0 0 1px color-mix(in oklch, var(--_hl) calc(var(--_r) * 25%), transparent),
          0 0 calc(4px + var(--_r) * 8px) color-mix(in oklch, var(--_sel-color) calc(var(--_r) * 45%), transparent),
          calc(var(--_sx) * 1.5px) calc(var(--_sy) * 1.5px) 3px color-mix(in oklch, var(--_sh) calc(var(--_r) * 30%), transparent);
      }
      .cell.selected,
      .pick.selected {
        color: var(--_sel-ink);
      }
      /* today: a small engraved dot under the number */
      .cell.today .num::after,
      .pick.today .num::after {
        content: '';
        position: absolute;
        left: 50%;
        top: calc(100% + 0.22em);
        width: 0.28em;
        height: 0.28em;
        margin-left: -0.14em;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.75;
      }
      .cell.today:not(.selected) .num::after,
      .pick.today:not(.selected) .num::after {
        background: var(--_sel-color);
        opacity: 1;
      }
      .cell.disabled,
      .pick:disabled {
        cursor: not-allowed;
        color: color-mix(in oklch, currentColor 30%, transparent);
      }
      .cell.disabled .num {
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }
      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
        pointer-events: none;
      }
      @media (forced-colors: active) {
        .cell.selected .plate,
        .pick.selected .plate {
          forced-color-adjust: none;
          background: Highlight;
          color: HighlightText;
        }
        .cell.in-range .band {
          forced-color-adjust: none;
          background: Mark;
        }
      }
    `,
  ];

  /**
   * The chosen date, as yyyy-mm-dd. With `range`, two dates joined by a slash
   * (2026-11-03/2026-11-09); while the second date is still being picked it holds only the first.
   */
  @property() value = '';

  /** Pick a start and an end date instead of one date. */
  @property({ type: Boolean, reflect: true }) range = false;

  /** Earliest date that can be chosen (yyyy-mm-dd). */
  @property({ reflect: true }) min = '';

  /** Latest date that can be chosen (yyyy-mm-dd). */
  @property({ reflect: true }) max = '';

  /** The month on show, as yyyy-mm. Defaults to the month of the value, or today. */
  @property({ reflect: true }) month = '';

  /** First day of the week, 0 (Sunday) to 6 (Saturday). Defaults to the locale's. */
  @property({ type: Number, attribute: 'first-day-of-week', reflect: true }) firstDayOfWeek?: number;

  /** Locale for month and day names, e.g. "de-DE". Defaults to the nearest `lang`. */
  @property({ reflect: true }) locale = '';

  /** Shows ISO week numbers in a column before the days. */
  @property({ type: Boolean, attribute: 'week-numbers', reflect: true }) weekNumbers = false;

  /** Requires a date (or a complete range) for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Accessible name of the grid, e.g. "Delivery day". The month and year are always read too. */
  @property({ reflect: true }) label = '';

  /** Return true for dates that cannot be chosen (weekends, booked days). Property only. */
  @property({ attribute: false }) isDateDisabled?: (date: Date) => boolean;

  /** The focused day, month or year. */
  @state() private cursor = '';
  @state() private view: View = 'days';
  /** The first date of a range being picked, and the date the pointer is over. */
  @state() private anchor = '';
  @state() private hover = '';

  private defaultValue: string | null = null;
  private refocus = false;
  /** The box holding the page on show, and what it shows. */
  private live: HTMLElement | null = null;
  private shownPage: { month: string; view: View } | null = null;
  private pendingSlide: { dir: number; zoom: number } | null = null;
  private shownTitle: string | null = null;
  private chevronX: number | null = null;

  constructor() {
    super();
    this.hostFocusable = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultValue === null) this.defaultValue = this.getAttribute('value') ?? this.value;
  }

  /** First date of the selection (the date itself when not a range). */
  get start(): string {
    return splitRange(this.value)[0];
  }
  set start(v: string) {
    this.value = this.range ? [v, this.end].filter(Boolean).join('/') : v;
  }

  /** Last date of a range ('' while it is not complete). */
  get end(): string {
    return this.range ? splitRange(this.value)[1] : '';
  }
  set end(v: string) {
    this.value = [this.start, v].filter(Boolean).join('/');
  }

  /** The value as Date objects (local noon), for convenience. */
  get valueAsDate(): Date | null {
    return fromISO(this.start);
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  /** Focuses the day in the tab order (the chosen date, or today). */
  override focus(options?: FocusOptions): void {
    const cell = this.live?.querySelector<HTMLElement>('[tabindex="0"]');
    if (cell) cell.focus(options);
    else super.focus(options);
  }

  /** Shows the month of a date (yyyy-mm-dd or yyyy-mm) and moves the keyboard cursor there. */
  goTo(date: string): void {
    const iso = isISO(date) ? date : isISO(`${date}-01`) ? `${date}-01` : '';
    if (!iso) return;
    this.view = 'days';
    this.cursor = iso;
    this.month = monthOf(iso);
  }

  // -----------------------------------------------------------------------------------------
  // Dates

  private get loc(): string {
    return localeOf(this, this.locale);
  }

  private get weekStart(): number {
    const f = this.firstDayOfWeek;
    return typeof f === 'number' && f >= 0 && f <= 7 ? f % 7 : weekStartOf(this.loc);
  }

  private shownMonth(): string {
    if (/^\d{4}-\d{2}$/.test(this.month)) return this.month;
    const base = this.start || clampISO(todayISO(), this.min, this.max);
    return monthOf(base);
  }

  private dateOff(iso: string): boolean {
    if (this.min && isISO(this.min) && iso < this.min) return true;
    if (this.max && isISO(this.max) && iso > this.max) return true;
    if (this.isDateDisabled) {
      try {
        return !!this.isDateDisabled(fromISO(iso)!);
      } catch {
        return false;
      }
    }
    return false;
  }

  private monthOutside(month: string): boolean {
    const first = firstOfMonth(month);
    const last = `${month}-${String(daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1)).padStart(2, '0')}`;
    return (!!this.min && isISO(this.min) && last < this.min) || (!!this.max && isISO(this.max) && first > this.max);
  }

  private yearOutside(year: number): boolean {
    return (!!this.min && isISO(this.min) && year < Number(this.min.slice(0, 4))) || (!!this.max && isISO(this.max) && year > Number(this.max.slice(0, 4)));
  }

  private fmt(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    try {
      return new Intl.DateTimeFormat(this.loc, opts);
    } catch {
      return new Intl.DateTimeFormat('en', opts);
    }
  }

  // -----------------------------------------------------------------------------------------
  // Lifecycle

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value') || changed.has('range')) {
      // A value set from outside (not mid-pick) ends any range being picked.
      if (!this.picking) this.anchor = '';
      if (changed.has('value') && this.start && !this.picking && this.hasUpdated && !changed.has('month')) {
        const m = monthOf(this.start);
        if (m !== this.shownMonth()) this.month = m;
      }
    }
    if (!this.cursor || (changed.has('value') && !this.picking && this.start)) {
      const m = this.shownMonth();
      this.cursor = this.start && monthOf(this.start) === m ? this.start : monthOf(todayISO()) === m ? todayISO() : firstOfMonth(m);
    }
    // Keep the cursor inside the shown month.
    if (this.view === 'days' && monthOf(this.cursor) !== this.shownMonth()) {
      const m = this.shownMonth();
      const day = Number(this.cursor.slice(8, 10)) || 1;
      this.cursor = `${m}-${String(Math.min(day, daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1))).padStart(2, '0')}`;
    }
    this.chevronX = this.renderRoot?.querySelector('.title svg')?.getBoundingClientRect().left ?? null;
    // The old page slides out while the new one slides in.
    const prev = this.shownPage;
    const month = this.shownMonth();
    if (prev && (prev.month !== month || prev.view !== this.view)) {
      const order: Record<View, number> = { days: 0, months: 1, years: 2 };
      let dir = 0;
      let zoom = 0;
      if (prev.view !== this.view) zoom = order[this.view] > order[prev.view] ? -1 : 1;
      else if (this.view === 'days') dir = month > prev.month ? 1 : -1;
      else if (this.view === 'months') dir = Math.sign(Number(month.slice(0, 4)) - Number(prev.month.slice(0, 4)));
      else dir = Math.sign(Math.floor(Number(month.slice(0, 4)) / 10) - Math.floor(Number(prev.month.slice(0, 4)) / 10));
      if (dir || zoom) this.pendingSlide = { dir, zoom };
    }
  }

  private get picking(): boolean {
    return this.range && !!this.anchor && this.anchor === this.value;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.view !== 'days') this.setAttribute('data-view', this.view);
    else this.removeAttribute('data-view');
    const [s, e] = splitRange(this.value);
    const complete = this.range ? Boolean(s && e) : Boolean(s);
    this.internals.setFormValue(complete ? this.value : null);
    this.renderPage();
    const grid = this.live?.querySelector<HTMLElement>('.page') ?? undefined;
    if (this.required && !complete) this.internals.setValidity({ valueMissing: true }, this.range ? 'Choose a start and an end date.' : 'Choose a date.', grid);
    else this.internals.setValidity({});

    const title = this.renderRoot.querySelector<HTMLElement>('.title-text');
    const shown = title?.textContent ?? '';
    if (this.shownTitle !== null && shown !== this.shownTitle) this.swapTitle(this.shownTitle);
    this.shownTitle = shown;

    if (this.refocus) {
      this.refocus = false;
      this.live?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
    }
  }

  /** Renders the page into its box; a new month or view gets a new box and the old one slides out. */
  private renderPage(): void {
    const view = this.renderRoot.querySelector<HTMLElement>('.view');
    if (!view) return;
    const slide = this.pendingSlide;
    this.pendingSlide = null;
    const old = slide ? this.live : null;
    if (old) this.live = null;
    if (!this.live) {
      this.live = document.createElement('div');
      this.live.className = 'box live';
      view.append(this.live);
    }
    const month = this.shownMonth();
    const year = Number(month.slice(0, 4));
    const tpl = this.view === 'days' ? this.renderDays(month, this.titleText(month)) : this.view === 'months' ? this.renderMonths(year) : this.renderYears(year);
    renderInto(tpl, this.live, { host: this });
    this.shownPage = { month, view: this.view };
    if (old && slide) this.slide(old, this.live, slide);
  }

  private slide(ghost: HTMLElement, now: HTMLElement, { dir, zoom }: { dir: number; zoom: number }): void {
    const view = ghost.parentElement;
    view?.querySelectorAll('.ghost').forEach((g) => g.remove());
    ghost.classList.replace('live', 'ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    if (typeof now.animate !== 'function' || !this.isConnected) {
      ghost.remove();
      return;
    }
    const still = reducedMotion(this);
    const d = 260;
    const flip = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    const shift = (n: number) => `translateX(${n * flip * 35}%)`;
    const out = still
      ? [{ opacity: 1 }, { opacity: 0 }]
      : zoom
        ? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `scale(${zoom < 0 ? 1.06 : 0.94})` }]
        : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: shift(-dir) }];
    const inn = still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : zoom
        ? [{ opacity: 0, transform: `scale(${zoom < 0 ? 0.94 : 1.06})` }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0, transform: shift(dir) }, { opacity: 1, transform: 'none' }];
    ghost.animate(out, { duration: d * 0.8, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }).finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
    now.animate(inn, { duration: d, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }

  /**
   * The old title fades out where it was while the new one fades in. Both are centred on the same
   * point (the text's centre does not move when its width changes); the chevron after it glides.
   */
  private swapTitle(previous: string): void {
    const stack = this.renderRoot.querySelector<HTMLElement>('.title-stack');
    const text = this.renderRoot.querySelector<HTMLElement>('.title-text');
    const chevron = this.renderRoot.querySelector<SVGElement>('.title svg');
    if (!stack || !text || typeof text.animate !== 'function') return;
    const still = reducedMotion(this);
    stack.querySelectorAll('.title-ghost').forEach((g) => g.remove());
    const ghost = document.createElement('span');
    ghost.className = 'title-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = previous;
    stack.append(ghost);
    ghost
      .animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: still ? '0 0' : '0 -0.35em' }], { duration: 150, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => ghost.remove(), () => ghost.remove());
    text.animate([{ opacity: 0, translate: still ? '0 0' : '0 0.35em' }, { opacity: 1, translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    const x0 = this.chevronX;
    if (chevron && x0 !== null) {
      const dx = x0 - chevron.getBoundingClientRect().left;
      if (Math.abs(dx) > 0.5) chevron.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    }
  }

  private titleText(month: string): string {
    const year = Number(month.slice(0, 4));
    const m0 = Number(month.slice(5, 7)) - 1;
    return this.fmt({ month: 'long', year: 'numeric' }).format(new Date(year, m0, 1, 12));
  }

  // -----------------------------------------------------------------------------------------
  // Render

  protected override render() {
    const month = this.shownMonth();
    const year = Number(month.slice(0, 4));
    const m0 = Number(month.slice(5, 7)) - 1;
    const view = this.view;
    let title: string;
    let prevLabel: string;
    let nextLabel: string;
    let prevOff: boolean;
    let nextOff: boolean;
    if (view === 'days') {
      title = this.fmt({ month: 'long', year: 'numeric' }).format(new Date(year, m0, 1, 12));
      prevLabel = 'Previous month';
      nextLabel = 'Next month';
      prevOff = this.monthOutside(ym(year, m0 - 1));
      nextOff = this.monthOutside(ym(year, m0 + 1));
    } else if (view === 'months') {
      title = this.fmt({ year: 'numeric' }).format(new Date(year, 0, 1, 12));
      prevLabel = 'Previous year';
      nextLabel = 'Next year';
      prevOff = this.yearOutside(year - 1);
      nextOff = this.yearOutside(year + 1);
    } else {
      const start = Math.floor(year / 10) * 10;
      title = `${start} – ${start + 11}`;
      prevLabel = 'Previous years';
      nextLabel = 'Next years';
      prevOff = this.yearOutside(start - 1);
      nextOff = this.yearOutside(start + 12);
    }
    const titleLabel = view === 'days' ? `${title}, choose month and year` : view === 'months' ? `${title}, choose year` : `${title}, back to days`;
    return html`<div part="calendar" class="cal surface">
      <div part="header" class="header">
        <button part="previous" class="nav surface" type="button" aria-label=${prevLabel} ?disabled=${prevOff} @click=${() => this.page(-1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
        </button>
        <button part="title" class="title" type="button" aria-label=${titleLabel} @click=${this.onTitle}>
          <span class="title-stack"><span class="title-text" aria-live="polite">${title}</span></span>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.2l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <button part="next" class="nav surface" type="button" aria-label=${nextLabel} ?disabled=${nextOff} @click=${() => this.page(1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
        </button>
      </div>
      <div part="grid" class="tray surface">
        <div class="view" @keydown=${this.onKeyDown} @click=${this.onClick} @pointerover=${this.onPointerOver} @pointerleave=${() => (this.hover = '')}></div>
      </div>
    </div>`;
  }

  private renderDays(month: string, title: string): TemplateResult {
    const first = fromISO(firstOfMonth(month))!;
    const lead = (first.getDay() - this.weekStart + 7) % 7;
    const start = addDays(firstOfMonth(month), -lead);
    const today = todayISO();
    const [s, e0] = splitRange(this.value);
    // While a range is being picked, the band previews up to the date under the pointer or cursor.
    const previewEnd = this.picking ? this.hover || (this.matches(':focus-within') ? this.cursor : '') : '';
    const a = this.picking ? this.anchor : s;
    const b = this.picking ? previewEnd : this.range ? e0 : '';
    const lo = b && b < a ? b : a;
    const hi = b && b < a ? a : b;
    const thursday = (4 - this.weekStart + 7) % 7;
    const dayName = this.fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const dowShort = this.fmt({ weekday: 'short' });
    const dowLong = this.fmt({ weekday: 'long' });
    const weekdays = Array.from({ length: 7 }, (_, i) => fromISO(addDays(start, i))!);
    const rows: TemplateResult[] = [];
    for (let r = 0; r < 6; r++) {
      const cells: TemplateResult[] = [];
      const rowStart = addDays(start, r * 7);
      for (let c = 0; c < 7; c++) {
        const iso = addDays(rowStart, c);
        const d = fromISO(iso)!;
        const disabled = this.dateOff(iso);
        const span = this.range && !!lo && !!hi && lo !== hi;
        const selected = this.picking ? iso === this.anchor : iso === s || (this.range && !!e0 && iso === e0);
        const inRange = span && iso > lo && iso < hi;
        const cls = [
          'cell',
          monthOf(iso) !== month ? 'outside' : '',
          disabled ? 'disabled' : '',
          iso === today ? 'today' : '',
          selected ? 'selected' : '',
          inRange ? 'in-range' : '',
          span && iso === lo ? 'range-start' : '',
          span && iso === hi ? 'range-end' : '',
          this.picking ? 'preview' : '',
          c === 0 ? 'row-start' : '',
          c === 6 ? 'row-end' : '',
        ]
          .filter(Boolean)
          .join(' ');
        cells.push(html`<div
          part="day"
          role="gridcell"
          class=${cls}
          data-date=${iso}
          tabindex=${iso === this.cursor ? '0' : '-1'}
          aria-label=${dayName.format(d)}
          aria-selected=${selected || (inRange && !this.picking) || (span && !this.picking && (iso === lo || iso === hi)) ? 'true' : 'false'}
          aria-disabled=${disabled ? 'true' : nothing}
          aria-current=${iso === today ? 'date' : nothing}
        ><span class="band"></span><span class="plate surface"></span><span class="num" aria-hidden="true">${d.getDate()}</span></div>`);
      }
      rows.push(
        html`<div class="row" role="row">${this.weekNumbers ? html`<div class="wk" role="rowheader" aria-label=${`Week ${isoWeek(addDays(rowStart, thursday))}`}>${isoWeek(addDays(rowStart, thursday))}</div>` : nothing}${cells}</div>`,
      );
    }
    return html`<div class="page days" role="grid" aria-label=${this.label ? `${this.label}, ${title}` : title} aria-multiselectable=${this.range ? 'true' : nothing}>
      <div class="row" role="row">
        ${this.weekNumbers ? html`<div class="wk" role="columnheader" title="Week">Wk</div>` : nothing}
        ${weekdays.map((d) => html`<div class="dow" role="columnheader" title=${dowLong.format(d)}>${dowShort.format(d)}</div>`)}
      </div>
      ${rows}
    </div>`;
  }

  private renderMonths(year: number): TemplateResult {
    const name = this.fmt({ month: 'short' });
    const full = this.fmt({ month: 'long', year: 'numeric' });
    const cur = this.cursor.slice(0, 7);
    const chosen = this.start ? monthOf(this.start) : '';
    const thisMonth = monthOf(todayISO());
    const rows: TemplateResult[] = [];
    for (let r = 0; r < 4; r++) {
      rows.push(html`<div class="row" role="row">
        ${[0, 1, 2].map((c) => {
          const m = ym(year, r * 3 + c);
          const off = this.monthOutside(m);
          const date = new Date(year, r * 3 + c, 1, 12);
          return html`<button
            role="gridcell"
            type="button"
            class="pick ${m === chosen ? 'selected' : ''} ${m === thisMonth ? 'today' : ''}"
            data-month=${m}
            tabindex=${m === cur ? '0' : '-1'}
            aria-label=${full.format(date)}
            aria-selected=${m === chosen ? 'true' : 'false'}
            ?disabled=${off}
          ><span class="plate surface"></span><span class="num">${name.format(date)}</span></button>`;
        })}
      </div>`);
    }
    return html`<div class="page months" role="grid" aria-label=${String(year)}>${rows}</div>`;
  }

  private renderYears(year: number): TemplateResult {
    const startYear = Math.floor(year / 10) * 10;
    const cur = Number(this.cursor.slice(0, 4));
    const chosen = this.start ? Number(this.start.slice(0, 4)) : NaN;
    const thisYear = Number(todayISO().slice(0, 4));
    const rows: TemplateResult[] = [];
    for (let r = 0; r < 4; r++) {
      rows.push(html`<div class="row" role="row">
        ${[0, 1, 2].map((c) => {
          const y = startYear + r * 3 + c;
          return html`<button
            role="gridcell"
            type="button"
            class="pick ${y === chosen ? 'selected' : ''} ${y === thisYear ? 'today' : ''}"
            data-year=${y}
            tabindex=${y === cur ? '0' : '-1'}
            aria-selected=${y === chosen ? 'true' : 'false'}
            ?disabled=${this.yearOutside(y)}
          ><span class="plate surface"></span><span class="num">${y}</span></button>`;
        })}
      </div>`);
    }
    return html`<div class="page years" role="grid" aria-label=${`${startYear} – ${startYear + 11}`}>${rows}</div>`;
  }

  // -----------------------------------------------------------------------------------------
  // Interaction

  /** Moves the shown month (or year, or block of years) by `n`. */
  private page(n: number): void {
    const month = this.shownMonth();
    const year = Number(month.slice(0, 4));
    const m0 = Number(month.slice(5, 7)) - 1;
    if (this.view === 'days') {
      this.month = ym(year, m0 + n);
      this.cursor = addMonths(this.cursor, n);
      this.cursor = this.clampToMonth(this.cursor, this.month);
    } else if (this.view === 'months') {
      this.month = ym(year + n, m0);
      this.cursor = `${String(year + n).padStart(4, '0')}${this.cursor.slice(4)}`;
    } else {
      this.month = ym(year + n * 10, m0);
      const cy = Number(this.cursor.slice(0, 4)) + n * 10;
      this.cursor = `${String(cy).padStart(4, '0')}${this.cursor.slice(4)}`;
    }
  }

  private clampToMonth(iso: string, month: string): string {
    if (monthOf(iso) === month) return iso;
    const day = Number(iso.slice(8, 10));
    return `${month}-${String(Math.min(day, daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1))).padStart(2, '0')}`;
  }

  private onTitle = (): void => {
    this.view = this.view === 'days' ? 'months' : this.view === 'months' ? 'years' : 'days';
    if (this.view === 'days') this.cursor = this.clampToMonth(this.cursor, this.shownMonth());
  };

  /** Moves the keyboard cursor to a day, following it into another month. */
  private moveTo(iso: string): void {
    const target = clampISO(iso, this.min, this.max);
    this.cursor = target;
    if (monthOf(target) !== this.shownMonth()) this.month = monthOf(target);
    this.refocus = true;
  }

  private choose(iso: string): void {
    if (this.isDisabled || this.dateOff(iso)) return;
    this.cursor = iso;
    if (monthOf(iso) !== this.shownMonth()) this.month = monthOf(iso);
    if (!this.range) {
      if (this.value === iso) return;
      this.value = iso;
      this.emit('input');
      this.emit('change');
      return;
    }
    if (!this.picking) {
      this.anchor = iso;
      this.value = iso;
      this.emit('input');
      return;
    }
    const [lo, hi] = iso < this.anchor ? [iso, this.anchor] : [this.anchor, iso];
    this.anchor = '';
    this.hover = '';
    this.value = `${lo}/${hi}`;
    this.emit('input');
    this.emit('change');
  }

  private onClick = (e: MouseEvent): void => {
    if (this.isDisabled) return;
    const path = e.composedPath() as HTMLElement[];
    const el = path.find((n) => n instanceof HTMLElement && (n.dataset?.date || n.dataset?.month || n.dataset?.year)) as HTMLElement | undefined;
    if (!el || el.closest('.ghost')) return;
    if (el.dataset.date) {
      this.refocus = this.matches(':focus-within');
      this.choose(el.dataset.date);
    } else if (el.dataset.month) this.pickMonth(el.dataset.month);
    else if (el.dataset.year) this.pickYear(Number(el.dataset.year));
  };

  private pickMonth(month: string): void {
    if (this.monthOutside(month)) return;
    this.month = month;
    this.cursor = this.clampToMonth(this.start && monthOf(this.start) === month ? this.start : `${month}-${this.cursor.slice(8, 10) || '01'}`, month);
    this.view = 'days';
    this.refocus = true;
  }

  private pickYear(year: number): void {
    if (this.yearOutside(year)) return;
    const m = this.shownMonth();
    this.month = ym(year, Number(m.slice(5, 7)) - 1);
    this.cursor = `${String(year).padStart(4, '0')}${this.cursor.slice(4)}`;
    this.view = 'months';
    this.refocus = true;
  }

  private onPointerOver = (e: PointerEvent): void => {
    if (!this.picking) return;
    const cell = (e.composedPath() as HTMLElement[]).find((n) => n instanceof HTMLElement && n.dataset?.date);
    const iso = cell?.dataset.date ?? '';
    if (iso && iso !== this.hover && !this.dateOff(iso)) this.hover = iso;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.isDisabled) return;
    const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
    const k = e.key;
    if (this.view === 'days') {
      const col = (fromISO(this.cursor)!.getDay() - this.weekStart + 7) % 7;
      let to = '';
      switch (k) {
        case 'ArrowLeft': to = addDays(this.cursor, -rtl); break;
        case 'ArrowRight': to = addDays(this.cursor, rtl); break;
        case 'ArrowUp': to = addDays(this.cursor, -7); break;
        case 'ArrowDown': to = addDays(this.cursor, 7); break;
        case 'Home': to = addDays(this.cursor, -col); break;
        case 'End': to = addDays(this.cursor, 6 - col); break;
        case 'PageUp': to = addMonths(this.cursor, e.shiftKey ? -12 : -1); break;
        case 'PageDown': to = addMonths(this.cursor, e.shiftKey ? 12 : 1); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.refocus = true;
          this.choose(this.cursor);
          return;
        default:
          return;
      }
      e.preventDefault();
      this.moveTo(to);
      return;
    }
    // Month and year grids: 3 columns.
    const months = this.view === 'months';
    const year = Number(this.shownMonth().slice(0, 4));
    let idx = months ? Number(this.cursor.slice(5, 7)) - 1 : Number(this.cursor.slice(0, 4)) - Math.floor(year / 10) * 10;
    switch (k) {
      case 'ArrowLeft': idx -= rtl; break;
      case 'ArrowRight': idx += rtl; break;
      case 'ArrowUp': idx -= 3; break;
      case 'ArrowDown': idx += 3; break;
      case 'Home': idx -= idx % 3; break;
      case 'End': idx += 2 - (idx % 3); break;
      case 'PageUp':
      case 'PageDown':
        e.preventDefault();
        this.page(k === 'PageUp' ? -1 : 1);
        this.refocus = true;
        return;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const t = this.live?.querySelector<HTMLElement>('[tabindex="0"]');
        if (t?.dataset.month) this.pickMonth(t.dataset.month);
        else if (t?.dataset.year) this.pickYear(Number(t.dataset.year));
        return;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.view = months ? 'days' : 'months';
        if (this.view === 'days') this.cursor = this.clampToMonth(this.cursor, this.shownMonth());
        this.refocus = true;
        return;
      default:
        return;
    }
    e.preventDefault();
    if (months) {
      const target = new Date(year, idx, 1, 12);
      const m = toISO(target).slice(0, 7);
      if (target.getFullYear() !== year) this.month = ym(target.getFullYear(), Number(this.shownMonth().slice(5, 7)) - 1);
      this.cursor = this.clampToMonth(`${m}-${this.cursor.slice(8, 10)}`, m);
    } else {
      const y = Math.floor(year / 10) * 10 + idx;
      if (Math.floor(y / 10) !== Math.floor(year / 10)) this.month = ym(y, Number(this.shownMonth().slice(5, 7)) - 1);
      this.cursor = `${String(y).padStart(4, '0')}${this.cursor.slice(4)}`;
    }
    this.refocus = true;
  };

  formResetCallback(): void {
    this.value = this.defaultValue ?? '';
    this.anchor = '';
  }

  formStateRestoreCallback(state: string): void {
    this.value = state;
  }
}

define('tr-calendar', TrCalendar);

declare global {
  interface HTMLElementTagNameMap {
    'tr-calendar': TrCalendar;
  }
}
