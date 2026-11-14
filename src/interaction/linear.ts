import { feedback } from './feedback.js';
import { ValueController, type ValueControllerOptions } from './value-controller.js';

export interface LinearOptions extends ValueControllerOptions {
  /** Default `'horizontal'`. Vertical faders increase upward. */
  orientation?: 'horizontal' | 'vertical';
  /** The element whose box defines the travel. Default: the host. */
  track?: () => Element | null;
  /** The cap. Grabbing it never makes it jump; the offset from its centre is kept. */
  thumb?: () => Element | null;
  /**
   * Pressing the track away from the cap: `'jump'` (default) glides the cap to the pointer and keeps
   * dragging, `'page'` steps by 10 % toward the pointer and repeats while held, `'none'` ignores it
   * (pro-audio faders, where only the cap moves).
   */
  trackClick?: 'jump' | 'page' | 'none';
}

/**
 * Faders, sliders, levers and other straight-line travel.
 *
 * Writes `--tr-value-ratio` (0..1). Grabs keep the offset to the cap centre, Shift gives fine
 * control, and on touch moving the finger sideways away from the fader slows it down for precision.
 * Each fader owns its own pointer, so several can be pushed at once with several fingers.
 */
export class LinearController extends ValueController {
  private axis: 'horizontal' | 'vertical';
  private trackFn: (() => Element | null) | undefined;
  private thumbFn: (() => Element | null) | undefined;
  private trackClick: 'jump' | 'page' | 'none';
  private geo = { start: 0, length: 1, dir: 1, cross: 0 };
  private grabOffset = 0;
  /** Absolute mapping (pointer = cap) until fine control switches to relative. */
  private relative = false;
  private lastPos = 0;
  private pageTimer = 0;

  constructor(host: HTMLElement, options: LinearOptions = {}) {
    super(host, options);
    this.axis = options.orientation ?? 'horizontal';
    this.trackFn = options.track;
    this.thumbFn = options.thumb;
    this.trackClick = options.trackClick ?? 'jump';
    this.host.style.touchAction = this.touchAction();
    this.syncAria();
  }

  /** Changes orientation at runtime (e.g. from a component attribute). */
  setOrientation(o: 'horizontal' | 'vertical'): void {
    this.axis = o;
    this.host.style.touchAction = this.touchAction();
    this.syncAria();
  }

  protected touchAction(): string {
    // Leave the cross axis to the page, so a bank of faders never traps scrolling.
    if (this.axis === undefined) return 'none';
    return this.axis === 'vertical' ? 'pan-x pinch-zoom' : 'pan-y pinch-zoom';
  }

  protected override orientation(): 'horizontal' | 'vertical' | null {
    return this.axis ?? 'horizontal';
  }

  private pos(e: { clientX: number; clientY: number }): number {
    return this.axis === 'vertical' ? e.clientY : e.clientX;
  }

  private toValue(pos: number): number {
    const { min, max } = this.range;
    const t = ((pos - this.geo.start) * this.geo.dir) / this.geo.length;
    return min + t * (max - min);
  }

  private toPos(value: number): number {
    const { min, max } = this.range;
    const t = (value - min) / (max - min || 1);
    return this.geo.start + t * this.geo.length * this.geo.dir;
  }

  protected beginDrag(e: PointerEvent): boolean {
    const trackEl = this.trackFn?.();
    // With an explicit track, presses elsewhere on the host (label, readout) are not drags.
    if (trackEl && !e.composedPath().includes(trackEl)) return false;
    const track = trackEl ?? this.host;
    const thumb = this.thumbFn?.() ?? null;
    // One layout read per gesture, before any writes.
    const tr = track.getBoundingClientRect();
    const th = thumb?.getBoundingClientRect();
    this.gestureRect = tr;
    const vertical = this.axis === 'vertical';
    const capLen = th ? (vertical ? th.height : th.width) : 0;
    const rtl = !vertical && getComputedStyle(this.host).direction === 'rtl';
    if (vertical) this.geo = { start: tr.bottom - capLen / 2, length: Math.max(1, tr.height - capLen), dir: -1, cross: tr.left + tr.width / 2 };
    else if (rtl) this.geo = { start: tr.right - capLen / 2, length: Math.max(1, tr.width - capLen), dir: -1, cross: tr.top + tr.height / 2 };
    else this.geo = { start: tr.left + capLen / 2, length: Math.max(1, tr.width - capLen), dir: 1, cross: tr.top + tr.height / 2 };

    const p = this.pos(e);
    const onThumb = !!thumb && e.composedPath().includes(thumb);
    this.relative = false;
    this.lastPos = p;
    this.following = false;
    if (onThumb || !thumb) {
      // Without a cap element, treat the whole track as the cap only when the press is near the
      // current position; otherwise it is a track click.
      const capPos = this.toPos(this.display.value);
      if (onThumb || Math.abs(p - capPos) < 12) {
        this.grabOffset = p - capPos;
        this.startSlide();
        return true;
      }
    }
    if (this.trackClick === 'none') return false;
    if (this.trackClick === 'page') {
      this.pageToward(p);
      return false;
    }
    // Jump: the cap glides to the pointer, then follows it.
    this.grabOffset = 0;
    this.following = true;
    this.startSlide();
    return true;
  }

