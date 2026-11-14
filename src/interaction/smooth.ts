import { reducedMotion } from './motion.js';
import { springEasing } from './spring.js';

/**
 * Smoothness primitives: nothing on a Trompe page changes size, appears, disappears or swaps its
 * text in a single frame.
 *
 * - {@link SizeTransition} keeps a box at its last height (or width) and animates it to the new
 *   one whenever its content changes size, so the content around it never jumps. No layout shift
 *   is ever reported: the box itself never snaps.
 * - {@link enter} / {@link exit} fade small parts in and out (messages, clear buttons, list rows).
 * - {@link crossfadeText} cross-fades a label whose text was replaced.
 * - {@link viewTransition} wraps a page-wide change (theme, skin, realism, material) in a View
 *   Transition, and {@link autoViewTransitions} does that for changes made by any code.
 *
 * All of it honours reduced motion (`prefers-reduced-motion`, or `data-tr-motion` on an
 * ancestor): sizes then snap and only short opacity fades remain.
 */

let glide: { easing: string; duration: number } | null = null;
/** The `glide` spring as a CSS easing: smooth, no overshoot. Used for every size change. */
function sizeEasing(): { easing: string; duration: number } {
  return (glide ??= springEasing('glide'));
}

const SIZE_MS = 240;

export interface SizeTransitionOptions {
  /** Which dimension animates. Default `'block'` (height). */
  axis?: 'block' | 'inline';
  /** Milliseconds. Default 240. */
  duration?: number;
  /**
   * Default `true`: `outer` always holds the content's size, so every change animates. `false`:
   * `outer` sizes itself between changes and only changes announced with `hold()` animate.
   */
  pin?: boolean;
}

/**
 * Animates a box's size when its content changes size.
 *
 * `outer` is the box that animates; `inner` holds the content and is measured. Between changes,
 * `outer` holds an explicit size equal to the content's, so content that grows or shrinks does not
 * move anything in its first frame; a ResizeObserver then animates `outer` to the new size (clipped
 * while it moves). When the box's width changes (window resize), the height follows at once instead
 * of lagging behind. A change while an animation runs carries on from the box's current size.
 *
 * With `pin: false`, `outer` keeps no inline size between changes (so it can stretch or fill like
 * any other box) and only changes announced with {@link SizeTransition.hold} animate.
 *
 * Works as a Lit reactive controller (`new SizeTransition(this, …)`) or on its own: call
 * `connect()` / `disconnect()`.
 */
export class SizeTransition {
  private ro: ResizeObserver | null = null;
  private last = -1;
  private cross = -1;
  private anim: Animation | null = null;
  private holding = false;
  private outerEl: HTMLElement | null = null;
  private innerEl: HTMLElement | null = null;
  private readonly axis: 'block' | 'inline';
  private readonly duration: number;
  private readonly pin: boolean;

  constructor(
    host: { addController?: (c: object) => void } | null,
    private readonly target: () => { outer: HTMLElement | null | undefined; inner: HTMLElement | null | undefined },
    options: SizeTransitionOptions = {},
  ) {
    this.axis = options.axis ?? 'block';
    this.duration = options.duration ?? SIZE_MS;
    this.pin = options.pin ?? true;
    host?.addController?.(this);
  }

  hostConnected(): void {
    // On first connect the parts render later (hostUpdated wires them). A host moved in the DOM
    // is reconnected without re-rendering, so wire its existing parts again here.
    this.connect();
  }

  hostUpdated(): void {
    this.connect();
  }

  hostDisconnected(): void {
    this.disconnect();
  }

  /** Starts observing (idempotent; re-wires if the parts were re-rendered). */
  connect(): void {
    const { outer, inner } = this.target();
    if (!outer || !inner || typeof ResizeObserver === 'undefined') {
      if (this.outerEl) this.disconnect();
      return;
    }
    if (outer === this.outerEl && inner === this.innerEl) return;
    this.disconnect();
    this.outerEl = outer;
    this.innerEl = inner;
    this.ro = new ResizeObserver((entries) => this.onResize(entries[entries.length - 1]));
    this.ro.observe(inner);
  }

