import { css, html, nothing, svg, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { reducedMotion } from '../../interaction/motion.js';
import { areaPath, barPath, formatter, labelStep, linePath, niceDomain, parseNumber, ticks, type Tick } from './geometry.js';

/** One plotted series. Only `key` is required; `label` defaults to the key, `color` to the palette. */
export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export type ChartType = 'line' | 'area' | 'bar' | 'sparkline';
export type ChartRow = Record<string, unknown>;

interface Model {
  xs: string[];
  series: Array<{ key: string; label: string; color?: string }>;
  /** values[series][point]; NaN where a value is missing */
  values: number[][];
}

/** Reference categorical hues (validated order) after the accent; light and dark steps. */
const PALETTE: Array<[number, string]> = [
  [255, 'light-dark(#2a78d6, #3987e5)'],
  [42, 'light-dark(#eb6834, #d95926)'],
  [165, 'light-dark(#1baf7a, #199e70)'],
  [75, 'light-dark(#eda100, #c98500)'],
  [355, 'light-dark(#e87ba4, #d55181)'],
  [142, 'light-dark(#008300, #0ca30c)'],
  [285, 'light-dark(#6250d6, #9085e9)'],
  [25, 'light-dark(#e34948, #e66767)'],
];

const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

const seriesConverter = {
  fromAttribute(v: string | null): ChartSeries[] | undefined {
    if (!v) return undefined;
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [key, ...rest] = s.split(':');
        return { key: key.trim(), label: rest.join(':').trim() || undefined };
      });
  },
  toAttribute(v: ChartSeries[] | undefined): string | null {
    return v ? v.map((s) => (s.label ? `${s.key}:${s.label}` : s.key)).join(',') : null;
  },
};

const listConverter = {
  fromAttribute: (v: string | null) => (v ? v.split(',').map((s) => s.trim()) : undefined),
  toAttribute: (v: string[] | undefined) => (v ? v.join(',') : null),
};

const PAD = { top: 12, right: 14, bottom: 26, left: 10 };

/**
 * A line, area, bar or sparkline chart drawn into a recessed instrument well: etched gridlines,
 * inked lines that glow on dark skins, and raised bars that catch the scene light. The box keeps
 * its size whatever the data does (while loading, when empty, when data arrives), and every
 * change animates: lines and areas morph to new values, bars grow from the baseline, axis ticks
 * glide and cross-fade.
 *
 * Give it data in one of three ways:
 * - `data` (property): an array of objects, e.g. `[{ month: 'Jan', income: 4200, spend: 3100 }]`,
 *   with `x="month"` naming the label key and `series` naming the value keys (default: every
 *   numeric key).
 * - a slotted `<table>`: the first column is the x label, each further column a series named by
 *   its header. The table also stays available to screen readers. Plain HTML, no script.
 * - `values="3,5,2,8"` for a single series (handy for sparklines), with optional `labels`.
 *
 * Hover, or focus the chart and use the arrow keys, to read every series at one x; the readout is
 * announced. Two or more series get a legend. The chart is named by `label` plus a generated
 * summary, and a data table is always available to assistive technology.
 *
 * @summary Chart: line, area, bar (grouped or stacked) or sparkline, in a recessed well.
 * @tag tr-chart
 * @role img
 *
 * @slot - A `<table>` with the data (first column = x labels, header row = series names).
 * @slot empty - What to show when there is no data. Default "No data".
 *
 * @csspart legend - The legend row above the plot.
 * @csspart plot - The recessed well that holds the plot.
 * @csspart readout - The hover/keyboard value readout.
 *
 * @cssprop --tr-chart-height - Height of the whole chart (legend included). Default 16em; sparkline 1.75em.
 * @cssprop --tr-chart-width - Width of a sparkline. Default 6em (other types fill their container).
 * @cssprop --tr-chart-color-1 - Colour of the first series (default the accent). Also -2 … -8.
 * @cssprop --tr-chart-well - Background of the well. Default --tr-color-well.
 *
 * @example <tr-chart type="bar" label="Steps this week"><table><thead><tr><th>Day</th><th>Steps</th></tr></thead><tbody><tr><td>Mon</td><td>8200</td></tr><tr><td>Tue</td><td>10400</td></tr><tr><td>Wed</td><td>6900</td></tr></tbody></table></tr-chart>
 * @example <tr-chart id="money" type="line" label="Income and spending" x="month" series="income:Income,spend:Spending" currency="USD"></tr-chart>
 * @example <tr-chart type="area" label="Balance" currency="EUR" values="4200,5100,4800,6100" labels="Jan,Feb,Mar,Apr"></tr-chart>
 * @example <tr-chart type="bar" stacked label="Time by project" unit="h"></tr-chart>
 * @example <tr-chart type="sparkline" label="Heart rate" values="62,64,61,70,75,68,66"></tr-chart>
 */
