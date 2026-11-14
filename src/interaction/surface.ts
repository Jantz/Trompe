import { reducedMotion } from './motion.js';
import { springEasing, type SpringName } from './spring.js';

/**
 * Motion for surfaces that appear above the page: menus, selects, popovers, dialogs, sheets and
 * toasts. The metaphor is physical: a surface lifts off the page toward the viewer, growing out of
 * the control that opened it, and its shadow spreads as it rises. Everything animates `transform`
 * and `opacity` only (compositor), with springs baked into CSS `linear()` easings.
 */

export type SurfaceKind = 'menu' | 'popover' | 'dialog' | 'sheet' | 'toast';

export interface PresentOptions {
  /** The control (or a rect) the surface grows out of. Sets the transform origin. */
  from?: Element | DOMRect | null;
  /** Motion style. Default `'popover'`. */
  kind?: SurfaceKind;
  /** A separate shadow layer to fade with the lift (instead of animating box-shadow). */
  shadow?: Element | null;
  /** Sheets: the edge they slide in from. Default `'bottom'`. */
  edge?: 'bottom' | 'top' | 'left' | 'right';
}

interface Motion {
  spring: SpringName;
  from: Keyframe;
  out: number;
}

const MOTION: Record<SurfaceKind, Motion> = {
  menu: { spring: 'throw', from: { opacity: 0, transform: 'translateY(-4px) scale(0.96)' }, out: 0.6 },
  popover: { spring: 'throw', from: { opacity: 0, transform: 'scale(0.95)' }, out: 0.6 },
  dialog: { spring: 'press', from: { opacity: 0, transform: 'translateY(12px) scale(0.94)' }, out: 0.55 },
  sheet: { spring: 'glide', from: { transform: 'translateY(100%)' }, out: 0.8 },
  toast: { spring: 'press', from: { opacity: 0, transform: 'translateY(16px) scale(0.98)' }, out: 0.6 },
};

const easings = new Map<string, { easing: string; duration: number }>();
function eased(spring: SpringName): { easing: string; duration: number } {
  let e = easings.get(spring);
  if (!e) easings.set(spring, (e = springEasing(spring)));
  return e;
}

function sheetFrom(edge: PresentOptions['edge']): Keyframe {
  switch (edge) {
    case 'top':
      return { transform: 'translateY(-100%)' };
    case 'left':
      return { transform: 'translateX(-100%)' };
    case 'right':
      return { transform: 'translateX(100%)' };
    default:
      return { transform: 'translateY(100%)' };
  }
}

/** Sets `transform-origin` so the surface grows out of the trigger. One layout read. */
export function originFrom(el: HTMLElement, from: Element | DOMRect): void {
  const r = from instanceof Element ? from.getBoundingClientRect() : from;
  const s = el.getBoundingClientRect();
  if (!s.width || !s.height) return;
  const x = Math.max(0, Math.min(s.width, r.left + r.width / 2 - s.left));
  const y = Math.max(0, Math.min(s.height, r.top + r.height / 2 - s.top));
  el.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
}

const running = new WeakMap<Element, Animation[]>();

function cancel(el: Element): void {
  for (const a of running.get(el) ?? []) a.cancel();
  running.delete(el);
}

/**
 * Animates a surface in. Call right after it becomes visible (after `showModal()`, `showPopover()`,
 * or removing `hidden`). Returns when the motion has finished.
 */
export function present(el: HTMLElement, options: PresentOptions = {}): Promise<void> {
  if (typeof el.animate !== 'function') return Promise.resolve();
  cancel(el);
  const kind = options.kind ?? 'popover';
  const m = MOTION[kind];
  if (options.from && kind !== 'sheet') originFrom(el, options.from);
  const anims: Animation[] = [];
  if (reducedMotion(el)) {
    anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' }));
  } else {
    const { easing, duration } = eased(m.spring);
    const from = kind === 'sheet' ? sheetFrom(options.edge) : m.from;
    // composite 'add' layers the motion on top of the surface's own transform (a centred popover's
    // translate(-50%, -50%) survives the animation).
    anims.push(el.animate([{ transform: from.transform as string }, { transform: 'translate(0)' }], { duration, easing, composite: 'add' }));
    // Opacity settles faster than the spring, so the surface is solid before it lands.
    if ('opacity' in from) anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(160, duration * 0.5), easing: 'ease-out' }));
    if (options.shadow) {
      anims.push(options.shadow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration * 0.8, easing: 'ease-out' }));
    }
  }
  running.set(el, anims);
  return Promise.all(anims.map((a) => a.finished)).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Animates a surface out, then resolves so the caller can hide it (`close()`, `hidePopover()`, or
 * set `hidden`). Exits are quicker than entrances: things leave faster than they arrive.
 */
