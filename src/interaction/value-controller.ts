import { applyDetents, detentIndex, restingPoint, type DetentSpec, type Range } from './detents.js';
import { feedback, panFor, soundFor, type SlideVoice, type SoundProfile } from './feedback.js';
import { loop } from './loop.js';
import { reducedMotion } from './motion.js';
import { Spring, type SpringName, type SpringParams } from './spring.js';

/** What caused a value change. Passed to `onInput`. */
export type InputSource = 'pointer' | 'wheel' | 'keyboard' | 'inertia' | 'reset';

/** Minimal Lit ReactiveControllerHost shape, so controllers plug into Lit without importing it. */
interface ControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void;
}

/** Options shared by rotary and linear controls. */
export interface ValueControllerOptions {
  /** Lowest value. Default 0. */
  min?: number;
  /** Highest value. Default 100. */
  max?: number;
  /** Granularity; 0 for continuous. Default 1. */
  step?: number;
  /** Initial value. Default `min`. */
  value?: number;
  /** Value restored by double-click. Default the initial value. */
  defaultValue?: number;
  /** Notches: `'steps'` (every step) or a list of values (e.g. `[0]` for a pan centre). */
  detents?: 'steps' | readonly number[];
  /** Detent stickiness, 0 (click only) to 1. Default 0.6. */
  detentStrength?: number;
  /** Capture half-width of listed detents, in value units. Default 4 % of the range. */
  detentWidth?: number;
  /** Coasting after a flick, 0 (none, like a damped fader) to 1 (free-spinning jog wheel). Default 0. */
  inertia?: number;
  /** Mouse wheel and trackpad: `'hover'` (default), `'focus'` (only when focused) or `'off'`. */
  wheel?: 'hover' | 'focus' | 'off';
  /** Shift for 10x finer control. Default true. */
  fine?: boolean;
  /** Double-click (or double-tap) restores `defaultValue`. Default true. */
  resetOnDoubleClick?: boolean;
  /** Handle APG slider keys (arrows, Page Up/Down, Home, End). Default true. Turn off when the host already does. */
  keyboard?: boolean;
  /** Manage role="slider", tabindex and aria-value* on the host. Default true. Turn off when the host already does. */
  aria?: boolean;
  /** Text for aria-valuetext. Default: the value. */
  valueText?: (value: number) => string;
  /** Returns true while the control is disabled. */
  disabled?: () => boolean;
  /** Spring for programmatic and keyboard changes (motorised glide). Default `'glide'`. */
  glide?: SpringName | SpringParams;
  /** Default sound for detents when the skin does not set `--tr-sound-detent`. Default `'tick'`. */
  detentSound?: SoundProfile | 'none';
  /** Called whenever the user changes the value. Default: fires a native `input` event on the host. */
  onInput?: (value: number, source: InputSource) => void;
  /** Called when the user commits a value. Default: fires a native `change` event on the host. */
  onCommit?: (value: number) => void;
}

/** Visual state written to `data-tr-state`. */
export type ControlState = 'idle' | 'dragging' | 'settling';

interface Sample {
  t: number;
  p: number;
}

/**
 * Shared engine for continuous controls: value model, detents, inertia, wheel, keyboard, springs,
 * feedback and ARIA. {@link RotaryController} and {@link LinearController} add the geometry.
 *
 * Output on the host: `--tr-value-ratio` (0..1, the animated position), `data-tr-state`, and
 * `data-dragging` while a pointer is down.
 */
export abstract class ValueController {
  readonly host: HTMLElement;
  protected o: Required<
    Omit<ValueControllerOptions, 'detents' | 'value' | 'defaultValue' | 'valueText' | 'disabled' | 'onInput' | 'onCommit'>
  > &
    Pick<ValueControllerOptions, 'valueText' | 'disabled' | 'onInput' | 'onCommit'>;
  protected range: Range;
  protected detents: DetentSpec | null = null;
  /** Committed, quantized value. */
  protected model: number;
  protected defaultValue: number;
  /** Visible position, in value units. */
  protected display: Spring;
  /** Raw position under the hand, before detents. */
  protected raw = 0;
  protected pointerId: number | null = null;
  protected samples: Sample[] = [];
  protected state: ControlState = 'idle';
  private stopTicker: (() => void) | null = null;
  private lastIndex = 0;
  private pendingCommit = false;
  private wheelTimer = 0;
  private sounds: { detent: SoundProfile | 'none'; slide: SoundProfile | 'none'; pitch: number; pan: number } | null = null;
  protected slideVoice: SlideVoice | null = null;
  private connected = false;
  private written = { ratio: '', state: '' };