  private startSlide(): void {
    const s = this.readSounds(this.gestureRect);
    if (s.slide !== 'none') this.slideVoice = feedback.slide({ pitch: s.pitch, pan: s.pan });
  }

  private pageToward(p: number, delay = 380): void {
    const target = this.toValue(p);
    const big = Math.max(this.keyStep, (this.range.max - this.range.min) / 10);
    const cur = this.model;
    if (Math.abs(target - cur) < big / 2) return;
    const next = this.quantize(cur + Math.sign(target - cur) * big);
    this.raw = next;
    this.emitValue(next, 'pointer');
    this.commit();
    this.animateTo(next, 'glide');
    feedback.play('tick', { intensity: 0.5 });
    const stop = () => {
      clearTimeout(this.pageTimer);
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
    };
    clearTimeout(this.pageTimer);
    addEventListener('pointerup', stop, { once: true });
    addEventListener('pointercancel', stop, { once: true });
    this.pageTimer = window.setTimeout(() => this.pageToward(p, 70), delay);
  }

  protected dragTo(e: PointerEvent): number {
    const p = this.pos(e);
    const fine = this.o.fine && e.shiftKey ? this.fineFactor : 1;
    let precision = 1;
    if (e.pointerType !== 'mouse') {
      const cross = this.axis === 'vertical' ? e.clientX : e.clientY;
      const off = Math.abs(cross - this.geo.cross) - 40;
      precision = 1 / (1 + Math.max(0, off) / 110);
    }
    const scale = fine * precision;
    let next: number;
    if (scale < 0.98) {
      // Relative mode: the cap moves a fraction of the hand's travel.
      this.relative = true;
      next = this.raw + ((p - this.lastPos) * this.geo.dir * scale * (this.range.max - this.range.min)) / this.geo.length;
    } else {
      if (this.relative) {
        // Leaving fine mode: re-anchor so the cap does not jump back under the pointer.
        this.relative = false;
        this.grabOffset = p - this.toPos(this.raw);
      }
      next = this.toValue(p - this.grabOffset);
    }
    this.lastPos = p;
    return next;
  }

  protected override afterGrab(e: PointerEvent): void {
    // A press on the track (not the cap): the value goes to the pointer at once, the cap glides there.
    if (this.following) {
      const v = this.toValue(this.pos(e));
      this.setRaw(v, 'pointer', true);
      // Velocity starts from here, not from the jump.
      this.samples = [];
      this.record(this.raw, e.timeStamp);
    }
  }

  protected override onDragMove(e: PointerEvent): void {
    if (this.following && Math.abs(this.display.value - this.display.target) < this.precision * 50) this.following = false;
    if (this.slideVoice) {
      const span = this.range.max - this.range.min || 1;
      this.slideVoice.update(Math.min(1, Math.abs(this.velocity(e.timeStamp)) / (span * 3)));
    }
  }

  protected wheelDelta(e: WheelEvent): [number, boolean] {
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * 400 : e.deltaX;
    const d = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
    const notched = e.deltaMode !== 0 || (Math.abs(d) >= 50 && Number.isInteger(d));
    if (notched) return [Math.sign(d) * Math.max(1, Math.round(Math.abs(d) / 100)), true];
    const len = this.geo.length > 1 ? this.geo.length : 200;
    return [(d / len) * (this.range.max - this.range.min), false];
  }

  override hostDisconnected(): void {
    clearTimeout(this.pageTimer);
    super.hostDisconnected();
  }
}
