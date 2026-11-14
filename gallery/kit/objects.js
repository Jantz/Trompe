/*
  Trompe object gallery kit: interaction controllers and tactile feedback.

  The API mirrors the interaction layer being built in src/interaction/ (foundation
  branch), so pages can move to it by changing the import:

    new RotaryController(host, { min, max, step, value, sweep, detents, detentStrength,
                                 inertia, endless, perTurn, wheel, fine, resetOnDoubleClick,
                                 drag, sound, haptic, valueText, onInput, onChange })
    new LinearController(host, { min, max, step, value, orientation, track, grab,
                                 trackClick, returnTo, detents, sound, haptic, ... })
    new PressController(host,  { mode: 'momentary'|'latching', group, phases, minPressMs,
                                 holdMs, sound, soundUp, haptic, onPress, onPhase })
    new ToggleController(host, { positions: 2|3, value, axis, overCenter, sound, ... })
    feedback.configure({ sound, haptics, volume }); feedback.play(profile, { intensity, pitch })

  Controllers only write state to their host:
    CSS   --tr-value-ratio (0..1, animated display value), --tr-angle (deg), --tr-press (0..1)
    attrs data-tr-state="idle|pressed|dragging|settling", data-tr-phase, data-dragging,
          aria-valuenow / aria-valuetext / aria-pressed / aria-checked
    events native `input` and `change` (bubbling, composed); read host.value.

  Gallery-only extras: mountBar() for the shared top bar with the light dial and the
  sound switch, and extra sound profiles (key, plug, shutter, paper, snap, beep, flip).
*/

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem("trompe-gallery:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("trompe-gallery:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ------------------------------------------------------------------ */
/* Frame scheduler: one rAF for every animating control on the page.   */
/* ------------------------------------------------------------------ */
const tickers = new Set();
let rafId = 0, lastT = 0;
function loop(t) {
  // __trompeTimeScale (0 freezes) lets motion checks hold every spring on its first frame.
  const dt = (Math.min(0.05, (t - (lastT || t)) / 1000) || 1 / 60) * (globalThis.__trompeTimeScale ?? 1);
  lastT = t;
  for (const fn of [...tickers]) if (fn(dt) === false) tickers.delete(fn);
  rafId = tickers.size ? requestAnimationFrame(loop) : 0;
  if (!rafId) lastT = 0;
}
export function animate(fn) { tickers.add(fn); if (!rafId) rafId = requestAnimationFrame(loop); return () => tickers.delete(fn); }

/**
 * Runs a DOM change as a view transition, so nothing on the page jumps: what leaves fades
 * out, what arrives fades in, and every element with a view-transition-name glides from its
 * old box to its new one (name the regions a change reflows, such as the block below a pane
 * that changes height). Instant under reduced motion or without the API. Resolves when done.
 */
export function morph(update) {
  if (reduceMotion.matches || !document.startViewTransition || document.visibilityState === "hidden") { update(); return Promise.resolve(); }
  // One transition at a time: changes that arrive while one plays are batched into the next,
  // instead of skipping the running one.
  if (morphBusy) { morphQueue.push(update); return morphBusy.then(() => morphNext); }
  const vt = document.startViewTransition(update);
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  morphBusy = vt.finished.catch(() => {}).then(() => {
    morphBusy = null;
    morphNext = null;
    if (morphQueue.length) { const q = morphQueue; morphQueue = []; morphNext = morph(() => q.forEach((u) => u())); }
  });
  return morphBusy;
}
let morphBusy = null, morphQueue = [], morphNext = null;

/**
 * Swaps an element's text: the old text fades out, then the new one fades in while the box eases
 * to its new width, so no part of the change is instant. Rapid calls end on the latest text.
 */
const swapping = new WeakMap();
export function swapText(el, text) {
  if (!el) return;
  const pending = swapping.get(el);
  if (pending) { pending.text = text; return; }
  if (el.textContent === text) return;
  if (reduceMotion.matches || !el.isConnected) { el.textContent = text; return; }
  const job = { text };
  swapping.set(el, job);
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: "ease-in", fill: "forwards" }).finished.then((out) => {
    swapping.delete(el);
    const w0 = el.getBoundingClientRect().width;
    el.textContent = job.text;
    const w1 = el.getBoundingClientRect().width;
    out.cancel();
    el.animate([{ opacity: 0, filter: "blur(2px)" }, { opacity: 1, filter: "none" }], { duration: 180, easing: "ease-out" });
    if (Math.abs(w1 - w0) > 0.5 && getComputedStyle(el).display !== "inline")
      el.animate([{ width: w0 + "px" }, { width: w1 + "px" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, () => swapping.delete(el));
}

/* Critically-ish damped spring. zeta < 1 overshoots a little, which is what sells a snap. */
function springStep(s, target, dt, k = 520, zeta = 0.72) {
  if (reduceMotion.matches) { s.x = target; s.v = 0; return true; }
  const c = 2 * Math.sqrt(k) * zeta;
  const steps = Math.ceil(dt / (1 / 240));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) { const a = -k * (s.x - target) - c * s.v; s.v += a * h; s.x += s.v * h; }
  if (Math.abs(s.x - target) < 1e-4 && Math.abs(s.v) < 1e-3) { s.x = target; s.v = 0; return true; }
  return false;
}

/* ------------------------------------------------------------------ */
/* Feedback: procedural sound + haptics                                */
/* ------------------------------------------------------------------ */
// Each profile is a recipe for a short synthesized sound: filtered noise bursts for
// mechanical contact, short decaying sines for body resonance. Nothing is sampled.
const PROFILES = {
  tick:    { parts: [{ n: 0.004, f: 5200, q: 1.4, g: 0.35 }], vib: 4 },
  detent:  { parts: [{ n: 0.006, f: 2600, q: 1.2, g: 0.5 }, { s: 240, d: 0.02, g: 0.18 }], vib: 8 },
  click:   { parts: [{ n: 0.005, f: 3600, q: 1, g: 0.55 }, { s: 420, d: 0.025, g: 0.12 }], vib: 10 },
  clack:   { parts: [{ n: 0.008, f: 1800, q: 0.9, g: 0.5 }, { s: 160, d: 0.04, g: 0.2 }], vib: 12 },
  latch:   { parts: [{ n: 0.004, f: 4200, q: 1.3, g: 0.6 }, { n: 0.006, f: 2200, q: 1, g: 0.5, at: 0.014 }, { s: 300, d: 0.03, g: 0.12, at: 0.014 }], vib: [8, 20, 10] },
  thunk:   { parts: [{ n: 0.012, f: 900, q: 0.8, g: 0.6 }, { s: 95, d: 0.09, g: 0.45 }], vib: 22 },
  slide:   { parts: [{ n: 0.03, f: 2400, q: 0.5, g: 0.12, hp: 900 }], vib: 0 },
  key:     { parts: [{ n: 0.006, f: 2400, q: 0.9, g: 0.45 }, { s: 180, d: 0.035, g: 0.32 }, { n: 0.01, f: 900, q: 0.7, g: 0.35, at: 0.004 }], vib: 9 },
  keyUp:   { parts: [{ n: 0.004, f: 3000, q: 1, g: 0.22 }, { s: 260, d: 0.02, g: 0.08 }], vib: 0 },
  plug:    { parts: [{ n: 0.004, f: 4800, q: 2, g: 0.5 }, { s: 3150, d: 0.09, g: 0.05 }, { n: 0.01, f: 1400, q: 1, g: 0.4, at: 0.018 }], vib: [6, 30, 12] },
  unplug:  { parts: [{ n: 0.01, f: 1600, q: 1, g: 0.45 }, { n: 0.004, f: 5200, q: 2, g: 0.35, at: 0.02 }], vib: 10 },
  shutter: { parts: [{ n: 0.005, f: 3800, q: 1.2, g: 0.7 }, { s: 520, d: 0.02, g: 0.12 }, { n: 0.012, f: 1500, q: 0.8, g: 0.6, at: 0.045 }, { s: 140, d: 0.05, g: 0.25, at: 0.045 }], vib: [12, 35, 16] },
  paper:   { parts: [{ n: 0.09, f: 3200, q: 0.4, g: 0.18, hp: 1200, env: "swell" }], vib: 0 },
  snap:    { parts: [{ n: 0.003, f: 6000, q: 1.5, g: 0.7 }, { s: 900, d: 0.02, g: 0.12 }, { n: 0.008, f: 1200, q: 0.8, g: 0.35, at: 0.006 }], vib: 14 },
  flip:    { parts: [{ n: 0.02, f: 2200, q: 0.6, g: 0.25, hp: 700, env: "swell" }, { n: 0.004, f: 3800, q: 1.3, g: 0.35, at: 0.03 }], vib: 6 },
  beep:    { parts: [{ s: 2800, d: 0.05, g: 0.08, sq: true }, { s: 2800, d: 0.05, g: 0.08, sq: true, at: 0.085 }], vib: 0 },
  hum:     { parts: [{ s: 100, d: 0.25, g: 0.05 }, { s: 50, d: 0.3, g: 0.06 }], vib: 0 },
};

export const feedback = {
  sound: false, haptics: false, volume: 0.6,
  _ctx: null, _noise: null, _last: new Map(),
  configure(o = {}) { Object.assign(this, o); },
  /** Register or replace a profile at runtime (gallery extension). */
  define(name, recipe) { PROFILES[name] = recipe; },
  _ensure() {
    if (this._ctx) return this._ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: "interactive" });
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    this._out = ctx.createDynamicsCompressor();
    this._out.threshold.value = -18; this._out.ratio.value = 4;
    this._out.connect(ctx.destination);
    this._ctx = ctx;
    return ctx;
  },
  play(profile, { intensity = 1, pitch = 1, minGapMs = 14 } = {}) {
    const p = PROFILES[profile];
    if (!p) return;
    const now = performance.now();
    if (now - (this._last.get(profile) || 0) < minGapMs) return; // fast spins: don't machine-gun
    this._last.set(profile, now);
    if (this.haptics && p.vib && navigator.vibrate) navigator.vibrate(p.vib);
    if (!this.sound || document.hidden) return;
    const ctx = this._ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.002;
    const jitter = 1 + (Math.random() - 0.5) * 0.08; // no two clicks identical
    const vol = this.volume * clamp(intensity, 0.05, 1.5);
    for (const part of p.parts) {
      const t = t0 + (part.at || 0);
      const g = ctx.createGain();
      g.connect(this._out);
      if (part.n) {
        const src = ctx.createBufferSource();
        src.buffer = this._noise;
        src.playbackRate.value = jitter;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = part.f * pitch * jitter; bp.Q.value = part.q;
        let node = src.connect(bp);
        if (part.hp) { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = part.hp; node = node.connect(hp); }
        node.connect(g);
        const peak = part.g * vol;
        if (part.env === "swell") {
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + part.n * 0.4);
          g.gain.exponentialRampToValueAtTime(0.0001, t + part.n);
        } else {
          g.gain.setValueAtTime(peak, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + part.n * 3);
        }
        src.start(t, Math.random() * 0.15); src.stop(t + part.n * 3 + 0.02);
      } else if (part.s) {
        const o = ctx.createOscillator();
        o.type = part.sq ? "square" : "sine";
        o.frequency.setValueAtTime(part.s * pitch * jitter, t);
        if (!part.sq) o.frequency.exponentialRampToValueAtTime(part.s * pitch * 0.7, t + part.d);
        o.connect(g);
        g.gain.setValueAtTime(part.g * vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + part.d);
        o.start(t); o.stop(t + part.d + 0.02);
      }
    }
  },
};

