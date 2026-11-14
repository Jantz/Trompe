import { feedback, soundFor } from './feedback.js';
import { loop } from './loop.js';
import { reducedMotion } from './motion.js';
import { Spring } from './spring.js';

interface ControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void;
}

export interface ChoiceOptions {
  /** The options, in order (tabs, segments, radios, toolbar buttons, menu items). */
  items: () => readonly HTMLElement[];
  /** Index of the selected item, or -1. */
  selected: () => number;
  /** Select an item. The component updates its own state, ARIA and events. */
  select: (index: number, source: 'pointer' | 'keyboard') => void;
  /** Arrow keys used. Default `'horizontal'`. `'both'` for grids of one row/column either way. */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /**
   * `'auto'` (default): moving focus with arrows selects, as in tabs and radio groups.
   * `'manual'`: arrows only move focus; Enter/Space select (tabs with expensive panels, toolbars, menus).
   */
  activation?: 'auto' | 'manual';
  /** Arrow past the last item wraps to the first. Default true. */
  wrap?: boolean;
  /**
   * Press on the selected segment and slide across the others, the selector following the finger
   * and snapping to each option, committing on release (segmented controls). Default true.
   */
  slide?: boolean;
  /** Returns true for items that cannot be chosen (skipped by arrows). */
  isDisabled?: (item: HTMLElement) => boolean;
  /**
   * The selector element. When given, its `translate`, `width` and `height` are set directly, which
   * keeps style recalculation to that one element. Otherwise `--tr-indicator-*` go on the host.
   */
  indicator?: () => HTMLElement | null;
}

/**
 * One behaviour for every "pick one of several" control: tabs, segmented controls, radio groups,
 * toolbars, menus and listboxes.
 *
 * - Roving tabindex: one Tab stop for the group, arrows move inside, Home/End jump, letters jump to
 *   the next item starting with that letter (typeahead).
 * - A physical selector: writes `--tr-indicator-x`, `--tr-indicator-y`, `--tr-indicator-w`,
 *   `--tr-indicator-h` (px, relative to the host) and springs them from the old option to the new
 *   one, so a puck, tab underline or lit segment travels instead of jumping. Position goes into
 *   `translate` (compositor); size changes only on the selector itself.
 * - Slide to select: press the selected segment and drag across.
 */
export class ChoiceController {
  readonly host: HTMLElement;
  private o: ChoiceOptions;
  private x = new Spring(0, 'throw', 0.05);
  private y = new Spring(0, 'throw', 0.05);
  private w = new Spring(0, 'throw', 0.05);
  private h = new Spring(0, 'throw', 0.05);
  private boxes: DOMRect[] = [];
  private origin = { x: 0, y: 0 };
  private measured = false;
  private stopTicker: (() => void) | null = null;
  private ro: ResizeObserver | null = null;
  private connected = false;
  private shown = -1;
  private slidePointer: number | null = null;
  private slideIndex = -1;
  private typeahead = '';
  private typeaheadTimer = 0;

  constructor(host: HTMLElement & Partial<ControllerHost>, options: ChoiceOptions) {
    this.host = host;
    this.o = options;
    if (typeof host.addController === 'function') host.addController(this);
    else if (host.isConnected) this.hostConnected();
  }

