/**
 * One shared animation loop for every Trompe control.
 *
 * All springs, inertia and meter ballistics tick from a single `requestAnimationFrame`, so a desk
 * with 64 moving knobs still costs one callback per frame, and the loop stops entirely when nothing
 * moves. Each ticker returns `true` to keep running.
 */

/** A per-frame callback. `dt` is in seconds, clamped to 1/30 s so a hidden tab never jumps. */
export type Ticker = (dt: number, now: number) => boolean;

const tickers = new Set<Ticker>();
let frame = 0;
let last = 0;

/**
 * Slow motion for JS-driven motion: springs, inertia and meter ballistics run at this fraction
 * of real time (0 holds them still). Read from `globalThis.__trompeTimeScale` every frame, so a
 * page, a test or DevTools can set it; pair it with DevTools' animation speed for CSS motion.
 */
export function setTimeScale(scale: number): void {
  (globalThis as { __trompeTimeScale?: number }).__trompeTimeScale = scale;
}

function run(now: number): void {
  const scale = (globalThis as { __trompeTimeScale?: number }).__trompeTimeScale ?? 1;
  const dt = (last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60) * scale;
  last = now;
  for (const t of tickers) {
    let more = false;
    try {
      more = t(dt, now);
    } catch (err) {
      // One broken ticker must not stall every other control.
      queueMicrotask(() => {
        throw err;
      });
    }
    if (!more) tickers.delete(t);
  }
  frame = tickers.size ? requestAnimationFrame(run) : 0;
  if (!frame) last = 0;
}

/** Adds a ticker to the shared loop. Returns a function that removes it. */
export function loop(ticker: Ticker): () => void {
  tickers.add(ticker);
  if (!frame && typeof requestAnimationFrame !== 'undefined') frame = requestAnimationFrame(run);
  return () => {
    tickers.delete(ticker);
  };
}

/** Number of active tickers (for tests and the performance HUD). */
export function activeTickers(): number {
  return tickers.size;
}