/* ------------------------------------------------------------------ */
/* Shared value model                                                  */
/* ------------------------------------------------------------------ */
class ValueModel {
  constructor(host, o) {
    this.host = host;
    this.o = o;
    this.min = o.min ?? 0; this.max = o.max ?? 1; this.step = o.step ?? 0;
    this.default = o.value ?? this.min;
    this._value = this._clampQ(this.default);
    this.disp = { x: this._value, v: 0 };
    this._anim = null;
    Object.defineProperty(host, "value", {
      configurable: true,
      get: () => this._value,
      set: (v) => this.set(v, { animate: true, emit: false }),
    });
  }
  get range() { return this.max - this.min || 1; }
  get value() { return this._value; }
  set value(v) { this.set(v, { animate: true, emit: false }); }
  _quant(v) {
    const d = this.o.detents;
    if (Array.isArray(d) && d.length) return d.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    if (this.step > 0) return this.min + Math.round((v - this.min) / this.step) * this.step;
    return v;
  }
  _clampQ(v) { return this.o.endless ? this._quant(v) : clamp(this._quant(v), this.min, this.max); }
  ratio(v) {
    if (this.o.endless) return ((v - this.min) / this.range) % 1;
    return (v - this.min) / this.range;
  }
  set(v, { animate: anim = true, emit = true, commit = false, intensity = 1 } = {}) {
    const q = this._clampQ(v);
    const changed = q !== this._value;
    if (changed) {
      this._value = q;
      this._aria();
      if (emit) {
        this._detentFeedback(intensity);
        this.host.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        this.o.onInput?.(q);
      }
    }
    if (commit && emit) this.commit();
    if (anim) this.glide(); else { this.disp.x = q; this.disp.v = 0; this.render(); }
    return changed;
  }
  commit() {
    if (this._committed === this._value) return;
    this._committed = this._value;
    this.host.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    this.o.onChange?.(this._value);
  }
  _detentFeedback(intensity) {
    // `sound: null` (or any unknown name) silences value clicks; omit it for the default.
    const snd = "sound" in this.o ? this.o.sound : ((this.step || this.o.detents) ? "detent" : null);
    if (snd) feedback.play(snd, { intensity, pitch: this.o.soundPitch ?? 1 });
  }
  glide() {
    if (this._anim) return;
    this.host.dataset.trState = "settling";
    this._anim = animate((dt) => {
      // Aim at the live value, so a key press during a settle retargets instead of being lost.
      const done = springStep(this.disp, this._value, dt, this.o.springK ?? 520, this.o.springZeta ?? 0.72);
      this.render();
      if (done) { this._anim = null; if (this.host.dataset.trState === "settling") this.host.dataset.trState = "idle"; return false; }
    });
  }
  render() {}
  _aria() {
    const h = this.host;
    h.setAttribute("aria-valuenow", String(+this._value.toFixed(4)));
    const txt = this.o.valueText?.(this._value);
    if (txt != null) h.setAttribute("aria-valuetext", txt);
  }
  _keys(e, big) {
    if (this.host.getAttribute("aria-disabled") === "true") return;
    this._stopInertia?.(); // keyboard input wins over a coasting flick
    const s = this.step || (this.o.detents ? 0 : this.range / 100);
    let v = this._value, handled = true;
    const fine = e.shiftKey && !this.step ? 0.1 : 1;
    const d = this.o.detents;
    const idx = Array.isArray(d) ? d.indexOf(this._value) : -1;
    const stepBy = (n) => (idx >= 0 ? d[clamp(idx + n, 0, d.length - 1)] : v + n * s * fine);
    switch (e.key) {
      case "ArrowUp": case "ArrowRight": v = stepBy(1); break;
      case "ArrowDown": case "ArrowLeft": v = stepBy(-1); break;
      case "PageUp": v = stepBy(big); break;
      case "PageDown": v = stepBy(-big); break;
      case "Home": if (this.o.endless) handled = false; else v = this.min; break;
      case "End": if (this.o.endless) handled = false; else v = this.max; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    this.set(v, { commit: true });
  }
}

/* ------------------------------------------------------------------ */
/* RotaryController: knobs, dials, encoders, jog/flywheels             */
/* ------------------------------------------------------------------ */
export class RotaryController extends ValueModel {
  constructor(host, o = {}) {
    super(host, { sweep: 270, detentStrength: 0.85, inertia: 0, wheel: "hover", fine: "shift", resetOnDoubleClick: true, drag: "rotate", ...o });
    this._raw = this._value;
    this.hostConnected();
  }
  hostConnected() {
    const h = this.host;
    if (!h.hasAttribute("role")) h.setAttribute("role", "slider");
    if (!h.hasAttribute("tabindex")) h.tabIndex = 0;
    if (!this.o.endless) { h.setAttribute("aria-valuemin", this.min); h.setAttribute("aria-valuemax", this.max); }
    h.dataset.trDrag = ""; h.dataset.trState = "idle";
    this._aria(); this.render();
    this._on = [
      ["pointerdown", (e) => this._down(e)],
      ["keydown", (e) => this._keys(e, this.o.bigStep ?? 10)],
      ["wheel", (e) => this._wheel(e), { passive: false }],
      ["dblclick", () => this.o.resetOnDoubleClick && !this.o.endless && this.set(this.default, { commit: true })],
    ];
    for (const [t, f, opt] of this._on) h.addEventListener(t, f, opt);
  }
  hostDisconnected() { for (const [t, f, opt] of this._on || []) this.host.removeEventListener(t, f, opt); this._stopInertia?.(); }
  destroy() { this.hostDisconnected(); }
  /** Degrees of rotation per value unit. */
  get degPerUnit() { return this.o.endless ? 360 / (this.o.perTurn ?? this.range) : this.o.sweep / this.range; }
  angleOf(v) { return this.o.endless ? (v - this.min) * this.degPerUnit : -this.o.sweep / 2 + (v - this.min) * this.degPerUnit; }
  render() {
    const x = this.disp.x;
    this.host.style.setProperty("--tr-angle", this.angleOf(x).toFixed(2) + "deg");
    this.host.style.setProperty("--tr-value-ratio", this.ratio(x).toFixed(4));
  }
  _center() {
    const el = this.o.pivot?.() || this.host;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 };
  }
  _down(e) {
    if (e.button !== 0 || this.host.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    this.host.focus({ preventScroll: true, focusVisible: false });
    this._stopInertia?.();
    const h = this.host, c = this._center();
    const mode = this.o.drag === "auto" ? (Math.hypot(e.clientX - c.x, e.clientY - c.y) > c.r * 0.3 ? "rotate" : "vertical") : this.o.drag;
    let lastA = Math.atan2(e.clientY - c.y, e.clientX - c.x), lastY = e.clientY;
    this._raw = this._value;
    const hist = [];
    h.setPointerCapture(e.pointerId);
    h.dataset.dragging = ""; h.dataset.trState = "dragging";
    const move = (ev) => {
      let dUnits;
      const fine = ev.shiftKey && this.o.fine === "shift" ? 0.2 : 1;
      if (mode === "rotate") {
        const a = Math.atan2(ev.clientY - c.y, ev.clientX - c.x);
        let da = a - lastA;
        if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        lastA = a;
        // Close to the centre the angle is noisy; damp it.
        const dist = Math.hypot(ev.clientX - c.x, ev.clientY - c.y);
        if (dist < c.r * 0.18) da *= dist / (c.r * 0.18);
        dUnits = (da * 180 / Math.PI) / this.degPerUnit;
      } else {
        const dy = lastY - ev.clientY; lastY = ev.clientY;
        dUnits = dy * (this.range / (this.o.dragPx ?? 220));
      }
      dUnits *= fine;
      this._raw += dUnits;
      if (!this.o.endless) this._raw = clamp(this._raw, this.min - this.range * 0.02, this.max + this.range * 0.02);
      const t = performance.now();
      hist.push([t, this._raw]); while (hist.length && t - hist[0][0] > 90) hist.shift();
      const speed = hist.length > 1 ? Math.abs(hist.at(-1)[1] - hist[0][1]) / ((hist.at(-1)[0] - hist[0][0]) || 1) * 1000 / this.range : 0;
      this.set(this._raw, { animate: false, intensity: clamp(0.5 + speed * 0.4, 0.35, 1.2) });
      this._tension();
    };
    const up = (ev) => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      delete h.dataset.dragging;
      const t = performance.now();
      while (hist.length && t - hist[0][0] > 90) hist.shift();
      const vel = hist.length > 1 ? (hist.at(-1)[1] - hist[0][1]) / Math.max(16, hist.at(-1)[0] - hist[0][0]) * 1000 : 0;
      if (this.o.inertia > 0 && !reduceMotion.matches && Math.abs(vel) > this.range * 0.05) this._fling(vel);
      else { this.commit(); this.glide(); }
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
  /* While dragging, the display value sits between the raw finger position and the detent,
     so you feel the knob straining toward the next click before it snaps. */
  _tension() {
    const s = this.o.detentStrength;
    const quantized = this.step > 0 || Array.isArray(this.o.detents);
    const target = quantized ? this._value + (this._raw - this._value) * (1 - s) : this._raw;
    this.disp.x = this.o.endless ? target : clamp(target, this.min - this.range * 0.01, this.max + this.range * 0.01);
    this.disp.v = 0;
    this.render();
  }
  _fling(vel) {
    let v = vel;
    const friction = 0.8 + 0.195 * clamp(this.o.inertia, 0, 1);
    this.host.dataset.trState = "settling";
    const stop = animate((dt) => {
      v *= Math.pow(friction, dt * 60);
      this._raw += v * dt;
      if (!this.o.endless && (this._raw <= this.min || this._raw >= this.max)) { this._raw = clamp(this._raw, this.min, this.max); v = 0; }
      this.set(this._raw, { animate: false, intensity: clamp(Math.abs(v) / this.range, 0.25, 1) });
      this._tension();
      if (Math.abs(v) < this.range * 0.01) { this._stopInertia = null; this.commit(); this.glide(); return false; }
    });
    this._stopInertia = () => { stop(); this._stopInertia = null; };
  }
  _wheel(e) {
    if (this.o.wheel === "off" || (this.o.wheel === "focus" && document.activeElement !== this.host)) return;
    e.preventDefault();
    this._wheelAcc = (this._wheelAcc || 0) + (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY);
    const quantized = this.step > 0 || Array.isArray(this.o.detents);
    if (quantized) {
      const notch = 40;
      while (Math.abs(this._wheelAcc) >= notch) {
        const dir = this._wheelAcc < 0 ? 1 : -1;
        this._wheelAcc -= -dir * notch;
        const d = this.o.detents, idx = Array.isArray(d) ? d.indexOf(this._value) : -1;
        const next = idx >= 0 ? d[clamp(idx + dir, 0, d.length - 1)] : this._value + dir * this.step;
        this.set(next, { commit: true });
      }
    } else {
      this.set(this._value - this._wheelAcc * this.range / 1500, { commit: true, animate: false });
      this._wheelAcc = 0;
    }
  }
}

/* ------------------------------------------------------------------ */
/* LinearController: faders, sliders, levers, drawers                  */
/* ------------------------------------------------------------------ */
export class LinearController extends ValueModel {
  constructor(host, o = {}) {
    super(host, { orientation: "horizontal", grab: "relative", trackClick: "jump", ...o });
    this.hostConnected();
  }
  hostConnected() {
    const h = this.host;
    if (!h.hasAttribute("role")) h.setAttribute("role", "slider");
    if (!h.hasAttribute("tabindex")) h.tabIndex = 0;
    h.setAttribute("aria-valuemin", this.min); h.setAttribute("aria-valuemax", this.max);
    h.setAttribute("aria-orientation", this.o.orientation);
    h.dataset.trDrag = ""; h.dataset.trState = "idle";
    this._aria(); this.render();
    this._on = [["pointerdown", (e) => this._down(e)], ["keydown", (e) => this._keys(e, this.o.bigStep ?? 10)],
      ["dblclick", () => this.o.resetOnDoubleClick && this.set(this.default, { commit: true })]];
    for (const [t, f] of this._on) h.addEventListener(t, f);
  }
  hostDisconnected() { for (const [t, f] of this._on || []) this.host.removeEventListener(t, f); }
  destroy() { this.hostDisconnected(); }
  render() { this.host.style.setProperty("--tr-value-ratio", this.ratio(this.disp.x).toFixed(4)); }
  _ratioAt(ev) {
    const r = (this.o.track?.() || this.host).getBoundingClientRect();
    const inset = this.o.inset ?? 0; // px of track at each end the thumb centre can't reach
    return this.o.orientation === "vertical"
      ? clamp(1 - (ev.clientY - r.top - inset) / (r.height - inset * 2), 0, 1)
      : clamp((ev.clientX - r.left - inset) / (r.width - inset * 2), 0, 1);
  }
  _down(e) {
    if (e.button !== 0 || this.host.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    this.host.focus({ preventScroll: true, focusVisible: false });
    const h = this.host;
    const thumb = this.o.thumb?.();
    const onThumb = thumb ? thumb.contains(e.target) : false; // no thumb part: whole host is track
    let offset = 0;
    if (!onThumb) {
      if (this.o.trackClick === "none") return;
      if (this.o.trackClick === "page") {
        const r = this._ratioAt(e), cur = this.ratio(this._value);
        this.set(this._value + Math.sign(r - cur) * (this.step || this.range / 10), { commit: true });
        return;
      }
      this.set(this.min + this._ratioAt(e) * this.range, { intensity: 0.8 });
    } else if (this.o.grab === "relative") {
      offset = this.ratio(this._value) - this._ratioAt(e);
    }
    h.setPointerCapture(e.pointerId);
    h.dataset.dragging = ""; h.dataset.trState = "dragging";
    feedback.play(this.o.grabSound ?? "tick", { intensity: 0.4 });
    let lastV = this._value, lastT = performance.now();
    const move = (ev) => {
      const r = clamp(this._ratioAt(ev) + offset, 0, 1);
      const raw = this.min + r * this.range;
      const t = performance.now();
      const speed = Math.abs(raw - lastV) / this.range / Math.max(1, t - lastT) * 1000;
      lastV = raw; lastT = t;
      this.set(raw, { animate: false, intensity: clamp(0.4 + speed * 0.3, 0.3, 1.1) });
      const q = this.step > 0 || Array.isArray(this.o.detents);
      this.disp.x = q ? this._value + (raw - this._value) * (1 - (this.o.detentStrength ?? 0.85)) : raw;
      this.disp.v = 0; this.render();
      if (this.o.slideSound && speed > 0.15) feedback.play(this.o.slideSound, { intensity: clamp(speed * 0.4, 0.1, 0.8), minGapMs: 45 });
    };
    const up = () => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      delete h.dataset.dragging;
      if (this.o.returnTo != null) {
        this.o.onRelease?.(this._value);
        this._value = this.o.returnTo; this._aria();
        this.host.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        this.commit();
        if (this.o.returnSound) feedback.play(this.o.returnSound);
      } else this.commit();
      this.glide();
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
}

/* ------------------------------------------------------------------ */
/* PressController: buttons, keys, shutter releases, piano keys        */
/* ------------------------------------------------------------------ */
const groups = new Map();
export class PressController {
  constructor(host, o = {}) {
    this.host = host;
    this.o = { mode: "momentary", minPressMs: 70, holdMs: 450, sound: "click", soundUp: null, ...o };
    this.press = { x: 0, v: 0 };
    this.phase = 0;
    this.pressed = this.o.mode === "latching" ? !!this.o.pressed : false;
    if (this.o.group) { if (!groups.has(this.o.group)) groups.set(this.o.group, new Set()); groups.get(this.o.group).add(this); }
    this.hostConnected();
  }
  hostConnected() {
    const h = this.host;
    if (h.tagName !== "BUTTON" && !h.hasAttribute("role")) h.setAttribute("role", "button");
    if (h.tagName !== "BUTTON" && !h.hasAttribute("tabindex")) h.tabIndex = 0;
    if (this.o.mode === "latching") h.setAttribute("aria-pressed", String(this.pressed));
    h.dataset.trState = "idle"; h.dataset.trPhase = "0";
    this._rest();
    this._on = [["pointerdown", (e) => this._down(e)], ["keydown", (e) => this._key(e, true)], ["keyup", (e) => this._key(e, false)], ["click", (e) => { if (this._suppressClick) { this._suppressClick = false; } else if (e.detail === 0 && !this._keyActive) this._activate(); }]];
    for (const [t, f] of this._on) h.addEventListener(t, f);
  }
  hostDisconnected() { for (const [t, f] of this._on || []) this.host.removeEventListener(t, f); this.o.group && groups.get(this.o.group)?.delete(this); }
  destroy() { this.hostDisconnected(); }
  get _restDepth() { return this.o.mode === "latching" && this.pressed ? (this.o.latchDepth ?? 0.55) : 0; }
  _rest() { this._to(this._restDepth); }
  _to(target, k) {
    this._target = target;
    if (this._anim) return;
    this._anim = animate((dt) => {
      const done = springStep(this.press, this._target, dt, k ?? this.o.springK ?? 900, this.o.springZeta ?? 0.6);
      this.host.style.setProperty("--tr-press", clamp(this.press.x, -0.1, 1.1).toFixed(4));
      if (done) { this._anim = null; return false; }
    });
  }
  _setPhase(p) {
    if (p === this.phase) return;
    this.phase = p; this.host.dataset.trPhase = String(p);
    this.o.onPhase?.(p);
  }
  _begin() {
    if (this.host.getAttribute("aria-disabled") === "true") return false;
    this._t0 = performance.now();
    this.host.dataset.trState = "pressed";
    const phases = this.o.phases;
    if (phases) {
      this._setPhase(1); this._to(phases[0]);
      feedback.play(this.o.halfSound ?? "tick", { intensity: 0.5 });
      clearTimeout(this._holdT);
      this._holdT = setTimeout(() => this._full(), this.o.holdMs);
    } else {
      this._to(1);
      feedback.play(this.o.sound);
      this.o.onPress?.(this);
    }
    return true;
  }
  _full() {
    if (!this.o.phases || this.phase >= 2) return;
    clearTimeout(this._holdT);
    this._setPhase(2); this._to(this.o.phases[1] ?? 1);
    feedback.play(this.o.sound);
    this.o.onPress?.(this);
  }
  _end(cancel) {
    clearTimeout(this._holdT);
    const elapsed = performance.now() - this._t0;
    const finish = () => {
      if (!cancel) {
        if (this.o.phases && this.phase < 2) this._full();
        this._activate(true);
      }
      this.host.dataset.trState = "settling";
      if (this.o.soundUp) feedback.play(this.o.soundUp, { intensity: 0.6 });
      this._rest();
      this._setPhase(0);
      setTimeout(() => { if (this.host.dataset.trState === "settling") this.host.dataset.trState = "idle"; }, 160);
    };
    // A quick tap still shows the full press: hold the bottom for minPressMs.
    if (this.o.phases && this.phase < 2 && !cancel) { this._full(); setTimeout(finish, this.o.minPressMs + 30); }
    else if (elapsed < this.o.minPressMs) setTimeout(finish, this.o.minPressMs - elapsed);
    else finish();
  }
  _activate(fromPointer) {
    if (this.host.getAttribute("aria-disabled") === "true" || this.host.disabled) return;
    if (this.o.mode === "latching") {
      if (this.o.group) {
        if (this.pressed && this.o.groupRequired !== false) { /* radio: stays down */ }
        else { for (const other of groups.get(this.o.group)) if (other !== this && other.pressed) other.setPressed(false, true); this.setPressed(true); }
      } else this.setPressed(!this.pressed);
    }
    this.o.onActivate?.(this, fromPointer);
  }
  setPressed(on, fromGroup) {
    if (this.o.mode !== "latching" || on === this.pressed) return;
    this.pressed = on;
    this.host.setAttribute("aria-pressed", String(on));
    if (fromGroup) feedback.play(this.o.releaseSound ?? "clack", { intensity: 0.5 });
    this._rest(); // move to the new resting depth (latched keys sit lower)
    this.host.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    this.o.onChange?.(on, this);
  }
  _down(e) {
    if (e.button !== 0) return;
    if (!this._begin()) return;
    const h = this.host;
    h.setPointerCapture?.(e.pointerId);
    const y0 = e.clientY;
    const move = (ev) => {
      // Pressing "deeper" (dragging down) completes a two-stage press, like pushing a shutter through.
      if (this.o.phases && ev.clientY - y0 > (this.o.deepPx ?? 8)) this._full();
      const r = h.getBoundingClientRect(), pad = 24;
      this._outside = ev.clientX < r.left - pad || ev.clientX > r.right + pad || ev.clientY < r.top - pad || ev.clientY > r.bottom + pad;
    };
    const up = (ev) => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      this._suppressClick = true;
      this._end(ev.type === "pointercancel" || this._outside);
      this._outside = false;
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
  /** Run a full press programmatically: travel down, activate, spring back. */
  press() {
    if (!this._begin()) return;
    setTimeout(() => this._end(false), this.o.minPressMs);
  }
  _key(e, down) {
    if (e.key !== " " && e.key !== "Enter") return;
    if (this.host.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    if (down) { if (!e.repeat && !this._keyActive) { this._keyActive = true; this._begin(); } }
    else if (this._keyActive) { this._keyActive = false; this._end(false); }
  }
}

/* ------------------------------------------------------------------ */
/* ToggleController: bat-handle toggles, rockers, slide switches       */
/* ------------------------------------------------------------------ */
export class ToggleController {
  constructor(host, o = {}) {
    this.host = host;
    this.o = { positions: 2, value: 0, axis: "y", overCenter: true, sound: "latch", dragPx: 36, ...o };
    this._value = this.o.value;
    this.disp = { x: this._value, v: 0 };
    Object.defineProperty(host, "value", { configurable: true, get: () => this._value, set: (v) => this.set(v, false) });
    this.hostConnected();
  }
  get n() { return this.o.positions; }
  get value() { return this._value; }
  hostConnected() {
    const h = this.host;
    if (!h.hasAttribute("role")) h.setAttribute("role", this.n === 2 ? "switch" : "slider");
    if (!h.hasAttribute("tabindex")) h.tabIndex = 0;
    if (this.n > 2) { h.setAttribute("aria-valuemin", 0); h.setAttribute("aria-valuemax", this.n - 1); }
    h.dataset.trDrag = ""; h.dataset.trState = "idle";
    this._aria(); this._render();
    this._on = [["pointerdown", (e) => this._down(e)], ["keydown", (e) => this._key(e)]];
    for (const [t, f] of this._on) h.addEventListener(t, f);
  }
  hostDisconnected() { for (const [t, f] of this._on || []) this.host.removeEventListener(t, f); }
  destroy() { this.hostDisconnected(); }
  _aria() {
    const h = this.host;
    if (this.n === 2) h.setAttribute("aria-checked", String(this._value === 1));
    else { h.setAttribute("aria-valuenow", this._value); const t = this.o.valueText?.(this._value); if (t) h.setAttribute("aria-valuetext", t); }
  }
  _render() { this.host.style.setProperty("--tr-value-ratio", (this.disp.x / (this.n - 1)).toFixed(4)); }
  set(v, emit = true) {
    v = clamp(Math.round(v), 0, this.n - 1);
    if (v !== this._value) {
      this._value = v; this._aria();
      if (emit) {
        feedback.play(this.o.sound);
        this.host.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        this.host.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        this.o.onChange?.(v);
      }
    }
    this._glide();
  }
  _glide() {
    if (this._anim) return;
    this._anim = animate((dt) => {
      // Over-centre springs throw fast and land with a small bounce.
      const done = springStep(this.disp, this._value, dt, this.o.springK ?? 1400, this.o.springZeta ?? 0.55);
      this._render();
      if (done) { this._anim = null; this.host.dataset.trState = "idle"; return false; }
    });
  }
  _key(e) {
    if (this.host.getAttribute("aria-disabled") === "true") return;
    const inc = this.o.axis === "y" ? ["ArrowUp", "ArrowDown"] : ["ArrowRight", "ArrowLeft"];
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); this.set(this.n === 2 ? 1 - this._value : (this._value + 1) % this.n); }
    else if (e.key === inc[0]) { e.preventDefault(); this.set(this._value + (this.o.invert ? -1 : 1)); }
    else if (e.key === inc[1]) { e.preventDefault(); this.set(this._value - (this.o.invert ? -1 : 1)); }
  }
  _down(e) {
    if (e.button !== 0 || this.host.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    const h = this.host;
    h.focus({ preventScroll: true, focusVisible: false });
    h.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, v: this._value };
    let moved = false;
    h.dataset.trState = "dragging";
    // Value 1 is up (axis y) or right (axis x); `invert` flips that.
    const sign = this.o.invert ? -1 : 1;
    const move = (ev) => {
      const d = (this.o.axis === "y" ? start.y - ev.clientY : ev.clientX - start.x) * sign;
      if (Math.abs(d) > 3) moved = true;
      const raw = clamp(start.v + d / this.o.dragPx, 0, this.n - 1);
      // Over-centre: the lever resists until past the midpoint, then throws itself home.
      const near = Math.round(raw);
      if (this.o.overCenter && near !== this._value) this.set(near);
      this.disp.x = near + (raw - near) * 0.35; this.disp.v = 0; this._render();
    };
    const up = () => {
      h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
      if (!moved) this.set(this.n === 2 ? 1 - this._value : (this._value + 1) % this.n);
      this._glide();
    };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
  }
}

/* ------------------------------------------------------------------ */
/* Gallery chrome                                                      */
/* ------------------------------------------------------------------ */
const ICON_SOUND_ON = '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const ICON_SOUND_OFF = '<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>';

/** Applies the saved light angle to the page. Call early to avoid a re-light on load. */
export function applySavedLight(fallback = 315) {
  const a = store.get("light", fallback);
  document.documentElement.style.setProperty("--tr-light-angle", a + "deg");
  return a;
}

/**
 * Mounts the shared gallery bar.
 * @param {{title: string, subtitle?: string, tone?: 'dark'|'light', light?: number, back?: string}} o
 */
export function mountBar(o) {
  const bar = document.createElement("header");
  bar.className = "tg-bar";
  bar.dataset.bar = o.tone ?? "dark";
  bar.innerHTML = `
    <a class="tg-back" href="${o.back ?? "./index.html"}" aria-label="All objects"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>Objects</a>
    <div class="tg-title"><b></b><span></span></div>
    <div class="tg-tools">
      <span class="tg-hint">Light</span>
      <div class="tg-light" role="slider" tabindex="0" aria-label="Light direction" aria-valuemin="0" aria-valuemax="359"><i></i></div>
      <button class="tg-tool" type="button" data-sound aria-label="Sound">${ICON_SOUND_ON}${ICON_SOUND_OFF}</button>
    </div>`;
  bar.querySelector("b").textContent = o.title;
  bar.querySelector(".tg-title span").textContent = o.subtitle ?? "";
  document.body.prepend(bar);

  // Light dial: drag around it, or arrow keys. Light is a scene setting (it repaints
  // every surface), so it is never animated; only the user moves it.
  const dial = bar.querySelector(".tg-light");
  let angle = applySavedLight(o.light ?? 315);
  const setA = (a) => {
    angle = ((Math.round(a) % 360) + 360) % 360;
    document.documentElement.style.setProperty("--tr-light-angle", angle + "deg");
    dial.setAttribute("aria-valuenow", angle);
    dial.setAttribute("aria-valuetext", `${angle} degrees`);
    store.set("light", angle);
    // Pages that bake light into something static (an SVG lighting filter) listen for this.
    document.dispatchEvent(new CustomEvent("tr-lightchange", { detail: { angle } }));
  };
  setA(angle);
  dial.addEventListener("pointerdown", (e) => {
    dial.setPointerCapture(e.pointerId);
    const r = dial.getBoundingClientRect();
    const at = (ev) => setA(Math.atan2(ev.clientX - (r.left + r.width / 2), -(ev.clientY - (r.top + r.height / 2))) * 180 / Math.PI);
    at(e);
    const mv = (ev) => at(ev);
    const upFn = () => { dial.removeEventListener("pointermove", mv); dial.removeEventListener("pointerup", upFn); };
    dial.addEventListener("pointermove", mv); dial.addEventListener("pointerup", upFn);
  });
  dial.addEventListener("keydown", (e) => {
    const d = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 }[e.key];
    if (d) { e.preventDefault(); setA(angle + d); }
  });

  // Optional sound + haptics switch. Off by default, like the interaction layer; persisted.
  const btn = bar.querySelector("[data-sound]");
  const setS = (on) => {
    feedback.configure({ sound: on, haptics: on });
    btn.setAttribute("aria-pressed", String(on));
    btn.dataset.on = String(on); // both icons stay in the button; CSS cross-fades them
    btn.title = on ? "Sound and haptics on" : "Sound and haptics off";
    store.set("sound", on);
  };
  setS(store.get("sound", false));
  btn.addEventListener("click", () => { setS(!feedback.sound); if (feedback.sound) feedback.play("click"); });
  return bar;
}

export { clamp, store, reduceMotion, springStep };