  hostConnected(): void {
    if (this.connected) return;
    this.connected = true;
    this.host.addEventListener('keydown', this.onKeyDown);
    this.host.addEventListener('pointerdown', this.onDown);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.measured = false;
        this.update(false);
      });
      this.ro.observe(this.host);
    }
    // After the host's first render.
    requestAnimationFrame(() => this.update(false));
  }

  hostDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    this.host.removeEventListener('keydown', this.onKeyDown);
    this.host.removeEventListener('pointerdown', this.onDown);
    this.ro?.disconnect();
    this.ro = null;
    removeEventListener('pointermove', this.onSlideMove);
    removeEventListener('pointerup', this.onSlideEnd);
    removeEventListener('pointercancel', this.onSlideEnd);
    this.slidePointer = null;
    this.stopTicker?.();
    this.stopTicker = null;
  }

  destroy(): void {
    this.hostDisconnected();
  }

  /**
   * Call after the selection or the set of items changed (e.g. from a component's `updated`).
   * Moves the roving tab stop and springs the selector to the selected item.
   */
  update(animate = true): void {
    if (!this.connected) return;
    const items = this.o.items();
    const sel = this.slidePointer !== null ? this.slideIndex : this.o.selected();
    // Roving tabindex: the selected item (or the first enabled) is the group's only tab stop.
    const stop = sel >= 0 ? sel : items.findIndex((i) => !this.o.isDisabled?.(i));
    const slideTouch = (this.o.slide ?? true) ? ((this.o.orientation ?? 'horizontal') === 'vertical' ? 'pan-x' : 'pan-y') : '';
    items.forEach((item, i) => {
      const t = i === stop ? '0' : '-1';
      if (item.getAttribute('tabindex') !== t) item.setAttribute('tabindex', t);
      // Only a touch that starts on the selected item may slide; elsewhere the page scrolls as usual.
      if (slideTouch && this.o.orientation !== 'both') item.style.touchAction = i === sel ? slideTouch : '';
    });
    if (!this.measured || this.boxes.length !== items.length) this.measure(items);
    const box = this.boxes[sel];
    if (!box) {
      this.host.toggleAttribute('data-tr-indicator', false);
      this.shown = -1;
      return;
    }
    const first = this.shown < 0;
    this.shown = sel;
    const tx = box.left - this.origin.x;
    const ty = box.top - this.origin.y;
    if (!animate || first || reducedMotion(this.host)) {
      this.x.snap(tx);
      this.y.snap(ty);
      this.w.snap(box.width);
      this.h.snap(box.height);
      this.write();
      return;
    }
    this.x.target = tx;
    this.y.target = ty;
    this.w.target = box.width;
    this.h.target = box.height;
    if (!this.stopTicker) {
      this.host.toggleAttribute('data-tr-moving', true);
      this.stopTicker = loop((dt) => {
        const a = this.x.step(dt);
        const b = this.y.step(dt);
        const c = this.w.step(dt);
        const d = this.h.step(dt);
        this.write();
        const more = a || b || c || d;
        if (!more) {
          this.stopTicker = null;
          this.host.toggleAttribute('data-tr-moving', false);
        }
        return more;
      });
    }
  }

  private measure(items: readonly HTMLElement[]): void {
    const hr = this.host.getBoundingClientRect();
    // Positions relative to the host's scrolled content box, so a scrolled tab bar stays right.
    this.origin = {
      x: hr.left + this.host.clientLeft - this.host.scrollLeft,
      y: hr.top + this.host.clientTop - this.host.scrollTop,
    };
    this.boxes = items.map((i) => i.getBoundingClientRect());
    this.measured = true;
  }

  private write(): void {
    const el = this.o.indicator?.();
    if (el) {
      el.style.translate = `${this.x.value.toFixed(2)}px ${this.y.value.toFixed(2)}px`;
      el.style.width = `${this.w.value.toFixed(2)}px`;
      el.style.height = `${this.h.value.toFixed(2)}px`;
      this.host.toggleAttribute('data-tr-indicator', true);
      return;
    }
    const s = this.host.style;
    s.setProperty('--tr-indicator-x', `${this.x.value.toFixed(2)}px`);
    s.setProperty('--tr-indicator-y', `${this.y.value.toFixed(2)}px`);
    s.setProperty('--tr-indicator-w', `${this.w.value.toFixed(2)}px`);
    s.setProperty('--tr-indicator-h', `${this.h.value.toFixed(2)}px`);
    this.host.toggleAttribute('data-tr-indicator', true);
  }

  // -------------------------------------------------------------------------------------------
  // Keyboard

  private enabledIndex(from: number, delta: number, items: readonly HTMLElement[]): number {
    const n = items.length;
    const wrap = this.o.wrap ?? true;
    let i = from;
    for (let k = 0; k < n; k++) {
      i += delta;
      if (i < 0 || i >= n) {
        if (!wrap) return from;
        i = (i + n) % n;
      }
      if (!this.o.isDisabled?.(items[i]!)) return i;
    }
    return from;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // composedPath sees through shadow roots, so items inside a component's shadow DOM work.
    const t = e.composedPath()[0];
    if (!(t instanceof Node)) return;
    const items = this.o.items();
    const current = items.findIndex((i) => i === t || i.contains(t));
    if (current < 0) return;
    // Typing in a field inside an item (an "Other: ___" radio) must type, not navigate.
    if (t !== items[current] && t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const or = this.o.orientation ?? 'horizontal';
    const rtl = getComputedStyle(this.host).direction === 'rtl';
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if ((or !== 'vertical' && e.key === fwd) || (or !== 'horizontal' && e.key === 'ArrowDown')) next = this.enabledIndex(current, 1, items);
    else if ((or !== 'vertical' && e.key === back) || (or !== 'horizontal' && e.key === 'ArrowUp')) next = this.enabledIndex(current, -1, items);
    else if (e.key === 'Home') next = this.enabledIndex(-1, 1, items);
    else if (e.key === 'End') next = this.enabledIndex(items.length, -1, items);
    else if ((e.key === 'Enter' || e.key === ' ') && (this.o.activation ?? 'auto') === 'manual') {
      // Native buttons and links activate themselves (their click handler runs); only
      // non-native items need the controller to choose for them.
      const it = items[current]!;
      if (it instanceof HTMLButtonElement || it instanceof HTMLAnchorElement) return;
      e.preventDefault();
      this.choose(current, 'keyboard');
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Typeahead: jump to the next item whose text starts with what was typed.
      clearTimeout(this.typeaheadTimer);
      this.typeahead += e.key.toLowerCase();
      this.typeaheadTimer = window.setTimeout(() => (this.typeahead = ''), 600);
      const n = items.length;
      for (let k = 1; k <= n; k++) {
        const i = (current + k - (this.typeahead.length > 1 ? 1 : 0)) % n;
        const it = items[i]!;
        if (!this.o.isDisabled?.(it) && (it.textContent ?? '').trim().toLowerCase().startsWith(this.typeahead)) {
          next = i;
          break;
        }
      }
      if (next < 0) return;
    }
    if (next < 0) return;
    e.preventDefault();
    items[next]!.focus();
    if ((this.o.activation ?? 'auto') === 'auto') this.choose(next, 'keyboard');
    else {
      items.forEach((it, i) => it.setAttribute('tabindex', i === next ? '0' : '-1'));
    }
  };

  private choose(index: number, source: 'pointer' | 'keyboard'): void {
    if (index === this.o.selected()) return;
    this.o.select(index, source);
    const cfg = feedback.config;
    if (cfg.sound || cfg.haptics) {
      const s = soundFor(this.host, 'detent', 'tick');
      feedback.play(s.profile, { intensity: 0.6, pitch: s.pitch });
    }
    this.update(true);
  }

  // -------------------------------------------------------------------------------------------
  // Slide to select

  private indexAt(x: number, y: number): number {
    const or = this.o.orientation ?? 'horizontal';
    let best = -1;
    let bestD = Infinity;
    this.boxes.forEach((b, i) => {
      const it = this.o.items()[i];
      if (it && this.o.isDisabled?.(it)) return;
      const d = or === 'vertical' ? Math.abs(y - (b.top + b.height / 2)) : Math.abs(x - (b.left + b.width / 2));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private onDown = (e: PointerEvent): void => {
    if ((this.o.slide ?? true) === false || this.slidePointer !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const items = this.o.items();
    const sel = this.o.selected();
    const path = e.composedPath();
    if (sel < 0 || !items[sel] || !path.includes(items[sel]!)) return;
    this.measure(items);
    this.slidePointer = e.pointerId;
    this.slideIndex = sel;
    this.slideStart = { x: e.clientX, y: e.clientY, active: false };
    // No pointer capture: a press that does not slide must stay an ordinary click on the item.
    addEventListener('pointermove', this.onSlideMove);
    addEventListener('pointerup', this.onSlideEnd);
    addEventListener('pointercancel', this.onSlideEnd);
  };

  private slideStart = { x: 0, y: 0, active: false };

  private onSlideMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.slidePointer) return;
    if (!this.slideStart.active) {
      if (Math.hypot(e.clientX - this.slideStart.x, e.clientY - this.slideStart.y) < 6) return;
      this.slideStart.active = true;
    }
    const i = this.indexAt(e.clientX, e.clientY);
    if (i >= 0 && i !== this.slideIndex) {
      this.slideIndex = i;
      this.host.toggleAttribute('data-dragging', true);
      const cfg = feedback.config;
      if (cfg.sound || cfg.haptics) feedback.play('tick', { intensity: 0.5 });
      this.update(true);
    }
  };

  private onSlideEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.slidePointer) return;
    const moved = this.host.hasAttribute('data-dragging');
    const i = this.slideIndex;
    this.slidePointer = null;
    removeEventListener('pointermove', this.onSlideMove);
    removeEventListener('pointerup', this.onSlideEnd);
    removeEventListener('pointercancel', this.onSlideEnd);
    this.host.toggleAttribute('data-dragging', false);
    if (moved && e.type === 'pointerup') {
      // The following click lands on the original item; swallow it, the slide already chose.
      const swallow = (ev: Event) => ev.stopImmediatePropagation();
      this.host.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => this.host.removeEventListener('click', swallow, { capture: true }), 0);
      this.choose(i, 'pointer');
    }
    this.update(true);
  };
}
