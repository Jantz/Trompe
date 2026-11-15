import { css, html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { reducedMotion } from '../../interaction/motion.js';
import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';
import { TrStep, type StepState } from './step.js';

export { TrStep };
export type { StepState };

/** Milliseconds for the fill to run from one step to the next. */
const STRETCH_MS = 220;
/** Longest sweep, however many steps it crosses. */
const SWEEP_MS = 640;

/**
 * Step indicator for wizards, checkouts and onboarding: numbered `tr-step`s joined by a recessed
 * track. Steps before the current one are complete (a lit accent plate with a check cut into it),
 * the current one stands raised with an accent rim, later ones are printed on the floor of their
 * socket. When `current` moves, the accent fill runs along the track from step to step and each
 * marker lights as the fill reaches it; nothing changes size, so nothing around it moves.
 *
 * Set `current` (from 0) or `value` (a step's `value`). `current` equal to the number of steps
 * means every step is complete. Mark a step with `error` or `disabled` on the `tr-step`.
 *
 * With `clickable`, steps are buttons: picking one fires a cancelable `change` (call
 * `preventDefault()` to stay, for example while the current step is invalid), and otherwise moves
 * `current` there. Add `linear` to allow only steps already reached. Arrow keys move between
 * steps (one Tab stop), Enter or Space picks.
 *
 * In a container too narrow for every step (under `--tr-stepper-step-min` per step), it turns
 * into a compact "Step 2 of 5 · Clinician" with a slim progress tube, cross-fading and gliding to
 * its new height. Set `compact` to always use that form. `orientation="vertical"` stacks the
 * steps with labels beside the markers and never compacts.
 *
 * @summary Step indicator (role="list" of steps, aria-current="step"); clickable and compact on narrow screens.
 * @tag tr-stepper
 *
 * @slot - The `tr-step` elements.
 *
 * @csspart list - The row (or column) of steps.
 * @csspart compact - The compact form: status line and progress tube.
 * @csspart status - The "Step 2 of 5 · Label" text.
 * @csspart track - The compact form's progress tube.
 *
 * @cssprop --tr-stepper-marker-size - Diameter of a step's marker. Defaults to 2.25em.
 * @cssprop --tr-stepper-track-width - Thickness of the track between markers. Defaults to 0.32em.
 * @cssprop --tr-stepper-step-min - Narrowest a step may get before the stepper turns compact. Defaults to 6.5em.
 * @cssprop --tr-stepper-gap - Space between steps when vertical. Defaults to 1.75em.
 *
 * @fires change - The person picked a step (`clickable`). `detail.index`, `detail.value` and `detail.previous` (index). Cancelable: `preventDefault()` keeps the current step.
 *
 * @example <tr-stepper current="1" label="Booking"><tr-step>Service</tr-step><tr-step>Clinician</tr-step><tr-step>Date and time</tr-step><tr-step>Your details</tr-step><tr-step>Review</tr-step></tr-stepper>
 * @example <tr-stepper clickable linear value="ship"><tr-step value="cart">Cart</tr-step><tr-step value="ship">Shipping<span slot="description">Address and speed</span></tr-step><tr-step value="pay">Payment</tr-step></tr-stepper>
 * @example <tr-stepper orientation="vertical" current="2"><tr-step>Account</tr-step><tr-step>Profile</tr-step><tr-step error>Verify email</tr-step></tr-stepper>
 */
export class TrStepper extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_min: var(--tr-stepper-step-min, 6.5em);
        --_t: var(--tr-motion-duration-lift, 240ms);
        /* room above and below the steps for halos and shadows, inside the box that clips while its height glides
           (block axis only: sideways it would overflow the page) */
        --_bleed: 1em;
        display: flow-root;
        min-width: 0;
        max-width: 100%;
        font-size: var(--tr-font-size-md, 1em);
      }
      .box {
        position: relative;
        margin-block: calc(-1 * var(--_bleed));
      }
      .stack {
        position: relative;
        display: flow-root;
        padding-block: var(--_bleed);
      }
      .list {
        display: flex;
        align-items: flex-start;
        margin: 0;
        padding: 0;
        transition:
          opacity var(--_t) ease-out,
          visibility 0s,
          display 0s;
        transition-behavior: allow-discrete;
      }
      @starting-style {
        :host(:not([data-compact])) .list {
          opacity: 0;
        }
      }
      :host([orientation='vertical']) .list {
        flex-direction: column;
        align-items: stretch;
      }
      .compact {
        position: absolute;
        inset: var(--_bleed) 0 auto;
        display: grid;
        gap: 0.5em;
        opacity: 0;
        visibility: hidden;
        transition:
          opacity var(--_t) ease-out,
          visibility 0s var(--_t);
      }
      /* compact: the full row fades out of the flow, the status line fades in, the box glides */
      /* the row leaves layout once faded, so it never overhangs the shorter box (the box clips while it glides) */
      :host([data-compact]) .list {
        position: absolute;
        inset: var(--_bleed) 0 auto;
        opacity: 0;
        visibility: hidden;
        display: none;
        transition:
          opacity var(--_t) ease-out,
          visibility 0s var(--_t),
          display 0s var(--_t);
        transition-behavior: allow-discrete;
      }
      :host([data-compact]) .compact {
        position: relative;
        inset: auto;
        opacity: 1;
        visibility: visible;
        transition:
          opacity var(--_t) ease-out,
          visibility 0s;
      }
      :host([data-snap]) .list,
      :host([data-snap]) .compact {
        transition: none !important;
      }
      .status {
        display: block;
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }
      .status.error {
        color: var(--tr-color-danger);
      }
      .track {
        --_tr-z: -2;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_curve: -0.4;
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_tex: none;
        height: calc(var(--tr-stepper-track-width, 0.32em) + 4px);
        padding: 1px;
        box-sizing: border-box;
        border-radius: var(--tr-radius-pill, 999px);
        overflow: hidden;
      }
      .fill {
        --_tr-z: 0.5;
        --_base: var(--tr-color-accent);
        --_edge: transparent;
        --_curve: 0.7;
        --_gloss: 0.7;
        --_brush: 0;
        --_spin: 0;
        --_mirror: 0;
        --_tex: none;
        height: 100%;
        border: 0;
        border-radius: inherit;
        translate: calc((var(--_pv, 0) - 1) * 100%) 0;
        transition: translate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      .probe {
        position: absolute;
        visibility: hidden;
        width: var(--_min);
        height: 0;
        pointer-events: none;
      }
      @media (forced-colors: active) {
        .track {
          border: 1px solid CanvasText;
        }
        .fill {
          background: Highlight;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** The current step, from 0. The number of steps means all are complete. */
  @property({ type: Number, reflect: true }) current = 0;

  /** The current step's `value`. Setting it moves `current` to the step with that value. */
  @property() value = '';

  /** Lay the steps out in a row or a column (labels beside the markers). */
  @property({ reflect: true }) orientation: 'horizontal' | 'vertical' = 'horizontal';

  /** Steps are buttons: picking one fires `change` and moves there. */
  @property({ type: Boolean, reflect: true }) clickable = false;

  /** With `clickable`: only steps already reached can be picked. */
  @property({ type: Boolean, reflect: true }) linear = false;

  /** Always show the compact "Step 2 of 5" form. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Accessible name of the list of steps. */
  @property({ reflect: true }) label = 'Progress';

  @state() private narrow = false;
  @state() private steps: TrStep[] = [];

  private reached = 0;
  private focusIndex = -1;
  private ro: ResizeObserver | null = null;
  private shownStatus: string | null = null;
  private placed = false;
  private prevCurrent: number | null = null;

  protected readonly size = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.box'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.stack'),
  }));

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('tr-step-pick', this.onPick as EventListener);
    this.addEventListener('tr-step-change', this.onStepChange);
    this.addEventListener('keydown', this.onKey);
    this.addEventListener('focusin', this.onFocusIn);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.ro = null;
  }

  /** Moves to the next step (no event). */
  next(): void {
    this.current = Math.min(this.steps.length, this.current + 1);
  }

  /** Moves to the previous step (no event). */
  previous(): void {
    this.current = Math.max(0, this.current - 1);
  }

  private get count(): number {
    return this.steps.length;
  }

  protected override willUpdate(changed: PropertyValues): void {
    const n = this.count;
    // value wins when it was set (or the steps arrived) and names a step; otherwise it follows current
    if ((changed.has('value') || changed.has('steps')) && this.value) {
      const i = this.steps.findIndex((s) => s.value === this.value);
      if (i >= 0) this.current = i;
    }
    const c = Math.max(0, Math.min(n || Infinity, Math.round(Number(this.current) || 0)));
    if (c !== this.current) this.current = c;
    const v = this.steps[this.current]?.value;
    if (v && v !== this.value) this.value = v;
    if (this.current > this.reached) this.reached = this.current;
  }

  protected override render() {
    const n = this.count;
    const c = Math.min(this.current, n);
    const done = n > 0 && c >= n;
    const step = this.steps[c];
    const text = n === 0 ? '' : done ? `All ${n} steps complete` : `Step ${c + 1} of ${n}${step?.labelText ? ` · ${step.labelText}` : ''}`;
    const frac = n === 0 ? 0 : done ? 1 : (c + 1) / n;
    const compact = this.isCompact;
    return html`<div class="box">
      <div class="stack">
        <div part="list" class="list" role="list" aria-label=${this.label || 'Progress'} ?inert=${compact} aria-hidden=${compact ? 'true' : 'false'}>
          <slot @slotchange=${this.onSlot}></slot>
        </div>
        <div part="compact" class="compact" aria-hidden=${compact ? 'false' : 'true'} ?inert=${!compact}>
          <span part="status" class="status ${step?.error && !done ? 'error' : ''}" role="status">${text}</span>
          <div part="track" class="track surface" role="progressbar" aria-label=${this.label || 'Progress'} aria-valuemin="0" aria-valuemax=${n} aria-valuenow=${done ? n : c + 1}>
            <div class="fill surface" style="--_pv:${frac}"></div>
          </div>
        </div>
        <span class="probe" aria-hidden="true"></span>
      </div>
    </div>`;
  }

  private get isCompact(): boolean {
    return this.orientation !== 'vertical' && (this.compact || this.narrow);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const compact = this.isCompact;
    this.toggleAttribute('data-compact', compact);
    this.assign(changed.has('current') ? (this.prevCurrent ?? this.current) : this.current);
    this.prevCurrent = this.current;
    // the status line cross-fades to its new words
    const status = this.renderRoot.querySelector<HTMLElement>('.status');
    const st = status?.textContent ?? '';
    if (status && this.shownStatus !== null && st !== this.shownStatus && compact && this.placed) crossfadeText(status, this.shownStatus);
    this.shownStatus = st;
    if (changed.has('orientation') || changed.has('steps')) this.fit();
    if (!this.placed && this.count) {
      this.placed = true;
      // everything takes its place at once on the first paint, then animates from there on
      this.setAttribute('data-snap', '');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.removeAttribute('data-snap');
          for (const s of this.steps) s.setAttribute('data-ready', '');
        }),
      );
    }
  }

  /** Hands every step its state, number, delays and focus role. */
  private assign(from: number): void {
    const steps = this.steps;
    const n = steps.length;
    if (!n) return;
    const to = Math.min(this.current, n);
    const a = Math.min(from, n);
    const still = reducedMotion(this) || !this.placed;
    // The fill sweeps stretch by stretch from the old step to the new one, and each marker changes
    // as the fill reaches it (forward) or leaves it (back). Stretch i runs from step i to step i + 1.
    const lo = Math.min(a, to);
    const hi = Math.max(a, to);
    const span = Math.max(1, hi - lo);
    const per = still ? 0 : Math.min(STRETCH_MS, SWEEP_MS / span);
    const forward = to >= a;
    const fillDelay = (i: number) => (i < lo || i >= hi ? 0 : (forward ? i - lo : hi - 1 - i) * per);
    const markDelay = (k: number) => (k < lo || k > hi ? 0 : (forward ? k - lo : hi - k) * per);
    const pickable = (i: number) => this.clickable && !steps[i]!.disabled && (!this.linear || i <= this.reached);
    if (this.focusIndex < 0 || this.focusIndex >= n || !pickable(this.focusIndex)) this.focusIndex = pickable(Math.min(to, n - 1)) ? Math.min(to, n - 1) : steps.findIndex((_, i) => pickable(i));
    steps.forEach((s, i) => {
      s.state = i < to ? 'complete' : i === to ? 'current' : 'upcoming';
      s.index = i;
      s.clickable = this.clickable;
      s.pickable = pickable(i);
      s.tabbable = i === this.focusIndex;
      s.toggleAttribute('data-first', i === 0);
      s.toggleAttribute('data-last', i === n - 1);
      s.toggleAttribute('data-filled', i < to);
      if (this.orientation === 'vertical') s.setAttribute('data-orientation', 'vertical');
      else s.removeAttribute('data-orientation');
      s.style.setProperty('--_df', `${fillDelay(i)}ms`);
      s.style.setProperty('--_dm', `${markDelay(i)}ms`);
      s.style.setProperty('--_dh', `${per || 1}ms`);
      // one even sweep across many stretches; a single stretch eases in and out
      s.style.setProperty('--_ease', span > 1 ? 'linear' : 'ease-in-out');
      if (this.placed && !s.hasAttribute('data-ready')) s.setAttribute('data-ready', '');
    });
    // once a sweep is over, the rails and markers take their usual pace again (for hover, errors and so on)
    if (per) {
      clearTimeout(this.paceTimer);
      this.paceTimer = setTimeout(() => steps.forEach((s) => ['--_df', '--_dm', '--_dh', '--_ease'].forEach((p) => s.style.removeProperty(p))), span * per + 500);
    }
  }
  private paceTimer?: ReturnType<typeof setTimeout>;

  private onSlot = (): void => {
    this.steps = [...this.querySelectorAll<TrStep>(':scope > tr-step')];
  };

  private onStepChange = (): void => {
    this.requestUpdate();
  };

  private onPick = (e: CustomEvent<{ step: TrStep }>): void => {
    e.stopPropagation();
    const i = this.steps.indexOf(e.detail.step);
    if (i < 0 || i === this.current) return;
    this.focusIndex = i;
    const ok = this.dispatchEvent(
      new CustomEvent('change', { detail: { index: i, value: this.steps[i]!.value, previous: this.current }, bubbles: true, composed: true, cancelable: true }),
    );
    if (ok) this.current = i;
    else this.requestUpdate();
  };

  private onFocusIn = (e: FocusEvent): void => {
    const i = this.steps.indexOf(e.target as TrStep);
    if (i >= 0 && i !== this.focusIndex) {
      this.focusIndex = i;
      this.steps.forEach((s, k) => (s.tabbable = k === i));
    }
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!this.clickable) return;
    const i = this.steps.indexOf(e.target as TrStep);
    if (i < 0) return;
    const vertical = this.orientation === 'vertical';
    const rtl = getComputedStyle(this).direction === 'rtl';
    const nextKeys = vertical ? ['ArrowDown', 'ArrowRight'] : [rtl ? 'ArrowLeft' : 'ArrowRight', 'ArrowDown'];
    const prevKeys = vertical ? ['ArrowUp', 'ArrowLeft'] : [rtl ? 'ArrowRight' : 'ArrowLeft', 'ArrowUp'];
    const order = this.steps.map((_, k) => k).filter((k) => this.steps[k]!.pickable);
    if (!order.length) return;
    let target = -1;
    const pos = order.indexOf(i);
    if (nextKeys.includes(e.key)) target = order[Math.min(order.length - 1, pos < 0 ? 0 : pos + 1)]!;
    else if (prevKeys.includes(e.key)) target = order[Math.max(0, pos < 0 ? 0 : pos - 1)]!;
    else if (e.key === 'Home') target = order[0]!;
    else if (e.key === 'End') target = order[order.length - 1]!;
    else return;
    e.preventDefault();
    this.focusIndex = target;
    this.steps.forEach((s, k) => (s.tabbable = k === target));
    this.steps[target]!.focus();
  };

  /** Turns compact when the row has less than the narrowest step width per step. */
  private fit = (): void => {
    if (this.orientation === 'vertical' || !this.count) {
      if (this.narrow) this.narrow = false;
      return;
    }
    const probe = this.renderRoot?.querySelector<HTMLElement>('.probe');
    const avail = this.clientWidth;
    if (!probe || !avail) return;
    const narrow = avail + 0.5 < probe.offsetWidth * this.count;
    if (narrow !== this.narrow) this.narrow = narrow;
  };
}

define('tr-stepper', TrStepper);

declare global {
  interface HTMLElementTagNameMap {
    'tr-stepper': TrStepper;
  }
}