  disconnect(): void {
    this.ro?.disconnect();
    this.ro = null;
    this.anim?.cancel();
    this.anim = null;
    this.holding = false;
    if (this.outerEl) this.release(this.outerEl, true);
    this.outerEl = this.innerEl = null;
    this.last = this.cross = -1;
  }

  /**
   * Keeps `outer` at its current size until the content's next size change has been animated.
   * Call it right before a change you make (only needed with `pin: false`).
   */
  hold(): void {
    const outer = this.outerEl;
    if (this.pin || !outer || this.last < 0 || this.anim) return;
    outer.style.setProperty(this.prop(), `${this.last}px`);
    this.holding = true;
    // No size change after all: let go after the change has rendered.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.holding && !this.anim) {
        this.holding = false;
        this.release(outer, true);
      }
    }));
  }

  private prop(): 'height' | 'width' {
    return this.axis === 'block' ? 'height' : 'width';
  }

  private release(el: HTMLElement, size = false): void {
    if (size || !this.pin) el.style.removeProperty(this.prop());
    el.style.removeProperty('overflow');
    el.style.removeProperty('overflow-clip-margin');
  }

  private onResize(entry: ResizeObserverEntry): void {
    const outer = this.outerEl;
    if (!outer) return;
    const box = entry.borderBoxSize?.[0];
    const size = box ? (this.axis === 'block' ? box.blockSize : box.inlineSize) : this.axis === 'block' ? entry.contentRect.height : entry.contentRect.width;
    const cross = box ? (this.axis === 'block' ? box.inlineSize : box.blockSize) : this.axis === 'block' ? entry.contentRect.width : entry.contentRect.height;
    const prop = this.prop();
    const first = this.last < 0;
    const reflow = !first && Math.abs(cross - this.cross) > 0.5;
    const from = this.last;
    this.cross = cross;
    if (Math.abs(size - from) < 0.5) return;
    this.last = size;
    const animate = this.pin || this.holding || !!this.anim;
    this.holding = false;
    // First measurement, a width change reflowing the content, a hidden box, reduced motion, or
    // (unpinned) a change nobody announced: snap.
    if (first || reflow || !animate || !outer.isConnected || reducedMotion(outer) || typeof outer.animate !== 'function') {
      this.anim?.cancel();
      this.anim = null;
      if (this.pin) outer.style.setProperty(prop, `${size}px`);
      this.release(outer);
      return;
    }
    outer.style.setProperty(prop, `${size}px`);
    let start = from;
    if (this.anim) {
      // Changed again mid-way (a nested group opening): carry on from where the box is now. The
      // computed size is the animated one, and unlike a bounding rect ignores ancestor transforms.
      start = parseFloat(getComputedStyle(outer)[prop]) || from;
      this.anim.cancel();
      this.anim = null;
    }
    const { easing } = sizeEasing();
    outer.style.setProperty('overflow', 'clip');
    // Let focus rings and edge shadows of the content show past a moving bottom edge.
    if (this.axis === 'block') outer.style.setProperty('overflow-clip-margin', '6px');
    const anim = outer.animate([{ [prop]: `${start}px` }, { [prop]: `${size}px` }], { duration: this.duration, easing });
    this.anim = anim;
    anim.finished.then(
      () => {
        if (this.anim !== anim) return;
        this.anim = null;
        this.release(outer);
      },
      () => {},
    );
  }
}

/** Running enter/exit animations, so a reversal starts from where the last one is. */
const parts = new WeakMap<Element, Animation>();

export interface PartMotion {
  /** Starting offset in px along y (positive = from below). Default 4. */
  y?: number;
  /** Starting scale. Default 1. */
  scale?: number;
  /** Milliseconds. Default 160 in, 120 out. */
  duration?: number;
}

/**
 * Fades a small part in (a message, a clear button, a new row). Call right after it becomes
 * visible. Transform and opacity only.
 */
