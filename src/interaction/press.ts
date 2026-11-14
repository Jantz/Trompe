import { feedback, panFor, soundFor } from './feedback.js';

/** Minimal Lit ReactiveControllerHost shape. */
interface ControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void;
}

export interface PressOptions {
  /**
   * Shortest time the pressed state stays visible, in ms. A quick tap is over before the next frame
   * is painted, so without this a button gives no visual answer to a fast click. Default 90.
   */
  minPressMs?: number;
  /** Extra distance in px a touch may wander off the element before the press is cancelled. Default 12 (touch), 0 (mouse). */
  slop?: number;
  /** Space shows the press while held, Enter shows a tap. Default true. */
  keyboard?: boolean;
  /** Returns true while the control is disabled. */
  disabled?: () => boolean;
  /** Fires after this many ms of continuous pressing (touch and hold, context actions). */
  longPressMs?: number;
  /** Called once a press has been held for `longPressMs`. */
  /** Called once a touch or mouse press has been held for `longPressMs`. The click that would follow is swallowed. */
  onLongPress?: (e: PointerEvent) => void;
  /** Called when the press visual starts. */
  onPress?: () => void;
  /** Called when the press visual ends. `inside` is false when the pointer was dragged away (cancel). */
  onRelease?: (inside: boolean) => void;
}

/**
 * Physical press for anything clickable: buttons, icon buttons, cards, list rows, keys, tabs.
 *
 * It never changes what a click does (activation stays the native `click`); it only makes the press
 * visible and physical:
 *
 * - `data-tr-pressed` on the host while pressed, and `--tr-press: 1`. Components move the cap with
 *   `transform` and swap shadow layers (compositor-only), using the `--tr-motion-press-*` tokens.
 * - `--tr-press-x` / `--tr-press-y` (-1..1): where the finger landed, so a large card can tilt
 *   a fraction of a degree toward the contact point, like a panel on a soft mount.
 * - Quick taps stay visible for `minPressMs`. Dragging off the element un-presses it (and the
 *   native click will not fire), dragging back re-presses it, exactly like a native button.
 * - Space holds the press until key up; Enter shows a tap.
 */
export class PressController {
  readonly host: HTMLElement;
  private o: PressOptions & { minPressMs: number; keyboard: boolean };
  private pointerId: number | null = null;
  private rect: DOMRect | null = null;
  private slop = 0;
  private pressedAt = 0;
  private visual = false;
  private releaseTimer = 0;
  private longTimer = 0;
  private keyHeld = false;
  private connected = false;

  constructor(host: HTMLElement & Partial<ControllerHost>, options: PressOptions = {}) {
    this.host = host;
    this.o = { minPressMs: 90, keyboard: true, ...options };
    if (typeof host.addController === 'function') host.addController(this);
    else if (host.isConnected) this.hostConnected();
  }

  /** True while the press is visible. */
  get pressed(): boolean {
    return this.visual;
  }

  hostConnected(): void {
    if (this.connected) return;
    this.connected = true;
    this.host.addEventListener('pointerdown', this.onDown);
    this.host.addEventListener('keydown', this.onKeyDown);
    this.host.addEventListener('keyup', this.onKeyUp);
    this.host.addEventListener('focusout', this.onBlur);
    this.host.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  }

  hostDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    this.host.removeEventListener('pointerdown', this.onDown);
    this.host.removeEventListener('keydown', this.onKeyDown);
    this.host.removeEventListener('keyup', this.onKeyUp);
    this.host.removeEventListener('focusout', this.onBlur);
    this.stopTracking();
    clearTimeout(this.releaseTimer);
    clearTimeout(this.longTimer);
    this.setVisual(false, false);
  }

  destroy(): void {
    this.hostDisconnected();
  }

  // ---------------------------------------------------------------------------------------------

  private isDisabled(): boolean {
    return this.o.disabled?.() ?? false;
  }

  private setVisual(on: boolean, inside: boolean): void {
    if (on === this.visual) return;
    this.visual = on;
    const h = this.host;
    if (on) {
      h.setAttribute('data-tr-pressed', '');
      h.style.setProperty('--tr-press', '1');
      this.o.onPress?.();
    } else {
      h.removeAttribute('data-tr-pressed');
      h.style.removeProperty('--tr-press');
      this.o.onRelease?.(inside);
    }
  }

  private press(x: number, y: number): void {
    clearTimeout(this.releaseTimer);
    const r = this.rect;
    if (r && r.width && r.height) {
      const px = ((x - r.left) / r.width) * 2 - 1;
      const py = ((y - r.top) / r.height) * 2 - 1;
      this.host.style.setProperty('--tr-press-x', Math.max(-1, Math.min(1, px)).toFixed(3));
      this.host.style.setProperty('--tr-press-y', Math.max(-1, Math.min(1, py)).toFixed(3));
    }
    if (!this.visual) {
      this.pressedAt = performance.now();
      this.setVisual(true, true);
      this.sound('press', 'click', 0.8);
    }
  }

  /** Releases, keeping the press visible for at least minPressMs. */
  private release(inside: boolean): void {
    if (!this.visual) return;
    const wait = Math.max(0, this.o.minPressMs - (performance.now() - this.pressedAt));
    clearTimeout(this.releaseTimer);
    const done = () => {
      this.setVisual(false, inside);
      if (inside) this.sound('release', 'release', 0.6);
    };
    if (wait > 1 && inside) this.releaseTimer = window.setTimeout(done, wait);
    else done();
  }

  private sound(slot: 'press' | 'release', fallback: 'click' | 'release', intensity: number): void {
    const cfg = feedback.config;
    if (!cfg.sound && !cfg.haptics) return;
    const s = soundFor(this.host, slot, fallback);
    feedback.play(s.profile, { intensity, pitch: s.pitch, pan: this.rect ? panFor(this.rect) : 0, haptic: slot === 'press' });
  }

  private onDown = (e: PointerEvent): void => {
    if (this.isDisabled() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerId = e.pointerId;
    // The only layout read of the gesture.
    this.rect = this.host.getBoundingClientRect();
    this.slop = this.o.slop ?? (e.pointerType === 'mouse' ? 0 : 12);
    this.press(e.clientX, e.clientY);
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerup', this.onUp);
    addEventListener('pointercancel', this.onCancel);
    if (this.o.onLongPress && this.o.longPressMs) {
      clearTimeout(this.longTimer);
      this.longTimer = window.setTimeout(() => {
        if (!this.visual || this.pointerId !== e.pointerId) return;
        this.o.onLongPress?.(e);
        // A long press is its own action; the release must not also click.
        const swallow = (ev: Event) => {
          ev.stopImmediatePropagation();
          ev.preventDefault();
        };
        this.host.addEventListener('click', swallow, { capture: true, once: true });
        const drop = () => setTimeout(() => this.host.removeEventListener('click', swallow, { capture: true }), 0);
        addEventListener('pointerup', drop, { once: true });
        addEventListener('pointercancel', drop, { once: true });
      }, this.o.longPressMs);
    }
  };

  private inside(x: number, y: number): boolean {
    const r = this.rect;
    if (!r) return true;
    const s = this.slop;
    return x >= r.left - s && x <= r.right + s && y >= r.top - s && y <= r.bottom + s;
  }

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    if (this.inside(e.clientX, e.clientY)) this.press(e.clientX, e.clientY);
    else {
      clearTimeout(this.longTimer);
      this.release(false);
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.stopTracking();
    this.release(this.inside(e.clientX, e.clientY));
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    // The browser took the gesture (a scroll started): drop the press at once.
    this.stopTracking();
    clearTimeout(this.releaseTimer);
    this.setVisual(false, false);
  };

  private stopTracking(): void {
    this.pointerId = null;
    clearTimeout(this.longTimer);
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerup', this.onUp);
    removeEventListener('pointercancel', this.onCancel);
  }

  private keyTarget(e: KeyboardEvent): boolean {
    if (!this.o.keyboard || this.isDisabled()) return false;
    const t = e.composedPath()[0];
    // Typing a space in a field inside a card must not press the card.
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false;
    return t === this.host || e.target === this.host;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || !this.keyTarget(e)) return;
    if (e.key === ' ') {
      this.keyHeld = true;
      this.rect = null;
      this.host.style.removeProperty('--tr-press-x');
      this.host.style.removeProperty('--tr-press-y');
      this.press(0, 0);
    } else if (e.key === 'Enter') {
      this.rect = null;
      this.press(0, 0);
      this.release(true);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== ' ' || !this.keyHeld) return;
    this.keyHeld = false;
    this.release(true);
  };

  private onBlur = (): void => {
    if (!this.keyHeld) return;
    this.keyHeld = false;
    this.release(false);
  };
}
