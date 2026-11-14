import { feedback, panFor, soundFor } from './feedback.js';

interface ControllerHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void }): void;
}

export interface ToggleOptions {
  /** Current state. */
  checked: () => boolean;
  /** Flip the state (the component updates itself and fires its own events). */
  toggle: () => void;
  /** Direction of throw. Default `'horizontal'` (on = right, or left in RTL); vertical: on = up. */
  orientation?: 'horizontal' | 'vertical';
  /** The element that travels (thumb). Its box and the track's define the throw distance. */
  thumb?: () => Element | null;
  /** The element the thumb travels in. Default: the host. */
  track?: () => Element | null;
  /** Returns true while disabled. */
  disabled?: () => boolean;
}

/**
 * Drag-to-throw for switches, like a real over-centre toggle.
 *
 * Clicking still toggles through the component's own click handling. On top of that the thumb can
 * be grabbed and pushed: it resists inside its own half (a spring holds it), then snaps over once
 * pushed past the middle, and the switch flips at that moment, before the finger lifts. After a
 * drag, the click that the browser would send is swallowed so the switch does not flip twice.
 *
 * Output: `--tr-value-ratio` (0 = off, 1 = on) only while the hand is on the thumb, and
 * `data-dragging`. When it is removed the component's CSS takes the thumb to its resting place with
 * its usual transition (`--tr-motion-throw-*` tokens), so drag and click end the same way.
 */
export class ToggleController {
  readonly host: HTMLElement;
  private o: ToggleOptions;
  private pointerId: number | null = null;
  private startPos = 0;
  private travel = 1;
  private dir = 1;
  private dragged = false;
  private side = false;
  private connected = false;
  private rect: DOMRect | null = null;

  constructor(host: HTMLElement & Partial<ControllerHost>, options: ToggleOptions) {
    this.host = host;
    this.o = options;
    if (typeof host.addController === 'function') host.addController(this);
    else if (host.isConnected) this.hostConnected();
  }

  hostConnected(): void {
    if (this.connected) return;
    this.connected = true;
    this.host.addEventListener('pointerdown', this.onDown);
    this.host.addEventListener('change', this.onChange);
  }

  hostDisconnected(): void {
    if (!this.connected) return;
    this.connected = false;
    this.host.removeEventListener('pointerdown', this.onDown);
    this.host.removeEventListener('change', this.onChange);
    this.stop();
  }

  destroy(): void {
    this.hostDisconnected();
  }

  private pos(e: PointerEvent): number {
    return this.o.orientation === 'vertical' ? e.clientY : e.clientX;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.o.disabled?.() || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const track = this.o.track?.() ?? this.host;
    const thumb = this.o.thumb?.() ?? null;
    const tr = track.getBoundingClientRect();
    const th = thumb?.getBoundingClientRect();
    this.rect = tr;
    const vertical = this.o.orientation === 'vertical';
    const len = vertical ? tr.height : tr.width;
    const cap = th ? (vertical ? th.height : th.width) : len / 2;
    this.travel = Math.max(8, len - cap);
    this.dir = vertical ? -1 : getComputedStyle(this.host).direction === 'rtl' ? -1 : 1;
    this.startPos = this.pos(e);
    this.side = this.o.checked();
    this.dragged = false;
    this.pointerId = e.pointerId;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
    this.host.addEventListener('pointermove', this.onMove);
    this.host.addEventListener('pointerup', this.onUp);
    this.host.addEventListener('pointercancel', this.onUp);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const d = ((this.pos(e) - this.startPos) * this.dir) / this.travel;
    if (!this.dragged) {
      if (Math.abs(d * this.travel) < 4) return;
      this.dragged = true;
      this.host.toggleAttribute('data-dragging', true);
    }
    const hand = Math.max(0, Math.min(1, (this.side ? 1 : 0) + d));
    // Over-centre: past the middle (with a little hysteresis) the switch flips.
    if (!this.side && hand > 0.6) this.flip(true);
    else if (this.side && hand < 0.4) this.flip(false);
    // The thumb follows the hand, but a spring holds it toward its current side.
    const home = this.side ? 1 : 0;
    const shown = home + (hand - home) * 0.45;
    this.host.style.setProperty('--tr-value-ratio', shown.toFixed(4));
  };

  private flip(next: boolean): void {
    this.side = next;
    this.flipping = true;
    if (this.o.checked() !== next) this.o.toggle();
    this.flipping = false;
    this.play(0.9);
  }

  private flipping = false;
  private lastSound = 0;

  private play(intensity: number): void {
    const cfg = feedback.config;
    if (!cfg.sound && !cfg.haptics) return;
    const s = soundFor(this.host, 'toggle', 'latch');
    feedback.play(s.profile, { intensity, pitch: s.pitch, pan: this.rect ? panFor(this.rect) : 0 });
    this.lastSound = performance.now();
  }

  /** Click and keyboard toggles get the same sound as a throw. */
  private onChange = (e: Event): void => {
    if (e.target !== this.host || this.flipping) return;
    if (performance.now() - this.lastSound > 80) this.play(0.8);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const wasDragged = this.dragged;
    this.stop();
    if (wasDragged) {
      // Swallow the click that follows a drag, so the switch does not flip again.
      const swallow = (ev: Event) => {
        ev.stopImmediatePropagation();
        ev.preventDefault();
      };
      this.host.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => this.host.removeEventListener('click', swallow, { capture: true }), 0);
    }
  };

  private stop(): void {
    this.pointerId = null;
    this.dragged = false;
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerup', this.onUp);
    this.host.removeEventListener('pointercancel', this.onUp);
    this.host.style.removeProperty('--tr-value-ratio');
    this.host.removeAttribute('data-dragging');
  }
}