export function enter(el: Element | null | undefined, { y = 4, scale = 1, duration = 160 }: PartMotion = {}): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  const prev = parts.get(el);
  const start = prev ? Number(getComputedStyle(el).opacity) : 0;
  prev?.cancel();
  const still = reducedMotion(el);
  const from: Keyframe = { opacity: start };
  if (!still && !prev) from.transform = `translateY(${y}px) scale(${scale})`;
  const a = el.animate([from, { opacity: 1, transform: 'none' }], { duration: still ? Math.min(duration, 120) : duration, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  parts.set(el, a);
  a.finished.then(() => parts.get(el) === a && parts.delete(el), () => {});
  return a;
}

/**
 * Fades a part out and resolves `true` when done (then hide or remove it), or `false` when
 * interrupted by another enter/exit. The element keeps its final frame until you hide it.
 */
export function exit(el: Element | null | undefined, { y = 4, scale = 1, duration = 120 }: PartMotion = {}): Promise<boolean> {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve(true);
  const prev = parts.get(el);
  const start = prev ? Number(getComputedStyle(el).opacity) : 1;
  prev?.cancel();
  const still = reducedMotion(el);
  const to: Keyframe = { opacity: 0 };
  if (!still) to.transform = `translateY(${y}px) scale(${scale})`;
  const a = el.animate([{ opacity: start }, to], { duration: still ? Math.min(duration, 90) : duration, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
  parts.set(el, a);
  return a.finished.then(
    () => {
      if (parts.get(el) !== a) return false;
      parts.delete(el);
      // Keep the faded frame until the caller hides the element, then drop the fill.
      requestAnimationFrame(() => parts.get(el) || a.cancel());
      return true;
    },
    () => false,
  );
}

/**
 * Removes an element with an exit: it fades and its height collapses, so what follows slides up
 * instead of jumping. Resolves once it is gone.
 */
export async function removeAnimated(el: HTMLElement, { duration = 200 }: { duration?: number } = {}): Promise<void> {
  if (!el.isConnected) return;
  if (reducedMotion(el) || typeof el.animate !== 'function') {
    el.remove();
    return;
  }
  const cs = getComputedStyle(el);
  const h = el.getBoundingClientRect().height;
  el.style.overflow = 'clip';
  el.style.pointerEvents = 'none';
  // Leaving: gone for focus and assistive tech from the start, only the picture remains.
  el.inert = true;
  const { easing } = sizeEasing();
  const collapse = el.animate(
    [
      { height: `${h}px`, opacity: 1, marginBlockStart: cs.marginBlockStart, marginBlockEnd: cs.marginBlockEnd, paddingBlockStart: cs.paddingBlockStart, paddingBlockEnd: cs.paddingBlockEnd },
      { height: '0px', opacity: 0, marginBlockStart: '0px', marginBlockEnd: '0px', paddingBlockStart: '0px', paddingBlockEnd: '0px' },
    ],
    { duration, easing, fill: 'forwards' },
  );
  await collapse.finished.catch(() => {});
  el.remove();
  collapse.cancel();
  el.style.removeProperty('overflow');
  el.style.removeProperty('pointer-events');
}

/**
 * Animates an element that was just inserted: its height opens from 0 while it fades in, so what
 * follows slides down instead of jumping. Call right after inserting it.
 */
export function insertAnimated(el: HTMLElement, { duration = 220 }: { duration?: number } = {}): Animation | null {
  if (!el.isConnected || typeof el.animate !== 'function') return null;
  if (reducedMotion(el)) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  const cs = getComputedStyle(el);
  const h = `${el.getBoundingClientRect().height}px`;
  const { easing } = sizeEasing();
  el.style.overflow = 'clip';
  const a = el.animate(
    [
      { height: '0px', opacity: 0, marginBlockStart: '0px', marginBlockEnd: '0px', paddingBlockStart: '0px', paddingBlockEnd: '0px' },
      { height: h, opacity: 1, marginBlockStart: cs.marginBlockStart, marginBlockEnd: cs.marginBlockEnd, paddingBlockStart: cs.paddingBlockStart, paddingBlockEnd: cs.paddingBlockEnd },
    ],
    { duration, easing },
  );
  const done = () => el.style.removeProperty('overflow');
  a.finished.then(done, done);
  return a;
}

/**
 * Cross-fades a label whose text just changed: a copy of the old text fades out where it was
 * while the new text fades in. `el` is the element holding the text (a span the component renders
 * just for it is best); `previous` is the old text. Call right after the new text is in the DOM.
 */
export function crossfadeText(el: HTMLElement | null | undefined, previous: string, { duration = 180 }: { duration?: number } = {}): void {
  if (!el || !el.isConnected || typeof el.animate !== 'function') return;
  if (previous === (el.textContent ?? '')) return;
  const still = reducedMotion(el);
  const ghosts = ghostsOf.get(el);
  for (const g of ghosts ?? []) g.remove();
  if (previous.trim()) {
    const ghost = document.createElement('span');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.className = el.className;
    ghost.textContent = previous;
    // Sub-pixel position inside the containing block, so the old text does not jitter by a pixel.
    const parent = el.offsetParent as HTMLElement | null;
    const r = el.getBoundingClientRect();
    const pr = parent?.getBoundingClientRect();
    const left = pr ? r.left - pr.left - parent!.clientLeft : el.offsetLeft;
    const top = pr ? r.top - pr.top - parent!.clientTop : el.offsetTop;
    ghost.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:auto;height:${r.height}px;white-space:pre;pointer-events:none;margin:0;flex:none;`;
    el.after(ghost);
    ghostsOf.set(el, [ghost]);
    ghost
      .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: still ? 'none' : 'translateY(-0.3em)' }], { duration: duration * 0.8, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => ghost.remove(), () => ghost.remove());
  }
  el.animate([{ opacity: 0, translate: still ? 'none' : '0 0.3em' }, { opacity: 1, translate: 'none' }], { duration, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
}

const ghostsOf = new WeakMap<Element, HTMLElement[]>();

// ---------------------------------------------------------------------------------------------
// Page-wide changes: View Transitions

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void>; skipTransition(): void } };

let active = 0;

/**
 * Runs `update` (a change that restyles a large part of the page: theme, skin, realism, material,
 * light) inside a View Transition, so the old look cross-fades into the new one on the compositor.
 * Falls back to running it directly where View Transitions are missing, and under reduced motion
 * uses a shorter fade.
 */
export function viewTransition(update: () => void, doc: Document = document): Promise<void> {
  const d = doc as VTDocument;
  if (typeof d.startViewTransition !== 'function' || doc.visibilityState === 'hidden' || doc.documentElement.dataset.trViewTransitions === 'off') {
    update();
    return Promise.resolve();
  }
  doc.documentElement.toggleAttribute('data-tr-vt-reduced', reducedMotion(doc.documentElement));
  active++;
  const t = d.startViewTransition(() => {
    update();
    // Look changes made inside this transition are already animated by it: don't start another.
    watching?.takeRecords();
  });
  // A transition skipped by a newer one rejects `ready`; that is expected, not an error.
  t.ready?.catch(() => {});
  return t.finished
    .catch(() => {})
    .finally(() => {
      if (--active === 0) doc.documentElement.removeAttribute('data-tr-vt-reduced');
    });
}

/** Attributes whose change restyles everything beneath them. */
export const LOOK_ATTRIBUTES = ['data-tr-theme', 'data-tr-skin', 'data-tr-realism', 'data-tr-material', 'data-tr-finish', 'data-tr-profile'];
/** The same, as attributes on Trompe elements themselves. */
const ELEMENT_LOOK = ['material', 'finish', 'profile', 'realism'];

let watching: MutationObserver | null = null;
let replayingLook = false;

/**
 * True while {@link autoViewTransitions} puts back old look attributes to capture the old look,
 * or replays the new ones. Elements skip attributeChangedCallback then, so their properties keep
 * the value that was actually set.
 */
export function isReplayingLook(): boolean {
  return replayingLook;
}
const painted = new WeakSet<Element>();

/** Whether an element has been on screen (see {@link notePainted}). */
export function hasPainted(el: Element | null | undefined): boolean {
  return !!el && painted.has(el);
}

/** Records that an element has been on screen (Trompe elements call it a frame after their first render). */
export function notePainted(el: Element): void {
  painted.add(el);
}

/**
 * Watches the document for page-wide look changes (the {@link LOOK_ATTRIBUTES} on any element,
 * plus `class` and `style` on `<html>` and `<body>` when they touch a theme) and plays each as a
 * View Transition, whatever code made it. Trompe calls this once when it installs its styles.
 * Opt out with `data-tr-view-transitions="off"` on `<html>`.
 */
export function autoViewTransitions(doc: Document = document): void {
  if (watching || typeof MutationObserver === 'undefined' || typeof (doc as VTDocument).startViewTransition !== 'function') return;
  // Changes waiting for their View Transition: the value to show until the old look is captured,
  // and the value to apply inside the transition. Later changes in the same frame fold in here.
  let pending: Map<Element, Map<string, { old: string | null; final: string | null }>> | null = null;
  const apply = (which: 'old' | 'final') => {
    replayingLook = true;
    for (const [el, attrs] of pending!) {
      for (const [name, v] of attrs) {
        const value = v[which];
        if (el.getAttribute(name) === value) continue;
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
    }
    watching!.takeRecords();
    replayingLook = false;
  };
  watching = new MutationObserver((records) => {
    if (replayingLook) return;
    // Earliest old value per element and attribute: several changes in one task count as one.
    const seen = new Map<Element, Map<string, string | null>>();
    for (const r of records) {
      const el = r.target as Element;
      const name = r.attributeName;
      if (r.type !== 'attributes' || !name) continue;
      if (!LOOK_ATTRIBUTES.includes(name) && !(ELEMENT_LOOK.includes(name) && el.localName.startsWith('tr-'))) continue;
      let m = seen.get(el);
      if (!m) seen.set(el, (m = new Map()));
      if (!m.has(name)) m.set(name, r.oldValue);
    }
    let added = false;
    const fresh = !pending;
    pending ??= new Map();
    for (const [el, attrs] of seen) {
      for (const [name, oldValue] of attrs) {
        const final = el.getAttribute(name);
        const known = pending.get(el)?.get(name);
        if (known) {
          known.final = final;
          continue;
        }
        if (oldValue === final || !el.isConnected) continue;
        // A Trompe element reflecting its first `material` (no old value, never painted) has nothing to fade from.
        if (oldValue === null && el.localName.startsWith('tr-') && !painted.has(el)) continue;
        let m = pending.get(el);
        if (!m) pending.set(el, (m = new Map()));
        m.set(name, { old: oldValue, final });
        added = true;
      }
    }
    if (fresh && !added) {
      pending = null;
      return;
    }
    // The microtask runs before the next frame: show the old values again so the browser captures
    // the old look first, then apply the final values inside the View Transition. Trompe elements
    // ignore these replays, so their properties keep the value that was set.
    apply('old');
    if (!fresh) return;
    void viewTransition(() => {
      apply('final');
      pending = null;
    }, doc);
  });
  watching.observe(doc.documentElement, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: [...LOOK_ATTRIBUTES, ...ELEMENT_LOOK] });
}

/**
 * Resolves once the element's running transitions and animations (its exit) have finished, or
 * after `max` ms. Use it to keep a closing surface in place until it has faded out.
 */
export function afterExit(el: Element, max = 600): Promise<void> {
  const anims = typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : [];
  const finite = anims.filter((a) => {
    const t = a.effect?.getComputedTiming();
    return t && Number.isFinite(t.endTime as number);
  });
  if (!finite.length) return Promise.resolve();
  return Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => {}))).then(() => {}), new Promise<void>((r) => setTimeout(r, max))]);
}