  constructor(host: HTMLElement & Partial<ControllerHost>, options: ValueControllerOptions = {}) {
    this.host = host;
    const min = options.min ?? 0;
    const max = options.max ?? 100;
    this.o = {
      min,
      max,
      step: options.step ?? 1,
      detentStrength: options.detentStrength ?? 0.6,
      detentWidth: options.detentWidth ?? (max - min) * 0.04,
      inertia: options.inertia ?? 0,
      wheel: options.wheel ?? 'hover',
      fine: options.fine ?? true,
      resetOnDoubleClick: options.resetOnDoubleClick ?? true,
      keyboard: options.keyboard ?? true,
      aria: options.aria ?? true,
      glide: options.glide ?? 'glide',
      detentSound: options.detentSound ?? 'tick',
      valueText: options.valueText,
      disabled: options.disabled,
      onInput: options.onInput,
      onCommit: options.onCommit,
    };
    this.range = { min, max, step: this.o.step };
    this.setDetents(options.detents);
    this.model = this.quantize(options.value ?? min);
    this.defaultValue = this.quantize(options.defaultValue ?? this.model);
    this.display = new Spring(this.model, this.o.glide, this.precision);
    this.raw = this.model;
    if (typeof host.addController === 'function') host.addController(this);
    else if (host.isConnected) this.hostConnected();
  }

  // -------------------------------------------------------------------------------------------
  // Public API

  /** Current value. Setting it moves the control with a motorised glide (no events). */
  get value(): number {
    return this.model;
  }

  set value(v: number) {
    this.sync({ value: v });
  }

  /** True while the user is dragging. */
  get dragging(): boolean {
    return this.pointerId !== null;
  }

  private synced = false;

  /**
   * Updates range and value from the host's own properties (call it from a component's `updated`).
   * The first call snaps; a later changed value glides there; while the user is dragging, outside
   * changes are ignored.
   */
  sync(next: { min?: number; max?: number; step?: number; value?: number; defaultValue?: number }): void {
    let rangeChanged = false;
    for (const k of ['min', 'max', 'step'] as const) {
      const v = next[k];
      if (v !== undefined && Number.isFinite(v) && v !== this.range[k]) {
        this.range[k] = v;
        this.o[k] = v;
        rangeChanged = true;
      }
    }
    if (next.defaultValue !== undefined) this.defaultValue = this.quantize(next.defaultValue);
    if (next.value !== undefined && !this.dragging) {
      const v = this.quantize(next.value);
      if (!this.synced) {
        // First sync after the host renders: take the value as the starting point, no glide in.
        this.model = v;
        this.raw = v;
        this.display.snap(v);
        this.write();
      } else if (v !== this.model || rangeChanged) {
        this.model = v;
        this.raw = v;
        this.animateTo(v, this.o.glide);
      }
      this.synced = true;
    } else if (rangeChanged) {
      this.write();
    }
    this.syncAria();
  }

  /** Changes detents at runtime. */
  setDetents(positions: 'steps' | readonly number[] | undefined): void {
    this.detents = positions
      ? { positions, strength: this.o.detentStrength, width: this.o.detentWidth }
      : null;
  }

  hostConnected(): void {
    if (this.connected) return;
    this.connected = true;
    const h = this.host;
    h.addEventListener('pointerdown', this.onPointerDown);
    h.addEventListener('pointermove', this.onPointerMove);
    h.addEventListener('pointerup', this.onPointerUp);
    h.addEventListener('pointercancel', this.onPointerCancel);
    h.addEventListener('lostpointercapture', this.onPointerCancel);
    h.addEventListener('wheel', this.onWheel, { passive: false });
    h.addEventListener('keydown', this.onKeyDown);
    h.addEventListener('dblclick', this.onDoubleClick);
    installWheelLatch();
    // Gestures belong to the control, not the page; selection and callouts would break drags.
    const s = h.style;
    if (!s.touchAction) s.touchAction = this.touchAction();
    if (!s.userSelect) s.userSelect = 'none';
    s.setProperty('-webkit-user-select', 'none');
    s.setProperty('-webkit-touch-callout', 'none');
    s.setProperty('-webkit-tap-highlight-color', 'transparent');
    this.syncAria();
    this.write(true);
  }

  hostDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    const h = this.host;
    h.removeEventListener('pointerdown', this.onPointerDown);
    h.removeEventListener('pointermove', this.onPointerMove);
    h.removeEventListener('pointerup', this.onPointerUp);
    h.removeEventListener('pointercancel', this.onPointerCancel);
    h.removeEventListener('lostpointercapture', this.onPointerCancel);
    h.removeEventListener('wheel', this.onWheel);
    h.removeEventListener('keydown', this.onKeyDown);
    h.removeEventListener('dblclick', this.onDoubleClick);
    this.stopAnimation();
    this.endSlide();
    clearTimeout(this.wheelTimer);
    // Removed or moved mid-gesture: finish it cleanly so no state or change event is left behind.
    if (this.pointerId !== null || this.state !== 'idle') {
      this.pointerId = null;
      this.following = false;
      this.samples = [];
      this.display.snap(this.model);
      this.state = 'idle';
      this.write();
      this.commit();
    }
  }

  /** Detaches every listener. Use for hosts that are not Lit elements. */
  destroy(): void {
    this.hostDisconnected();
  }

  // -------------------------------------------------------------------------------------------
  // Geometry hooks for subclasses

  /** CSS touch-action for the host. */
  protected abstract touchAction(): string;
  /** Called at pointer down after the default checks; returns false to ignore the press. */
  protected abstract beginDrag(e: PointerEvent): boolean;
  /** Converts a pointer move into a new raw position (value units). */
  protected abstract dragTo(e: PointerEvent): number;
  /** Converts a wheel event into [delta in value units, notched]. */
  protected abstract wheelDelta(e: WheelEvent): [number, boolean];
  /** Writes geometry-specific variables (e.g. --tr-angle) for a display value. */
  protected writeExtra(_display: number, _ratio: number): void {}
  /** Aria orientation, if any. */
  protected orientation(): 'horizontal' | 'vertical' | null {
    return null;
  }
  /** Endless controls (jog wheels) are not clamped. */
  protected get endless(): boolean {
    return false;
  }

  // -------------------------------------------------------------------------------------------
  // Value helpers

  protected get precision(): number {
    return Math.max(1e-6, (this.range.max - this.range.min) * 0.0002);
  }

  protected clamp(v: number): number {
    if (!Number.isFinite(v)) return this.range.min;
    if (this.endless) return v;
    return Math.min(this.range.max, Math.max(this.range.min, v));
  }

  protected quantize(v: number): number {
    v = this.clamp(v);
    const { min, step } = this.range;
    if (step > 0) v = Number((min + Math.round((v - min) / step) * step).toFixed(10));
    return this.clamp(v);
  }

  /** Step used by keys and notched wheels. */
  protected get keyStep(): number {
    return this.range.step > 0 ? this.range.step : (this.range.max - this.range.min) / 100;
  }

  protected get fineFactor(): number {
    return 0.1;
  }

  // -------------------------------------------------------------------------------------------
  // Output

  /** Writes CSS variables for the current display position. Only touches the DOM when they change. */
  protected write(force = false): void {
    const d = this.display.value;
    const { min, max } = this.range;
    const span = max - min || 1;
    let ratio = (d - min) / span;
    if (!this.endless) ratio = Math.min(1, Math.max(0, ratio));
    const r = (Math.abs(ratio) < 0.00005 ? 0 : ratio).toFixed(4);
    if (force || r !== this.written.ratio) {
      this.written.ratio = r;
      this.host.style.setProperty('--tr-value-ratio', r);
      this.writeExtra(d, ratio);
    }
    if (force || this.state !== this.written.state) {
      this.written.state = this.state;
      this.host.setAttribute('data-tr-state', this.state);
      this.host.toggleAttribute('data-dragging', this.state === 'dragging');
    }
  }

  protected syncAria(): void {
    if (!this.o.aria) return;
    const h = this.host;
    const set = (n: string, v: string | null) => {
      if (v === null) h.removeAttribute(n);
      else if (h.getAttribute(n) !== v) h.setAttribute(n, v);
    };
    if (!h.hasAttribute('role')) h.setAttribute('role', 'slider');
    const disabled = this.o.disabled?.() ?? false;
    set('aria-disabled', disabled ? 'true' : null);
    if (disabled) {
      if (h.getAttribute('tabindex') === '0') h.removeAttribute('tabindex');
    } else if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '0');
    if (!this.endless) {
      set('aria-valuemin', String(this.range.min));
      set('aria-valuemax', String(this.range.max));
    }
    set('aria-valuenow', String(this.model));
    set('aria-valuetext', this.o.valueText ? this.o.valueText(this.model) : null);
    const or = this.orientation();
    if (or) set('aria-orientation', or);
  }

  // -------------------------------------------------------------------------------------------
  // Value changes

  /** Applies a user-driven raw position: detents, clicks, quantize, input event. */
  protected setRaw(p: number, source: InputSource, follow = false): void {
    this.raw = this.clamp(p);
    const shown = this.clamp(applyDetents(this.raw, this.detents, this.range));
    if (follow) {
      this.display.target = shown;
      this.ensureAnimation();
    } else {
      this.display.snap(shown);
      this.write();
    }
    const idx = detentIndex(this.raw, this.detents, this.range);
    if (idx !== this.lastIndex) {
      this.lastIndex = idx;
      this.click(source);
    }
    // While held inside a notch, the value is the notch itself.
    let v = shown;
    if (this.detents) {
      const rest = restingPoint(this.raw, this.detents, this.range);
      if (this.detents.positions === 'steps' || rest !== this.raw) v = rest;
    }
    this.emitValue(this.quantize(v), source);
  }

  protected emitValue(v: number, source: InputSource): void {
    if (v === this.model) return;
    this.model = v;
    this.pendingCommit = true;
    this.syncAria();
    if (this.o.onInput) this.o.onInput(v, source);
    else this.host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  protected commit(): void {
    if (!this.pendingCommit) return;
    this.pendingCommit = false;
    if (this.o.onCommit) this.o.onCommit(this.model);
    else this.host.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  private click(_source: InputSource): void {
    const s = this.sounds ?? this.readSounds();
    if (s.detent === 'none') return;
    // Faster turns click more softly, like a real ratchet.
    const v = Math.abs(this.velocity());
    const span = this.range.max - this.range.min || 1;
    const intensity = Math.max(0.35, 1 - (v / span) * 0.25);
    feedback.play(s.detent, { intensity, pitch: s.pitch, pan: s.pan });
  }

  protected readSounds(rect?: DOMRect): { detent: SoundProfile | 'none'; slide: SoundProfile | 'none'; pitch: number; pan: number } {
    const d = soundFor(this.host, 'detent', this.detents ? this.o.detentSound : 'none');
    const sl = soundFor(this.host, 'slide', 'none');
    this.sounds = { detent: d.profile, slide: sl.profile, pitch: d.pitch, pan: rect ? panFor(rect) : 0 };
    return this.sounds;
  }

  // -------------------------------------------------------------------------------------------
  // Animation

  protected animateTo(target: number, spring: SpringName | SpringParams, velocity?: number): void {
    if (reducedMotion(this.host)) {
      this.display.snap(target);
      this.stopAnimation();
      this.state = 'idle';
      this.write();
      return;
    }
    this.display.params = spring;
    this.display.target = target;
    if (velocity !== undefined) this.display.velocity = velocity;
    if (!this.dragging) this.state = 'settling';
    this.write();
    this.ensureAnimation();
  }

  private ensureAnimation(): void {
    if (this.stopTicker) return;
    this.stopTicker = loop((dt) => {
      const moving = this.display.step(dt);
      if (!moving && !this.dragging) this.state = 'idle';
      this.write();
      if (!moving) this.stopTicker = null;
      return moving;
    });
  }

  protected stopAnimation(): void {
    this.stopTicker?.();
    this.stopTicker = null;
  }

  private coast(v: number): void {
    // Exponential friction; time constant grows with inertia (0.15 s .. 1.6 s).
    const tau = 0.15 + this.o.inertia * 1.45;
    const minV = (this.range.max - this.range.min || 1) * 0.02;
    this.state = 'settling';
    this.stopAnimation();
    this.stopTicker = loop((dt) => {
      v *= Math.exp(-dt / tau);
      let p = this.raw + v * dt;
      const clamped = this.clamp(p);
      if (clamped !== p) {
        // Hit the end stop: the part stops dead, with a bump.
        p = clamped;
        feedback.play(this.sounds?.detent && this.sounds.detent !== 'none' ? this.sounds.detent : 'tick', {
          intensity: Math.min(1, Math.abs(v) / (this.range.max - this.range.min || 1)),
        });
        v = 0;
      }
      this.setRaw(p, 'inertia');
      if (Math.abs(v) < minV) {
        this.stopTicker = null;
        this.settle(v);
        return false;
      }
      return true;
    });
  }

  /** Lets the part come to rest: into the nearest notch, or onto the quantized value. */
  protected settle(velocity = 0): void {
    const rest = this.quantize(restingPoint(this.raw, this.detents, this.range));
    this.raw = rest;
    this.emitValue(rest, 'pointer');
    this.commit();
    this.animateTo(rest, 'detent', velocity);
  }

  // -------------------------------------------------------------------------------------------
  // Velocity

  protected record(p: number, t: number): void {
    this.samples.push({ t, p });
    while (this.samples.length > 2 && t - this.samples[0]!.t > 80) this.samples.shift();
  }

  /** Value units per second over the last ~80 ms. */
  protected velocity(now = performance.now()): number {
    const s = this.samples;
    if (s.length < 2) return 0;
    const a = s[0]!;
    const b = s[s.length - 1]!;
    // A finger that stopped before lifting has no momentum.
    if (now - b.t > 60) return 0;
    const dt = (b.t - a.t) / 1000;
    return dt > 0.008 ? (b.p - a.p) / dt : 0;
  }

  // -------------------------------------------------------------------------------------------
  // Events

  private isDisabled(): boolean {
    return this.o.disabled?.() ?? false;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.isDisabled() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!this.beginDrag(e)) return;
    this.pointerId = e.pointerId;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events in tests */
    }
    // Focus without scrolling, so keyboard continues where the hand left off.
    if (document.activeElement !== this.host && !this.host.contains(document.activeElement)) {
      this.host.focus({ preventScroll: true });
    }
    e.preventDefault();
    this.stopAnimation();
    this.raw = this.display.value;
    this.display.snap(this.display.value);
    this.lastIndex = detentIndex(this.raw, this.detents, this.range);
    this.samples = [];
    this.record(this.raw, e.timeStamp);
    this.readSounds(this.gestureRect);
    this.state = 'dragging';
    this.write();
    this.afterGrab(e);
  };

  /** Hook right after a grab is set up (a track press starts the cap moving here). */
  protected afterGrab(_e: PointerEvent): void {}

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    // Coalesced events give the true path between frames: better velocity, smoother detents.
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = events.length ? events : [e];
    // Coalesced events give the true path between frames for velocity; the value and events are
    // applied once per frame with the latest position.
    let p = this.raw;
    for (const ev of list) {
      p = this.clamp(this.dragTo(ev));
      this.raw = p;
      this.record(p, ev.timeStamp);
    }
    this.setRaw(p, 'pointer', this.following);
    this.onDragMove(e);
  };

  /** The host's rect, read once at pointer down by the subclass (no layout reads during a drag). */
  protected gestureRect: DOMRect | undefined;

  /** True while the display chases the hand with a spring instead of tracking it 1:1. */
  protected following = false;

  /** Hook after a pointer move (slide sound etc.). */
  protected onDragMove(_e: PointerEvent): void {}

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.endDrag(e.timeStamp, true);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.endDrag(e.timeStamp, false);
  };

  protected endDrag(t: number, allowInertia: boolean): void {
    this.pointerId = null;
    this.following = false;
    this.endSlide();
    const v = this.velocity(t);
    this.samples = [];
    this.sounds = null;
    if (allowInertia && this.o.inertia > 0 && !reducedMotion(this.host) && Math.abs(v) > (this.range.max - this.range.min || 1) * 0.1) {
      this.coast(v);
    } else {
      this.settle(this.detents ? v * 0.3 : 0);
    }
  }

  protected endSlide(): void {
    this.slideVoice?.stop();
    this.slideVoice = null;
  }

  private onWheel = (e: WheelEvent): void => {
    if (this.o.wheel === 'off' || this.isDisabled() || this.dragging) return;
    if (this.o.wheel === 'focus' && document.activeElement !== this.host && !this.host.contains(document.activeElement)) return;
    if (!claimWheel(this.host, e)) return;
    e.preventDefault();
    const [delta, notched] = this.wheelDelta(e);
    if (!delta) return;
    if (!this.sounds) this.readSounds(this.host.getBoundingClientRect());
    if (notched) {
      const target = this.quantize(this.model + Math.sign(delta) * this.keyStep * Math.max(1, Math.round(Math.abs(delta))));
      this.raw = target;
      const idx = detentIndex(target, this.detents, this.range);
      if (idx !== this.lastIndex) {
        this.lastIndex = idx;
        this.click('wheel');
      }
      this.emitValue(target, 'wheel');
      this.animateTo(target, 'detent');
    } else {
      const scale = this.o.fine && e.shiftKey ? this.fineFactor : 1;
      this.stopAnimation();
      this.state = 'dragging';
      this.setRaw(this.raw + delta * scale, 'wheel');
    }
    clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => {
      this.sounds = null;
      if (!notched) this.settle();
      else this.commit();
    }, 220);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.o.keyboard || this.isDisabled() || e.target !== this.host || e.altKey || e.ctrlKey || e.metaKey) return;
    const span = this.range.max - this.range.min;
    const big = Math.max(this.keyStep, span / 10);
    const step = this.o.fine && e.shiftKey && this.range.step === 0 ? this.keyStep * this.fineFactor : this.keyStep;
    const or = this.orientation();
    // Only horizontal linear controls mirror in RTL; a knob turns clockwise for ArrowRight everywhere.
    const rtl = or === 'horizontal' && getComputedStyle(this.host).direction === 'rtl';
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowUp':
        next = this.model + step;
        break;
      case 'ArrowDown':
        next = this.model - step;
        break;
      case 'ArrowRight':
        next = this.model + (rtl ? -step : step);
        break;
      case 'ArrowLeft':
        next = this.model + (rtl ? step : -step);
        break;
      case 'PageUp':
        next = this.model + big;
        break;
      case 'PageDown':
        next = this.model - big;
        break;
      case 'Home':
        if (!this.endless) next = this.range.min;
        break;
      case 'End':
        if (!this.endless) next = this.range.max;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    if (!this.sounds) this.readSounds(this.host.getBoundingClientRect());
    const v = this.quantize(next);
    const idx = detentIndex(v, this.detents, this.range);
    if (idx !== this.lastIndex) {
      this.lastIndex = idx;
      this.click('keyboard');
    }
    this.raw = v;
    this.emitValue(v, 'keyboard');
    this.commit();
    this.animateTo(v, e.repeat ? 'detent' : this.o.glide);
  };

  private onDoubleClick = (e: MouseEvent): void => {
    if (!this.o.resetOnDoubleClick || this.isDisabled()) return;
    e.preventDefault();
    const v = this.defaultValue;
    this.raw = v;
    this.lastIndex = detentIndex(v, this.detents, this.range);
    this.emitValue(v, 'reset');
    this.commit();
    this.animateTo(v, this.o.glide);
  };
}

// ---------------------------------------------------------------------------------------------
// Wheel latching: a page scroll that passes over a knob must keep scrolling the page.

const LATCH_MS = 320;
let latchHost: Element | null = null;
let latchTime = 0;
let latchInstalled = false;
const claimed = new WeakSet<Event>();

function installWheelLatch(): void {
  if (latchInstalled || typeof window === 'undefined') return;
  latchInstalled = true;
  // Runs after the control's own listener (bubble phase on window), recording who owns the gesture.
  window.addEventListener(
    'wheel',
    (e) => {
      if (!claimed.has(e)) latchHost = null;
      latchTime = e.timeStamp;
    },
    { passive: true },
  );
}

/** True when this wheel event may adjust `host` rather than scroll the page. */
function claimWheel(host: Element, e: WheelEvent): boolean {
  const inGesture = e.timeStamp - latchTime < LATCH_MS;
  if (inGesture && latchHost !== host) return false;
  latchHost = host;
  claimed.add(e);
  return true;
}
