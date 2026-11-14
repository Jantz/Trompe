import { ValueController, type ValueControllerOptions } from './value-controller.js';

/** How a pointer drag turns a knob. */
export type RotaryDrag = 'auto' | 'vertical' | 'horizontal' | 'xy' | 'angular';

export interface RotaryOptions extends ValueControllerOptions {
  /** Angle covered from min to max, in degrees. Default 270 (7 o'clock to 5 o'clock). */
  sweep?: number;
  /**
   * Drag gesture. `'vertical'`: up/down like most audio software (precise, works for tiny knobs).
   * `'angular'`: follow the finger around the centre, like a real dial. `'xy'`: up or right
   * increases. `'auto'` (default): angular for touch on knobs at least 64 px and for any pointer on
   * dials at least 140 px; vertical otherwise.
   */
  drag?: RotaryDrag;
  /** Pixels of vertical travel for the full range. Default 220. */
  dragDistance?: number;
  /** Endless encoder (jog wheel): no end stops, value grows without bound. */
  endless?: boolean;
  /** Value change per full turn for endless encoders. Default max - min. */
  revolution?: number;
  /**
   * The part that turns. Presses outside it (label, readout) are not drags, and its centre is the
   * pivot for angular drags. Default: the host.
   */
  knob?: () => Element | null;
}

/**
 * Knobs, dials, rotary selectors and jog wheels.
 *
 * Writes `--tr-angle` (degrees, 0 = pointing up, clockwise) and `--tr-value-ratio` on the host.
 * Rotate only the parts that physically turn (indicator line, grip, skirt); keep the specular
 * highlight of a spun-metal cap fixed, because the light does not turn with the knob.
 *
 * @example
 * const knob = new RotaryController(el, { min: -1, max: 1, step: 0.01, detents: [0] });
 * el.addEventListener('input', () => console.log(knob.value));
 */
export class RotaryController extends ValueController {
  private sweep: number;
  private dragMode: RotaryDrag;
  private distance: number;
  private isEndless: boolean;
  private revolution: number;
  private mode: Exclude<RotaryDrag, 'auto'> = 'vertical';
  private last = { x: 0, y: 0, angle: 0, inside: false };
  private centre = { x: 0, y: 0, r: 1 };
  private fineOn = false;
  private knobFn: (() => Element | null) | undefined;

  constructor(host: HTMLElement, options: RotaryOptions = {}) {
    super(host, options);
    this.sweep = options.sweep ?? 270;
    this.dragMode = options.drag ?? 'auto';
    this.distance = options.dragDistance ?? 220;
    this.isEndless = options.endless ?? false;
    this.revolution = options.revolution ?? (this.range.max - this.range.min || 1);
    this.knobFn = options.knob;
    this.write(true);
  }

  protected override get endless(): boolean {
    return this.isEndless;
  }

  protected touchAction(): string {
    return 'none';
  }

  protected override writeExtra(display: number, ratio: number): void {
    // Constructor order: the base writes once before our fields exist.
    if (this.sweep === undefined) return;
    const angle = this.isEndless
      ? ((display - this.range.min) / this.revolution) * 360
      : -this.sweep / 2 + ratio * this.sweep;
    this.host.style.setProperty("--tr-angle", `${(Math.abs(angle) < 0.005 ? 0 : angle).toFixed(2)}deg`);
  }

  protected beginDrag(e: PointerEvent): boolean {
    const knob = this.knobFn?.();
    if (knob && !e.composedPath().includes(knob)) return false;
    const rect = (knob ?? this.host).getBoundingClientRect();
    this.gestureRect = rect;
    const size = Math.min(rect.width, rect.height);
    this.centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: size / 2 };
    this.mode =
      this.dragMode !== 'auto'
        ? this.dragMode
        : (e.pointerType !== 'mouse' && size >= 64) || size >= 140
          ? 'angular'
          : 'vertical';
    this.last = { x: e.clientX, y: e.clientY, angle: this.angleOf(e), inside: this.inDeadZone(e) };
    this.fineOn = this.o.fine && e.shiftKey;
    return true;
  }

  private angleOf(e: PointerEvent): number {
    return (Math.atan2(e.clientX - this.centre.x, -(e.clientY - this.centre.y)) * 180) / Math.PI;
  }

  private inDeadZone(e: PointerEvent): boolean {
    return Math.hypot(e.clientX - this.centre.x, e.clientY - this.centre.y) < this.centre.r * 0.2;
  }

  /** Value units per degree of rotation. */
  private get perDegree(): number {
    return this.isEndless ? this.revolution / 360 : (this.range.max - this.range.min) / this.sweep;
  }

  protected dragTo(e: PointerEvent): number {
    const fine = this.o.fine && e.shiftKey ? this.fineFactor : 1;
    const span = this.range.max - this.range.min || 1;
    let delta = 0;
    if (this.mode === 'angular') {
      const a = this.angleOf(e);
      const inside = this.inDeadZone(e);
      // Near the centre the angle is unstable; wait until the finger leaves the hub.
      if (!inside && !this.last.inside) {
        let d = a - this.last.angle;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        delta = d * this.perDegree * fine;
      }
      this.last.angle = a;
      this.last.inside = inside;
    } else {
      const dx = e.clientX - this.last.x;
      const dy = this.last.y - e.clientY;
      const px = this.mode === 'vertical' ? dy : this.mode === 'horizontal' ? dx : dx + dy;
      // Moving sideways away from a vertical-drag knob slows it down: precision by distance,
      // like scrubbing on a phone. Only for touch, where Shift does not exist.
      let precision = 1;
      if (this.mode === 'vertical' && e.pointerType !== 'mouse') {
        const off = Math.abs(e.clientX - this.centre.x) - this.centre.r * 1.5;
        precision = 1 / (1 + Math.max(0, off) / 90);
      }
      const unit = this.isEndless ? this.revolution / this.distance : span / this.distance;
      delta = px * unit * fine * precision;
    }
    this.last.x = e.clientX;
    this.last.y = e.clientY;
    this.fineOn = fine < 1;
    return this.raw + delta;
  }

  protected wheelDelta(e: WheelEvent): [number, boolean] {
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * 400 : e.deltaX;
    const d = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
    // A notched mouse wheel reports whole lines or large integer deltas; a trackpad sends small, smooth ones.
    const notched = e.deltaMode !== 0 || (Math.abs(d) >= 50 && Number.isInteger(d));
    if (notched) return [Math.sign(d) * Math.max(1, Math.round(Math.abs(d) / 100)), true];
    const span = this.isEndless ? this.revolution : this.range.max - this.range.min || 1;
    return [(d / this.distance) * span, false];
  }

  /** True while Shift (fine mode) was held on the last move. */
  get fine(): boolean {
    return this.fineOn;
  }
}