export function dismiss(el: HTMLElement, options: Omit<PresentOptions, 'from'> = {}): Promise<boolean> {
  if (typeof el.animate !== 'function') return Promise.resolve(true);
  cancel(el);
  const kind = options.kind ?? 'popover';
  const m = MOTION[kind];
  const anims: Animation[] = [];
  if (reducedMotion(el)) {
    anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: 'linear', fill: 'forwards' }));
  } else {
    const { duration } = eased(m.spring);
    const to = kind === 'sheet' ? sheetFrom(options.edge) : m.from;
    const d = Math.max(90, duration * m.out);
    anims.push(el.animate([{ transform: 'translate(0)' }, { transform: to.transform as string }], { duration: d, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards', composite: 'add' }));
    if ('opacity' in to) anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'ease-in', fill: 'forwards' }));
    if (options.shadow) {
      anims.push(options.shadow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration * m.out * 0.7, easing: 'ease-in', fill: 'forwards' }));
    }
  }
  running.set(el, anims);
  return Promise.all(anims.map((a) => a.finished)).then(
    () => {
      // Clear the fill so the element is clean next time it opens.
      for (const a of anims) a.cancel();
      running.delete(el);
      return true;
    },
    // Interrupted (e.g. reopened mid-exit): the caller must not hide it.
    () => false,
  );
}

export interface DialogOptions {
  /** Close when the backdrop is clicked. Default true. */
  lightDismiss?: boolean;
  kind?: Extract<SurfaceKind, 'dialog' | 'sheet'>;
  edge?: PresentOptions['edge'];
}

/**
 * Gives a native `<dialog>` physical open and close motion while keeping all its built-in behaviour
 * (modality, focus trapping, focus return, Escape). Returns `open(from?)` and `close(value?)`.
 * Escape and backdrop clicks also animate out.
 */
export function dialogMotion(dialog: HTMLDialogElement, options: DialogOptions = {}) {
  const kind = options.kind ?? 'dialog';
  let closing = false;
  let generation = 0;
  const close = async (value?: string): Promise<void> => {
    if (!dialog.open || closing) return;
    closing = true;
    const gen = generation;
    dialog.setAttribute('data-tr-closing', '');
    const backdrop = animateBackdrop(dialog, false);
    const finished = await dismiss(dialog, { kind, edge: options.edge });
    await backdrop;
    // Reopened while closing: open() owns the dialog now.
    if (!finished || gen !== generation) return;
    dialog.removeAttribute('data-tr-closing');
    closing = false;
    dialog.close(value);
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    void close();
  });
  if (options.lightDismiss ?? true) {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) void close();
    });
  }
  return {
    open(from?: Element | null): Promise<void> {
      // Read the trigger before showModal() moves focus into the dialog.
      const origin = from ?? (document.activeElement as Element | null);
      generation++;
      closing = false;
      dialog.removeAttribute('data-tr-closing');
      if (!dialog.open) dialog.showModal();
      void animateBackdrop(dialog, true);
      return present(dialog, { kind, from: origin && origin !== dialog && !dialog.contains(origin) ? origin : null, edge: options.edge });
    },
    close,
  };
}

const backdrops = new WeakMap<HTMLDialogElement, Animation>();

function animateBackdrop(dialog: HTMLDialogElement, entering: boolean): Promise<void> {
  try {
    backdrops.get(dialog)?.cancel();
    const a = dialog.animate(entering ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedMotion(dialog) ? 90 : entering ? 220 : 160,
      easing: 'ease-out',
      pseudoElement: '::backdrop',
      fill: entering ? 'none' : 'forwards',
    });
    backdrops.set(dialog, a);
    return a.finished.then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

/**
 * A short, damped side-to-side shake, the universal "no" (wrong password, invalid field). Under
 * reduced motion it does not move; it sets `data-tr-alert` for 700 ms instead, so the component can
 * flash its outline or ink.
 */
export function shake(el: HTMLElement, distance = 6): Promise<void> {
  if (reducedMotion(el) || typeof el.animate !== 'function') {
    el.setAttribute('data-tr-alert', '');
    return new Promise((res) =>
      setTimeout(() => {
        el.removeAttribute('data-tr-alert');
        res();
      }, 700),
    );
  }
  // A damped oscillation, ~3.5 cycles, from the same physics as everything else.
  const frames: Keyframe[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = distance * Math.exp(-4 * t) * Math.sin(t * Math.PI * 7);
    frames.push({ transform: `translateX(${x.toFixed(2)}px)` });
  }
  el.setAttribute('data-tr-alert', '');
  return el.animate(frames, { duration: 420, easing: 'linear', composite: 'add' }).finished.then(
    () => el.removeAttribute('data-tr-alert'),
    () => el.removeAttribute('data-tr-alert'),
  );
}