export class TrChart extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        /* categorical palette: the accent first, then validated reference hues (light / dark steps) */
        --_p0: var(--tr-color-accent);
        ${unsafeCSS(PALETTE.map(([, c], i) => `--_p${i + 1}: ${c};`).join('\n'))}
        display: block;
        position: relative;
        height: var(--tr-chart-height, 16em);
        min-width: 0;
        contain: layout;
        font-variant-numeric: tabular-nums;
      }
      :host([type='sparkline']) {
        display: inline-block;
        vertical-align: middle;
        width: var(--tr-chart-width, 6em);
        height: var(--tr-chart-height, 1.75em);
      }
      .frame {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        height: 100%;
        min-width: 0;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25em 1.1em;
        margin: 0;
        padding: 0 0.15em;
        list-style: none;
        font-size: 0.8125em;
        line-height: 1.4;
        color: var(--tr-color-ink-muted);
      }
      .legend li {
        display: inline-flex;
        align-items: center;
        gap: 0.45em;
        min-width: 0;
      }
      .key {
        flex: none;
        width: 0.75em;
        height: 0.75em;
        border-radius: 3px;
        background: var(--_c);
        box-shadow: inset 0 1px 0 color-mix(in oklab, white 30%, transparent);
      }
      .key.line {
        height: 2px;
        width: 1em;
        border-radius: 1px;
        box-shadow: none;
      }
      .well {
        --_tr-z: -1;
        --_base: var(--tr-chart-well, var(--tr-color-well));
        --_ink: var(--tr-color-ink);
        --_reflect: 0.3;
        --_gloss: 0;
        --_mirror: 0;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        border-radius: var(--tr-radius-md, 10px);
        overflow: hidden;
        outline-offset: 3px;
        transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;
      }
      :host([type='sparkline']) .well {
        border: 0;
        background: none;
        box-shadow: none;
        border-radius: 0;
        overflow: visible;
      }
      :host([loading]) .well {
        opacity: 0.55;
      }
      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        font-family: inherit;
        pointer-events: none;
      }
      text {
        fill: var(--tr-color-ink-muted);
        font-size: 11.5px;
        letter-spacing: 0.01em;
      }
      /* etched gridlines: a fine groove (dark) with its lit lower wall */
      .grid .groove {
        stroke: color-mix(in oklch, var(--tr-color-ink) calc(9% + var(--_r) * 5%), transparent);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
      .grid .lit {
        stroke: color-mix(in oklab, var(--tr-color-highlight, #fff) calc(var(--_r) * (55% - var(--tr-lift, 0) * 45%)), transparent);
        stroke-width: 1;
        translate: 0 calc(var(--_sy) * 1px);
        shape-rendering: crispEdges;
      }
      .grid .zero .groove {
        stroke: color-mix(in oklch, var(--tr-color-ink) 32%, transparent);
      }
      .tick {
        transition: none;
      }
      .ylabel {
        text-anchor: end;
        dominant-baseline: middle;
      }
      .xlabel {
        text-anchor: middle;
      }
      .line {
        fill: none;
        stroke: var(--_c);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1;
        /* printed ink on light skins (a faint cast shadow); a soft glow on dark ones */
        filter: drop-shadow(0 0 calc(var(--tr-lift, 0) * var(--_r) * 3.5px) color-mix(in oklch, var(--_c) calc(var(--tr-lift, 0) * 70%), transparent))
          drop-shadow(
            calc(var(--_sx) * 0.75px) calc(var(--_sy) * 1.25px) calc(var(--_r) * 1.2px)
              color-mix(in oklch, var(--tr-color-shadow, #000) calc((1 - var(--tr-lift, 0)) * var(--_r) * 28%), transparent)
          );
      }
      :host([type='sparkline']) .line {
        stroke-width: 1.5;
        filter: none;
      }
      .area {
        fill: var(--_c);
        fill-opacity: 0.13;
        stroke: none;
      }
      :host([stacked]) .area {
        fill-opacity: 0.32;
      }
      .bar {
        fill: url(#tr-chart-sheen-0);
        filter: drop-shadow(
          calc(var(--_sx) * var(--_r) * 1.4px) calc(var(--_sy) * var(--_r) * 1.6px) calc(var(--_r) * 1.6px)
            color-mix(in oklch, var(--tr-color-shadow, #000) calc(var(--_r) * 34%), transparent)
        );
      }
      stop.a {
        stop-color: color-mix(in oklab, var(--_c), white calc(var(--_r) * 24%));
      }
      stop.b {
        stop-color: var(--_c);
      }
      stop.c {
        stop-color: color-mix(in oklab, var(--_c), black calc(var(--_r) * 20%));
      }
      .dot {
        fill: var(--_c);
        stroke: var(--tr-chart-well, var(--tr-color-well));
        stroke-width: 2;
      }
      /* hover / keyboard layer */
      .hover {
        opacity: 0;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          transform var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-settle, ease-out);
      }
      .hover.on {
        opacity: 1;
      }
      .snap .hover,
      .snap .readout {
        transition-property: opacity;
      }
      .cross {
        stroke: color-mix(in oklch, var(--tr-color-ink) 45%, transparent);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
      .band {
        fill: color-mix(in oklch, var(--tr-color-ink) 7%, transparent);
      }
      .readout {
        --_tr-z: 3;
        --_base: var(--tr-color-surface);
        --_ink: var(--tr-color-ink);
        --_gloss: 0;
        --_mirror: 0;
        position: absolute;
        left: 0;
        top: 0;
        z-index: 2;
        min-width: 7em;
        max-width: min(16em, 70%);
        padding: 0.45em 0.65em 0.5em;
        border-radius: var(--tr-radius-sm, 6px);
        font-size: 0.8125em;
        line-height: 1.35;
        pointer-events: none;
        opacity: 0;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          transform var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-settle, ease-out);
      }
      .readout.on {
        opacity: 1;
      }
      .readout .x {
        color: var(--tr-color-ink-muted);
        margin-bottom: 0.15em;
      }
      .readout .row {
        display: flex;
        align-items: center;
        gap: 0.45em;
        white-space: nowrap;
      }
      .readout .row b {
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .readout .row span {
        color: var(--tr-color-ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .readout .key {
        width: 0.9em;
        height: 2px;
        border-radius: 1px;
        box-shadow: none;
      }
      .empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--tr-color-ink-muted);
        font-size: 0.875em;
        opacity: 0;
        transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;
        pointer-events: none;
      }
      .empty.on {
        opacity: 1;
      }
      .sr {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
        margin: -1px !important;
        padding: 0 !important;
        border: 0 !important;
      }
      :host(:focus-visible) {
        outline: none;
      }
      .well:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      @media (forced-colors: active) {
        .line,
        .dot {
          stroke: CanvasText;
        }
        .bar,
        .area,
        .key {
          fill: CanvasText;
          background: CanvasText;
        }
        .well {
          border: 1px solid CanvasText;
        }
      }
    `,
  ];

  /** Chart type. `sparkline` is a small inline line with no axes, for table cells and stat tiles. */
  @property({ reflect: true }) type: ChartType = 'line';

  /** What the chart shows: its accessible name, e.g. "Monthly spending". */
  @property({ reflect: true }) label = '';

  /** Rows of data, e.g. `[{ month: 'Jan', income: 4200 }]`. Set as a property (JS, or bound in a framework). */
  @property({ attribute: false }) data: ChartRow[] = [];

  /** Key of the x label in each row of `data`. Default: `x`, else the first text key. */
  @property({ reflect: true }) x = '';

  /**
   * Which keys to plot, in order. As an attribute: `series="income:Income,spend:Spending"`
   * (key, optional label). As a property: `[{ key: 'income', label: 'Income', color: '#2a78d6' }]`
   * or plain keys. Default: every numeric key.
   */
  @property({ converter: seriesConverter }) series?: Array<ChartSeries | string> | string;

  /** A single series as numbers, e.g. `values="3,5,2,8"`. */
  @property({ converter: listConverter }) values?: Array<string | number> | string;

  /** X labels for `values`, e.g. `labels="Mon,Tue,Wed,Thu"`. */
  @property({ converter: listConverter }) labels?: string[] | string;

  /** Stack the series (bars and areas) instead of grouping or overlapping them. */
  @property({ type: Boolean, reflect: true }) stacked = false;

  /** Format values as money in this ISO currency, e.g. `currency="EUR"`. */
  @property({ reflect: true }) currency = '';

  /** Unit written after values, e.g. `unit="kg"` or `unit="%"`. */
  @property({ reflect: true }) unit = '';

  /** Fixed number of decimals for values. Default: as needed, up to 2. */
  @property({ type: Number, reflect: true }) decimals?: number;

  /** Lowest value on the y axis. Default: 0 for bars and areas, a rounded minimum for lines. */
  @property({ type: Number, reflect: true }) min?: number;

  /** Highest value on the y axis. Default: a rounded maximum. */
  @property({ type: Number, reflect: true }) max?: number;

  /** Legend: `auto` shows it for two or more series. */
  @property({ reflect: true }) legend: 'auto' | 'none' = 'auto';

  /** Data is being fetched: the last chart stays, dimmed, in the same box. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Custom value formatter (property only). Overrides `currency`, `unit` and `decimals`. */
  @property({ attribute: false }) format?: (value: number) => string;

  @state() private size = { w: 0, h: 0 };
  @state() private active: number | null = null;
  @state() private tableModel: Model | null = null;

  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private geom = new Map<string, { d?: string; t?: string; n?: string }>();
  private drawn = false;
  private resized = false;
  private keyed = false;
  private announce = '';
  private palette: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  private lightX = -0.5;
  private layout: { px0: number; px1: number; n: number; band: number } = {
    px0: 0,
    px1: 0,
    n: 0,
    band: 0,
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.mo = new MutationObserver(() => this.readTable());
    this.mo.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.readTable();
    document.fonts?.ready.then(() => this.relayout());
    document.fonts?.addEventListener('loadingdone', this.relayout);
  }

  /** Text widths changed (a web font loaded): lay out again without animating. */
  private relayout = (): void => {
    if (!this.hasUpdated) return;
    this.resized = this.drawn;
    this.requestUpdate();
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.mo?.disconnect();
    document.fonts?.removeEventListener('loadingdone', this.relayout);
  }

  protected override firstUpdated(): void {
    const well = this.renderRoot.querySelector('.well') as HTMLElement;
    this.ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      // hidden (display: none, a closed tab): keep the last drawing instead of erasing it
      if (!w || !h) return;
      if (w !== this.size.w || h !== this.size.h) {
        this.resized = this.size.w > 0;
        this.size = { w, h };
      }
    });
    this.ro.observe(well);
  }

  /** Reads the slotted table into a model (first column = x, header = series names). */
  private readTable(): void {
    const table = this.querySelector(':scope > table');
    if (!table) {
      this.tableModel = null;
      return;
    }
    const head = [...table.querySelectorAll('thead tr:last-child > *')].map((c) => c.textContent?.trim() ?? '');
    const rows = [...table.querySelectorAll('tbody tr')];
    const xs: string[] = [];
    const cols: number[][] = [];
    for (const tr of rows) {
      const cells = [...tr.children];
      if (!cells.length) continue;
      xs.push(cells[0].textContent?.trim() ?? '');
      cells.slice(1).forEach((c, i) => {
        (cols[i] ??= []).push(parseNumber(c.textContent ?? ''));
      });
    }
    const n = Math.max(cols.length, head.length - 1);
    const series = Array.from({ length: n }, (_, i) => ({
      key: `c${i}`,
      label: head[i + 1] || `Series ${i + 1}`,
    }));
    if (!this.label) {
      const cap = table.querySelector('caption')?.textContent?.trim();
      if (cap) this.label = cap;
    }
    this.tableModel = {
      xs,
      series,
      values: series.map((_, i) => xs.map((_, j) => cols[i]?.[j] ?? Number.NaN)),
    };
  }

  /** Normalises whichever data source is set. */
  private model(): Model {
    if (this.data?.length) {
      const first = this.data[0];
      const keys = Object.keys(first);
      const xKey = this.x || (keys.includes('x') ? 'x' : (keys.find((k) => typeof first[k] === 'string' || first[k] instanceof Date) ?? ''));
      const wanted = (this.seriesList?.length ? this.seriesList : keys.filter((k) => k !== xKey && typeof first[k] === 'number')).map((s) =>
        typeof s === 'string' ? { key: s } : s,
      );
      const xs = this.data.map((row, i) => {
        const v = xKey ? row[xKey] : undefined;
        if (v instanceof Date)
          return v.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
        return v == null ? String(i + 1) : String(v);
      });
      return {
        xs,
        series: wanted.map((s) => ({
          key: s.key,
          label: s.label ?? s.key,
          color: s.color,
        })),
        values: wanted.map((s) => this.data.map((row) => (typeof row[s.key] === 'number' ? (row[s.key] as number) : parseNumber(String(row[s.key] ?? ''))))),
      };
    }
    if (this.valuesList?.length) {
      const nums = this.valuesList.map((v) => (typeof v === 'number' ? v : parseNumber(v)));
      const xs = nums.map((_, i) => this.labelsList?.[i] ?? String(i + 1));
      const s = (this.seriesList?.[0] as ChartSeries | undefined) ?? {
        key: 'value',
      };
      return {
        xs,
        series: [
          {
            key: typeof s === 'string' ? s : s.key,
            label: (typeof s === 'string' ? s : s.label) || this.label || 'Value',
            color: typeof s === 'string' ? undefined : s.color,
          },
        ],
        values: [nums],
      };
    }
    if (this.tableModel) {
      const m = this.tableModel;
      // `series` on a table chart can rename or recolour columns, in order
      if (this.seriesList?.length) {
        m.series = m.series.map((s, i) => {
          const o = this.seriesList![i];
          return o
            ? {
                ...s,
                ...(typeof o === 'string' ? { label: o } : { label: o.label ?? s.label, color: o.color }),
              }
            : s;
        });
      }
      return m;
    }
    return { xs: [], series: [], values: [] };
  }

  /** Value format. `step` (axis ticks) sets the decimals to what the step needs. */
  private fmt(compact = false, step?: number): (v: number) => string {
    if (this.format && !compact) return this.format;
    let decimals = this.decimals;
    if (decimals == null && step != null) decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
    else if (decimals == null && this.currency) decimals = this.wholeValues ? 0 : 2;
    return formatter({
      currency: this.currency || undefined,
      unit: this.unit || undefined,
      decimals,
      compact,
    });
  }

  /** True when every value is a whole number (money then prints without cents). */
  private wholeValues = true;

  /** Accent first, then the reference hues; the reference hue nearest the accent steps aside. */
  private readTheme(): void {
    const cs = getComputedStyle(this);
    const accent = cs.getPropertyValue('--tr-color-accent');
    const m = /oklch\(\s*[\d.]+%?\s+([\d.]+)\s+([\d.]+)/.exec(accent);
    const order = PALETTE.map((_, i) => i + 1);
    if (m && Number(m[1]) >= 0.05) {
      const hue = Number(m[2]);
      // every reference hue close to the accent steps aside, so no two series look alike
      this.palette = [0, ...order.filter((i) => hueGap(PALETTE[i - 1][0], hue) >= 28)];
    } else {
      // a neutral accent cannot carry a series: start with the reference blue
      this.palette = order;
    }
    const angle = parseFloat(cs.getPropertyValue('--tr-light-angle')) || 330;
    const rad = (angle * Math.PI) / 180;
    this.lightX = Math.sin(rad);
  }

  private colorOf(i: number, own?: string): string {
    if (own) return own;
    const slot = this.palette[i % this.palette.length];
    return `var(--tr-chart-color-${i + 1}, var(--_p${slot}))`;
  }

  // The attribute syntax also works as a property value: chart.series = 'income:Income,spend:Spending'.
  private get seriesList(): Array<ChartSeries | string> | undefined {
    return typeof this.series === 'string' ? seriesConverter.fromAttribute(this.series) : this.series;
  }
  private get valuesList(): Array<string | number> | undefined {
    return typeof this.values === 'string' ? listConverter.fromAttribute(this.values) : this.values;
  }
  private get labelsList(): string[] | undefined {
    return typeof this.labels === 'string' ? listConverter.fromAttribute(this.labels) : this.labels;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.readTheme();
  }

  protected override update(changed: PropertyValues): void {
    // remember which marks are on screen, so marks that leave can fade out instead of vanishing
    const before = new Map<string, { node: Element; parent: Element }>();
    if (this.hasUpdated) {
      for (const el of this.renderRoot.querySelectorAll('[data-k]'))
        before.set(el.getAttribute('data-k')!, {
          node: el,
          parent: el.parentElement!,
        });
    }
    super.update(changed);
    const animate = this.drawn && !this.resized && !reducedMotion(this);
    for (const { node, parent } of before.values()) {
      if (node.isConnected) continue;
      const ghosts = parent.nextElementSibling;
      if (!animate || !ghosts?.classList.contains('ghosts')) continue;
      // a mark that left fades out where it was
      node.removeAttribute('data-k');
      ghosts.append(node);
      const a = node.animate({ opacity: [1, 0] }, { duration: 200, easing: 'ease-out', fill: 'forwards' });
      a.finished.then(
        () => node.remove(),
        () => node.remove(),
      );
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.tween();
    if (this.size.w > 0 && this.hasData()) this.drawn = true;
    this.resized = false;
    if (changed.has('active')) {
      const ro = this.renderRoot.querySelector('.readout') as HTMLElement | null;
      if (ro && this.active != null) this.placeReadout(ro);
    }
  }

  private hasData(): boolean {
    const m = this.model();
    return m.xs.length > 0 && m.series.length > 0;
  }

  /** Animates every keyed mark from where it was to where it is now. */
  private tween(): void {
    const root = this.renderRoot as ShadowRoot;
    const next = new Map<string, { d?: string; t?: string; n?: string }>();
    const animate = !this.resized && !reducedMotion(this);
    const firstDraw = !this.drawn;
    const ease = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
    const dur = 420;
    for (const el of root.querySelectorAll<SVGElement>('[data-k]')) {
      const k = el.getAttribute('data-k')!;
      const d = el.getAttribute('d') ?? undefined;
      const t = el.style.transform || undefined;
      const n = el.getAttribute('data-n') ?? undefined;
      next.set(k, { d, t, n });
      if (!animate) continue;
      const p = this.geom.get(k);
      if (p) {
        if (d && p.d && p.d !== d) {
          if (p.n === n) {
            el.animate(
              {
                d: [`path("${p.d}")`, `path("${d}")`],
              } as PropertyIndexedKeyframes,
              { duration: dur, easing: ease },
            );
          } else {
            el.animate({ opacity: [0, 1] }, { duration: dur, easing: 'ease-out' });
          }
        }
        if (t && p.t && p.t !== t) el.animate({ transform: [p.t, t] }, { duration: dur, easing: ease });
        continue;
      }
      // entering
      const d0 = el.getAttribute('data-d0');
      const delay = firstDraw ? Number(el.getAttribute('data-delay') ?? 0) : 0;
      if (d0 && d) {
        el.animate({ d: [`path("${d0}")`, `path("${d}")`] } as PropertyIndexedKeyframes, {
          duration: firstDraw ? 640 : dur,
          delay,
          easing: ease,
          fill: 'backwards',
        });
      } else if (el.classList.contains('line') && firstDraw) {
        el.animate(
          { strokeDashoffset: [1, 0] },
          {
            duration: 760,
            delay,
            easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
            fill: 'backwards',
          },
        );
      } else {
        el.animate(
          { opacity: [0, 1] },
          {
            duration: firstDraw ? 420 : 240,
            delay: firstDraw ? delay + 200 : 0,
            easing: 'ease-out',
            fill: 'backwards',
          },
        );
      }
    }
    this.geom = next;
  }

  private placeReadout(ro: HTMLElement): void {
    const { px0, px1, n, band } = this.layout;
    if (!n || this.active == null) return;
    const cx = this.type === 'bar' ? px0 + band * (this.active + 0.5) : n === 1 ? (px0 + px1) / 2 : px0 + ((px1 - px0) * this.active) / (n - 1);
    const w = ro.offsetWidth;
    const room = this.size.w;
    let left = cx + 14;
    if (left + w > room - 6) left = cx - 14 - w;
    left = Math.max(6, Math.min(left, room - w - 6));
    ro.style.transform = `translate(${Math.round(left)}px, 8px)`;
  }

  private pointAt(clientX: number): number | null {
    const well = this.renderRoot.querySelector('.well') as HTMLElement;
    const r = well.getBoundingClientRect();
    const x = clientX - r.left - well.clientLeft;
    const { px0, px1, n, band } = this.layout;
    if (!n) return null;
    if (this.type === 'bar') return Math.max(0, Math.min(n - 1, Math.floor((x - px0) / band)));
    if (n === 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((x - px0) / (px1 - px0)) * (n - 1))));
  }

  private onMove = (e: PointerEvent): void => {
    if (this.type === 'sparkline' || (e.pointerType === 'touch' && e.type === 'pointermove' && !e.isPrimary)) return;
    const i = this.pointAt(e.clientX);
    if (i !== this.active) this.setActive(i);
  };

  private onLeave = (): void => {
    if (this.keyed) return;
    this.setActive(null);
  };

  private setActive(i: number | null): void {
    const fresh = this.active == null && i != null;
    const frame = this.renderRoot.querySelector('.well');
    if (fresh) frame?.classList.add('snap');
    this.active = i;
    if (fresh) requestAnimationFrame(() => requestAnimationFrame(() => frame?.classList.remove('snap')));
  }

  private onKey = (e: KeyboardEvent): void => {
    const n = this.model().xs.length;
    if (!n || this.type === 'sparkline') return;
    let i = this.active ?? n - 1;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        i = this.active == null ? n - 1 : Math.min(n - 1, i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        i = this.active == null ? n - 1 : Math.max(0, i - 1);
        break;
      case 'Home':
        i = 0;
        break;
      case 'End':
        i = n - 1;
        break;
      case 'Escape':
        this.keyed = false;
        this.setActive(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.keyed = true;
    this.setActive(i);
    this.announce = this.describePoint(this.model(), i);
    const live = this.renderRoot.querySelector('.live');
    if (live) live.textContent = this.announce;
  };

  private onBlur = (): void => {
    this.keyed = false;
    this.setActive(null);
  };

  private describePoint(m: Model, i: number): string {
    const f = this.fmt();
    return `${m.xs[i]}: ${m.series.map((s, j) => `${s.label} ${Number.isFinite(m.values[j][i]) ? f(m.values[j][i]) : 'no value'}`).join(', ')}`;
  }

  /** "Line chart, 12 points from Jan to Dec. Income from $3,100 to $5,200." */
  private summary(m: Model): string {
    if (!m.xs.length) return this.loading ? 'Loading' : 'No data';
    const f = this.fmt();
    const kind =
      {
        line: 'Line chart',
        area: 'Area chart',
        bar: this.stacked ? 'Stacked bar chart' : 'Bar chart',
        sparkline: 'Trend',
      }[this.type] ?? 'Chart';
    const span = m.xs.length > 1 ? `${m.xs.length} points from ${m.xs[0]} to ${m.xs[m.xs.length - 1]}` : `1 point, ${m.xs[0]}`;
    const parts = m.series.map((s, j) => {
      const v = m.values[j].filter(Number.isFinite);
      if (!v.length) return `${s.label}: no values`;
      const last = m.values[j][m.values[j].length - 1];
      return `${s.label}: low ${f(Math.min(...v))}, high ${f(Math.max(...v))}${Number.isFinite(last) ? `, latest ${f(last)}` : ''}`;
    });
    return `${kind}, ${span}. ${parts.join('. ')}.`;
  }

  protected override render() {
    const m = this.model();
    this.wholeValues = m.values.every((v) => v.every((x) => !Number.isFinite(x) || Number.isInteger(x)));
    const has = m.xs.length > 0 && m.series.length > 0;
    const spark = this.type === 'sparkline';
    const showLegend = !spark && this.legend !== 'none' && m.series.length > 1;
    const name = [this.label, this.summary(m)].filter(Boolean).join('. ');
    return html`<div class="frame">
        ${
          showLegend
            ? html`<ul class="legend" part="legend" aria-hidden="true">
                ${m.series.map(
                  (s, i) => html`<li><span class="key ${this.type === 'line' ? 'line' : ''}" style="--_c:${this.colorOf(i, s.color)}"></span>${s.label}</li>`,
                )}
              </ul>`
            : nothing
        }
        <div
          class="well surface"
          part="plot"
          role="img"
          aria-roledescription="chart"
          aria-label=${name}
          aria-busy=${this.loading ? 'true' : 'false'}
          tabindex=${has && !spark ? '0' : nothing}
          @pointermove=${this.onMove}
          @pointerdown=${this.onMove}
          @pointerleave=${this.onLeave}
          @keydown=${this.onKey}
          @blur=${this.onBlur}
        >
          ${this.size.w > 0 ? this.plot(m) : nothing} ${has && !spark ? this.readout(m) : nothing}
          <div class="empty ${has || spark ? '' : 'on'}" aria-hidden="true">
            <slot name="empty">${this.loading ? 'Loading…' : 'No data'}</slot>
          </div>
        </div>
      </div>
      <div class="sr live" role="status" aria-live="polite"></div>
      <div class="sr"><slot @slotchange=${() => this.readTable()}></slot></div>
      ${has && !this.tableModel ? this.srTable(m) : nothing}`;
  }

  private srTable(m: Model) {
    const f = this.fmt();
    return html`<table class="sr">
      ${
        this.label
          ? html`<caption>
              ${this.label}
            </caption>`
          : nothing
      }
      <thead>
        <tr>
          <th scope="col">${this.x || 'Label'}</th>
          ${m.series.map((s) => html`<th scope="col">${s.label}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${m.xs.map(
          (x, i) =>
            html`<tr>
              <th scope="row">${x}</th>
              ${m.series.map((_, j) => html`<td>${Number.isFinite(m.values[j][i]) ? f(m.values[j][i]) : '–'}</td>`)}
            </tr>`,
        )}
      </tbody>
    </table>`;
  }

  private readout(m: Model) {
    const i = this.active;
    const on = i != null && i < m.xs.length;
    const f = this.fmt();
    return html`<div class="readout surface ${on ? 'on' : ''}" part="readout" aria-hidden="true">
      ${
        on
          ? html`<div class="x">${m.xs[i!]}</div>
              ${m.series.map(
                (s, j) =>
                  html`<div class="row">
                    <span class="key line" style="--_c:${this.colorOf(j, s.color)}"></span
                    ><b>${Number.isFinite(m.values[j][i!]) ? f(m.values[j][i!]) : '–'}</b>${m.series.length > 1 ? html`<span>${s.label}</span>` : nothing}
                  </div>`,
              )}`
          : nothing
      }
    </div>`;
  }

  /** Lays out and draws the plot into an SVG the size of the well. */
  private plot(m: Model): TemplateResult {
    const { w, h } = this.size;
    const spark = this.type === 'sparkline';
    const n = m.xs.length;
    const has = n > 0 && m.series.length > 0;
    const bar = this.type === 'bar';
    const stack = this.stacked && (bar || this.type === 'area');

    // ---- value range ----
    let lo = Infinity;
    let hi = -Infinity;
    if (stack) {
      for (let i = 0; i < n; i++) {
        let pos = 0;
        let neg = 0;
        for (const v of m.values) {
          const x = v[i];
          if (!Number.isFinite(x)) continue;
          if (x >= 0) pos += x;
          else neg += x;
        }
        hi = Math.max(hi, pos);
        lo = Math.min(lo, neg);
      }
    } else {
      for (const v of m.values) for (const x of v) if (Number.isFinite(x)) ((lo = Math.min(lo, x)), (hi = Math.max(hi, x)));
    }
    if (!Number.isFinite(lo)) ((lo = 0), (hi = 1));
    const zeroBased = bar || this.type === 'area' || (lo >= 0 && lo <= hi * 0.35);
    if (zeroBased && !spark) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    if (this.min != null) lo = this.min;
    if (this.max != null) hi = this.max;

    // ---- frame ----
    const tickCount = Math.max(2, Math.min(6, Math.floor(h / 46)));
    let y0: number, y1: number, yt: Tick[];
    if (spark) {
      const pad = (hi - lo || 1) * 0.12;
      y0 = this.min ?? lo - pad;
      y1 = this.max ?? hi + pad;
      yt = [];
    } else {
      const dom = niceDomain(lo, hi, tickCount);
      y0 = this.min ?? dom.min;
      y1 = this.max ?? dom.max;
      const compact = Math.max(Math.abs(y0), Math.abs(y1)) >= 10000;
      yt = has ? ticks(y0, y1, dom.step, this.fmt(compact, dom.step)) : [0, 1, 2, 3].map((i) => ({ value: i / 3, label: '' }));
      if (!has) ((y0 = 0), (y1 = 1));
    }
    const ctx = spark ? null : this.measure();
    const yw = spark ? 0 : Math.ceil(Math.max(0, ...yt.map((t) => ctx!(t.label))));
    const px0 = spark ? 2 : PAD.left + yw + (yw ? 8 : 0);
    const px1 = spark ? w - (this.type === 'sparkline' ? 4 : 2) : w - PAD.right;
    const py0 = spark ? 3 : PAD.top;
    const py1 = spark ? h - 3 : h - PAD.bottom;
    const Y = (v: number) => py1 - ((v - y0) / (y1 - y0 || 1)) * (py1 - py0);
    const band = (px1 - px0) / Math.max(1, n);
    const X = (i: number) => (bar ? px0 + band * (i + 0.5) : n === 1 ? (px0 + px1) / 2 : px0 + ((px1 - px0) * i) / (n - 1));
    this.layout = { px0, px1, n, band };
    const base = Y(Math.max(y0, Math.min(0, y1)));

    // ---- sheen gradient direction (light side lighter) ----
    // across the bar from the lit side, like a rounded extrusion
    const gx1 = this.lightX <= 0 ? 0 : 1;

    // ---- axes ----
    // gridlines are unit lines placed and stretched by a transform, so a change of the label
    // gutter or the scale glides (the transform animates) instead of jumping
    const W = Math.max(1, px1 - px0);
    const grid = spark
      ? nothing
      : repeat(
          yt,
          (t) => `y:${t.value}`,
          (
            t,
          ) => svg`<g class="tick ${t.value === 0 && has ? 'zero' : ''}" data-k=${`y:${t.value}`} style=${`transform: translate(${px0}px, ${Math.round(Y(t.value)) + 0.5}px) scale(${W}, 1)`}>
            <line class="groove" x1="0" x2="1" y1="0" y2="0" vector-effect="non-scaling-stroke"></line>
            <line class="lit" x1="0" x2="1" y1="0" y2="0" vector-effect="non-scaling-stroke"></line>
          </g>`,
        );
    const ylabels = spark
      ? nothing
      : repeat(
          yt.filter((t) => t.label),
          (t) => `yl:${t.value}`,
          (t) =>
            svg`<text class="ylabel" data-k=${`yl:${t.value}`} style=${`transform: translate(${px0 - 8}px, ${Math.round(Y(t.value)) + 0.5}px)`}>${t.label}</text>`,
        );
    const longest = spark || !has ? 0 : Math.max(...m.xs.map((x) => ctx!(x)));
    const step = labelStep(n, px1 - px0, longest);
    // every step-th label; the last one too when it has room after the previous label
    const lastShown = Math.floor((n - 1) / step) * step;
    const endFits = step > 1 && lastShown !== n - 1 && X(n - 1) - X(lastShown) >= longest + 14;
    const xItems = spark || !has ? [] : m.xs.map((x, i) => ({ x, i })).filter(({ i }) => i % step === 0 || (endFits && i === n - 1));
    const xlabels = repeat(
      xItems,
      (o) => `x:${o.x}:${o.i}`,
      (o) => {
        const anchor = !bar && o.i === 0 ? 'start' : !bar && o.i === n - 1 && n > 1 ? 'end' : 'middle';
        return svg`<text class="xlabel" data-k=${`x:${o.x}:${o.i}`} style=${`transform: translate(${Math.round(X(o.i))}px, 0px); text-anchor: ${anchor}`} y=${h - 8}>${o.x}</text>`;
      },
    );

    // ---- marks ----
    let marks: unknown = nothing;
    const pts = (j: number) => m.values[j].map((v, i) => [X(i), Number.isFinite(v) ? Y(v) : base] as [number, number]);
    if (has && bar) {
      const k = m.series.length;
      const gap = 2;
      const bw = stack ? Math.min(24, band * 0.62) : Math.max(2, Math.min(24, (band * 0.72 - gap * (k - 1)) / k));
      const items: Array<{
        key: string;
        d: string;
        d0: string;
        c: string;
        delay: number;
      }> = [];
      for (let i = 0; i < n; i++) {
        let pos = 0;
        let neg = 0;
        // index of the last non-zero segment on each side, which gets the rounded end
        let topPos = -1;
        let topNeg = -1;
        m.values.forEach((v, j) => {
          if (v[i] > 0) topPos = j;
          if (v[i] < 0) topNeg = j;
        });
        m.series.forEach((s, j) => {
          const v = Number.isFinite(m.values[j][i]) ? m.values[j][i] : 0;
          let x: number, yA: number, yB: number, r: number;
          if (stack) {
            x = X(i) - bw / 2;
            const from = v >= 0 ? pos : neg;
            const to = from + v;
            if (v >= 0) pos = to;
            else neg = to;
            yA = Y(from);
            yB = Y(to);
            const outer = v >= 0 ? j === topPos : j === topNeg;
            r = outer ? 4 : 0;
            // the 2px surface gap between stacked segments
            if (from !== 0 && Math.abs(yA - yB) > gap) yA += v >= 0 ? -gap : gap;
          } else {
            x = X(i) - (k * bw + (k - 1) * gap) / 2 + j * (bw + gap);
            yA = base;
            yB = Y(v);
            r = 4;
          }
          items.push({
            key: `b:${s.key}:${m.xs[i]}:${i}`,
            d: barPath(x, bw, yA, yB, r),
            d0: barPath(x, bw, stack ? Y(0) : base, stack ? Y(0) : base, r),
            c: this.colorOf(j, s.color),
            delay: i * 28 + j * 40,
          });
        });
      }
      marks = svg`<g class="layer"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${repeat(
        items,
        (b) => b.key,
        (b) =>
          svg`<path class="bar" data-k=${b.key} data-n="bar" data-d0=${b.d0} data-delay=${b.delay} d=${b.d} style=${`--_c:${b.c};fill:url(#tr-sheen-${b.c.length}-${this.sheenId(b.c)})`}></path>`,
      )}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>`;
    } else if (has) {
      const area = this.type === 'area' || spark;
      const lines: Array<{ key: string; d: string; c: string; delay: number }> = [];
      const areas: Array<{
        key: string;
        d: string;
        d0: string;
        c: string;
        delay: number;
      }> = [];
      const dots: Array<{ key: string; t: string; c: string; delay: number }> = [];
      const acc = new Array(n).fill(0);
      m.series.forEach((s, j) => {
        const c = this.colorOf(j, s.color);
        let top = pts(j);
        let bottom = top.map(([x]) => [x, base] as [number, number]);
        if (stack) {
          bottom = acc.map((a, i) => [X(i), Y(a)] as [number, number]);
          m.values[j].forEach((v, i) => (acc[i] += Number.isFinite(v) ? v : 0));
          top = acc.map((a, i) => [X(i), Y(a)] as [number, number]);
        }
        const ln = linePath(top);
        lines.push({ key: `l:${s.key}`, d: ln, c, delay: j * 120 });
        if (area)
          areas.push({
            key: `a:${s.key}:${n}`,
            d: areaPath(top, bottom),
            d0: areaPath(bottom, bottom),
            c,
            delay: j * 120,
          });
        const last = top[n - 1];
        if (last && (!spark || j === 0))
          dots.push({
            key: `e:${s.key}`,
            t: `translate(${last[0].toFixed(2)}px, ${last[1].toFixed(2)}px)`,
            c,
            delay: 560 + j * 120,
          });
      });
      marks = svg`<g class="layer"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${repeat(
        areas,
        (a) => a.key,
        (a) => svg`<path class="area" data-k=${a.key} data-n=${String(n)} data-d0=${a.d0} data-delay=${a.delay} d=${a.d} style=${`--_c:${a.c}`}></path>`,
      )}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>
        <g class="layer"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${repeat(
          lines,
          (l) => l.key,
          (l) => svg`<path class="line" pathLength="1" data-k=${l.key} data-n=${String(n)} data-delay=${l.delay} d=${l.d} style=${`--_c:${l.c}`}></path>`,
        )}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>
        <g class="layer"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${repeat(
          dots,
          (d) => d.key,
          (d) =>
            svg`<circle class="dot" r=${spark ? 2.5 : 4} cx="0" cy="0" data-k=${d.key} data-delay=${d.delay} style=${`--_c:${d.c};transform:${d.t}`}></circle>`,
        )}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>`;
    }

    // ---- hover layer ----
    let hover: unknown = nothing;
    if (has && !spark) {
      const i = this.active;
      const on = i != null && i < n;
      const cx = on ? X(i!) : X(n - 1);
      if (bar) {
        hover = svg`<rect class="hover band ${on ? 'on' : ''}" x=${-band / 2 + 1} y=${py0} width=${Math.max(0, band - 2)} height=${py1 - py0} rx="4" style=${`transform: translate(${cx.toFixed(2)}px, 0px)`}></rect>`;
      } else {
        const stackAt = (j: number) => {
          if (!stack) return Number.isFinite(m.values[j][i ?? n - 1]) ? Y(m.values[j][i ?? n - 1]) : NaN;
          let a = 0;
          for (let q = 0; q <= j; q++) a += Number.isFinite(m.values[q][i ?? n - 1]) ? m.values[q][i ?? n - 1] : 0;
          return Y(a);
        };
        hover = svg`<g class="hover ${on ? 'on' : ''}" style=${`transform: translate(${cx.toFixed(2)}px, 0px)`}>
          <line class="cross" x1="0.5" x2="0.5" y1=${py0} y2=${py1}></line>
          ${m.series.map((s, j) => {
            const cy = stackAt(j);
            return Number.isFinite(cy)
              ? svg`<circle class="dot" r="4" cx="0" cy=${cy.toFixed(2)} style=${`--_c:${this.colorOf(j, s.color)}`}></circle>`
              : nothing;
          })}
        </g>`;
      }
    }

    const colors = bar && has ? [...new Set(m.series.map((s, j) => this.colorOf(j, s.color)))] : [];
    return svg`<svg viewBox=${`0 0 ${w} ${h}`} width=${w} height=${h} aria-hidden="true" focusable="false">
      <defs>${colors.map(
        (c) => svg`<linearGradient id=${`tr-sheen-${c.length}-${this.sheenId(c)}`} x1=${gx1} y1="0" x2=${1 - gx1} y2="0" style=${`--_c:${c}`}>
          <stop class="a" offset="0"></stop><stop class="b" offset="0.42"></stop><stop class="c" offset="1"></stop>
        </linearGradient>`,
      )}</defs>
      <g class="grid"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${grid}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>
      <g class="ylabels"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${ylabels}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>
      ${bar ? hover : nothing}
      ${marks}
      ${bar ? nothing : hover}
      <g class="xaxis"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect>${xlabels}</g><g class="ghosts"><rect class="bounds" width="100%" height="100%" fill="none" stroke="none"></rect></g>
    </svg>`;
  }

  /** A short stable id for a colour expression (gradient ids must be unique per colour). */
  private sheenId(c: string): string {
    let h = 0;
    for (const ch of c) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
    return h.toString(36);
  }

  private measureCtx?: CanvasRenderingContext2D | null;
  /** Text width in px at the axis label size. */
  private measure(): (t: string) => number {
    this.measureCtx ??= document.createElement('canvas').getContext('2d');
    const ctx = this.measureCtx;
    const family = getComputedStyle(this).fontFamily || 'system-ui';
    if (ctx) ctx.font = `11.5px ${family}`;
    return (t: string) => (ctx ? ctx.measureText(t).width : t.length * 6.5);
  }
}

define('tr-chart', TrChart);

declare global {
  interface HTMLElementTagNameMap {
    'tr-chart': TrChart;
  }
}
