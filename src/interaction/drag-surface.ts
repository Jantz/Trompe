import { loop } from './loop.js';
import { reducedMotion } from './motion.js';
import { Spring, type SpringParams } from './spring.js';

interface ControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void;
}

export interface DragSurfaceOptions {
  /** Axis of travel. */
  axis: 'x' | 'y';
  /**
   * Resting offsets along the axis, in px, relative to the element's laid-out position. A bottom
   * sheet might use `[0, 320, 640]` (open, half, closed); a carousel `[0, -w, -2w, ...]`.
   */
  snapPoints: () => readonly number[];
  /** Initial snap index. Default 0. */
  index?: number;
  /** Stretch with growing resistance past the first and last snap point. Default true. */
  rubberBand?: boolean;
  /** One snap point per flick, like pages. Default false (a strong flick can skip points). */
  paging?: boolean;
  /** Only presses that start on this element drag (a sheet's grabber). Default: anywhere on the host. */
  handle?: () => Element | null;
  /** Called when the surface comes to rest at a snap point. */
  onSnap?: (index: number) => void;
  /** Called on every movement with the offset and 0..1 progress between the first and last point. */
  onMove?: (offset: number, progress: number) => void;
  /** Spring for settling. Default `{ duration: 0.42, bounce: 0.08 }`. */
  spring?: SpringParams;
  disabled?: () => boolean;
}

/** iOS-style rubber band: resistance grows the further you pull. */
export function rubberBand(overshoot: number, dimension: number, c = 0.55): number {
  const d = Math.max(1, dimension);
  return Math.sign(overshoot) * (1 - 1 / ((Math.abs(overshoot) * c) / d + 1)) * d;
}

/**
 * Direct manipulation for things you can push around: bottom sheets, side drawers, carousels,
 * swipe-to-reveal rows, pull-to-refresh.
 *
 * The surface follows the finger 1:1, stretches with a rubber band past its ends, and on release
 * picks a snap point from where it would coast to (position + velocity projection), then settles
 * there with a spring that starts at the finger's speed, so a flick never stops dead and a slow
 * release never jumps. Gestures that are mostly across the axis, or that start inside content that
 * can still scroll that way, are left to the browser.
 *
 * Output: the element's own `translate` (compositor-only, composes with its `transform`),
 * `data-dragging` while held, `data-tr-state="dragging|settling|idle"`.
 */
export class DragSurfaceController {
  readonly host: HTMLElement;
  private o: DragSurfaceOptions;
  private spring: Spring;
  private idx: number;
  private pointerId: number | null = null;
  private start = { x: 0, y: 0, offset: 0 };
  private active = false;
  private samples: Array<{ t: number; p: number }> = [];
  private stopTicker: (() => void) | null = null;
  private connected = false;
  private dim = 1;

  constructor(host: HTMLElement & Partial<ControllerHost>, options: DragSurfaceOptions) {
    this.host = host;
    this.o = options;
    this.idx = options.index ?? 0;
    const p = options.snapPoints()[this.idx] ?? 0;
    this.spring = new Spring(p, options.spring ?? { duration: 0.42, bounce: 0.08 }, 0.25);
    if (typeof host.addController === 'function') host.addController(this);
    else if (host.isConnected) this.hostConnected();
  }

  /** Current snap index. */
  get index(): number {
    return this.idx;
  }

  /** Current offset in px. */
  get offset(): number {
    return this.spring.value;
  }

  hostConnected(): void {
    if (this.connected) return;
    this.connected = true;
    this.host.addEventListener('pointerdown', this.onDown);
    // An image or link inside would otherwise start the browser's own drag and cancel ours.
    this.host.addEventListener('dragstart', this.onNativeDrag);
    if (!this.host.style.touchAction) this.host.style.touchAction = this.o.axis === 'y' ? 'pan-x pinch-zoom' : 'pan-y pinch-zoom';
    this.write();
  }

  hostDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    this.host.removeEventListener('pointerdown', this.onDown);
    this.host.removeEventListener('dragstart', this.onNativeDrag);
    this.untrack();
    this.stopTicker?.();
    this.stopTicker = null;
  }

  destroy(): void {
    this.hostDisconnected();
  }

  /** Moves to a snap point, animated unless reduced motion is on or `animate` is false. */
  snapTo(index: number, animate = true, velocity = 0): void {
    const pts = this.o.snapPoints();
    if (!pts.length) return;
    this.idx = Math.max(0, Math.min(pts.length - 1, index));
    this.spring.target = pts[this.idx]!;
    if (!animate || reducedMotion(this.host)) {
      this.spring.snap(this.spring.target);
      this.state('idle');
      this.write();
      this.o.onSnap?.(this.idx);
      return;
    }
    this.spring.velocity = velocity;
    this.state('settling');
    if (this.stopTicker) return;
    this.stopTicker = loop((dt) => {
      const more = this.spring.step(dt);
      this.write();
      if (!more) {
        this.stopTicker = null;
        this.state('idle');
        this.o.onSnap?.(this.idx);
      }
      return more;
    });
  }

  private state(s: 'idle' | 'dragging' | 'settling'): void {
    this.host.setAttribute('data-tr-state', s);
    this.host.toggleAttribute('data-dragging', s === 'dragging');
  }

  private write(): void {
    const v = this.spring.value;
    this.host.style.translate = this.o.axis === 'y' ? `0 ${v.toFixed(2)}px` : `${v.toFixed(2)}px 0`;
    if (this.o.onMove) {
      const pts = this.o.snapPoints();
      const a = pts[0] ?? 0;
      const b = pts[pts.length - 1] ?? 0;
      this.o.onMove(v, b === a ? 0 : Math.max(0, Math.min(1, (v - a) / (b - a))));
    }
  }

  private onNativeDrag = (e: DragEvent): void => {
    e.preventDefault();
  };

  private onDown = (e: PointerEvent): void => {
    if (this.o.disabled?.() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const handle = this.o.handle?.();
    if (handle && !e.composedPath().includes(handle)) return;
    this.pointerId = e.pointerId;
    this.active = false;
    this.start = { x: e.clientX, y: e.clientY, offset: this.spring.value };
    this.samples = [];
    addEventListener('pointermove', this.onMove, { passive: false });
    addEventListener('pointerup', this.onUp);
    addEventListener('pointercancel', this.onCancel);
    this.downPath = e.composedPath();
  };

  private downPath: EventTarget[] = [];

  /** True if content under the finger can still scroll in the direction of the drag. */
  private innerScrollWins(delta: number): boolean {
    for (const t of this.downPath) {
      if (t === this.host) break;
      if (!(t instanceof HTMLElement)) continue;
      const y = this.o.axis === 'y';
      const size = y ? t.scrollHeight - t.clientHeight : t.scrollWidth - t.clientWidth;
      if (size <= 1) continue;
      const ov = getComputedStyle(t)[y ? 'overflowY' : 'overflowX'];
      if (ov !== 'auto' && ov !== 'scroll') continue;
      const pos = y ? t.scrollTop : Math.abs(t.scrollLeft);
      // Dragging toward the start (down/right) scrolls back unless already at the top.
      if (delta > 0 ? pos > 0 : pos < size - 1) return true;
    }
    return false;
  }

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    const along = this.o.axis === 'y' ? dy : dx;
    const across = this.o.axis === 'y' ? dx : dy;
    if (!this.active) {
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(across) > Math.abs(along) || this.innerScrollWins(along)) {
        this.untrack();
        return;
      }
      this.active = true;
      this.stopTicker?.();
      this.stopTicker = null;
      this.start.offset = this.spring.value;
      // Re-base so the surface does not jump by the 6 px slop.
      if (this.o.axis === 'y') this.start.y = e.clientY;
      else this.start.x = e.clientX;
      const r = this.host.getBoundingClientRect();
      this.dim = this.o.axis === 'y' ? r.height : r.width;
      try {
        this.host.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic */
      }
      this.state('dragging');
      // No text selection while dragging a surface with the mouse.
      this.host.style.userSelect = 'none';
    }
    e.preventDefault();
    const d = this.o.axis === 'y' ? e.clientY - this.start.y : e.clientX - this.start.x;
    let off = this.start.offset + d;
    const pts = this.o.snapPoints();
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    if (this.o.rubberBand ?? true) {
      if (off < lo) off = lo + rubberBand(off - lo, this.dim);
      else if (off > hi) off = hi + rubberBand(off - hi, this.dim);
    } else off = Math.max(lo, Math.min(hi, off));
    this.spring.snap(off);
    this.samples.push({ t: e.timeStamp, p: off });
    while (this.samples.length > 2 && e.timeStamp - this.samples[0]!.t > 80) this.samples.shift();
    this.write();
  };

  private velocity(now: number): number {
    const s = this.samples;
    if (s.length < 2) return 0;
    const a = s[0]!;
    const b = s[s.length - 1]!;
    if (now - b.t > 60) return 0;
    const dt = (b.t - a.t) / 1000;
    return dt > 0.008 ? (b.p - a.p) / dt : 0;
  }

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const wasActive = this.active;
    const v = this.velocity(e.timeStamp);
    this.untrack();
    if (!wasActive) return;
    // Swallow the click a drag would otherwise trigger on whatever is under the finger.
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    this.host.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => this.host.removeEventListener('click', swallow, { capture: true }), 0);
    this.release(v);
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const wasActive = this.active;
    this.untrack();
    if (wasActive) this.release(0);
  };

  private release(v: number): void {
    const pts = this.o.snapPoints();
    const pos = this.spring.value;
    let target = this.idx;
    if (this.o.paging) {
      const nearest = nearestIndex(pts, pos);
      if (Math.abs(v) > 250) {
        // Move one page in the flick's direction from where the drag started.
        const dir = Math.sign(v);
        const from = this.idx;
        const candidates = pts.map((p, i) => ({ p, i })).filter(({ p }) => Math.sign(p - pts[from]!) === dir);
        target = candidates.length ? candidates.reduce((a, b) => (Math.abs(a.p - pts[from]!) < Math.abs(b.p - pts[from]!) ? a : b)).i : from;
      } else target = nearest;
    } else {
      // Where it would coast to with a natural deceleration (about 0.2 s of travel).
      target = nearestIndex(pts, pos + v * 0.2);
    }
    this.snapTo(target, true, v);
  }

  private untrack(): void {
    if (this.active) this.host.style.userSelect = '';
    this.pointerId = null;
    this.active = false;
    this.downPath = [];
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerup', this.onUp);
    removeEventListener('pointercancel', this.onCancel);
  }
}

function nearestIndex(pts: readonly number[], v: number): number {
  let best = 0;
  let d = Infinity;
  pts.forEach((p, i) => {
    const e = Math.abs(p - v);
    if (e < d) {
      d = e;
      best = i;
    }
  });
  return best;
}
