// Motion probe: finds changes that happen without animation, and layout that jumps.
//
// How it works. Every animation on the page is frozen (CDP Animation.setPlaybackRate 0), the
// change is triggered, and the next frames are captured. With time stopped, an animated change
// has not started yet: a fade is still at its first keyframe, a size transition still has its
// old size, an @starting-style entry is still invisible. Anything that already looks different
// in the frozen frame happened instantly. Then time runs again, the page settles, and the final
// frame is captured. Three measurements come out of the before / frozen / settled frames:
//
//   instant  share of the visible change (pixels) that was already there in the frozen frame.
//            0 = fully animated, 1 = a hard cut.
//   shift    Chromium's own layout-shift score (the CLS metric, counting input-driven shifts
//            too) for the frozen frames, plus the elements that moved and by how much.
//   appeared / vanished  elements that popped into or out of view without a transition.
//
// Works with any Playwright page in Chromium. Used by tests/motion.spec.ts and by
// `trompe check --render` (rules TR120 to TR122).

/** In-page helpers, installed once per document. */
function install() {
  if (window.__trMotion) return;
  const visible = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    // Effective opacity through the composed tree (checkVisibility only rejects opacity 0 on the element itself).
    let o = 1;
    for (let n = el; n; n = n.parentElement ?? n.getRootNode().host) {
      o *= parseFloat(getComputedStyle(n).opacity);
      if (o < 0.02) return false;
    }
    return true;
  };
  const walk = (root, out) => {
    for (const el of root.querySelectorAll('*')) {
      out.push(el);
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };
  const label = (el) => {
    const host = el.getRootNode().host;
    const own = el.localName + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '') + (el.getAttribute('part') ? `[part=${el.getAttribute('part')}]` : '');
    return host ? `${label(host)} > ${own}` : own;
  };
  // document.getAnimations() leaves out shadow trees: collect them from every root.
  const allAnimations = () => {
    const out = [...document.getAnimations()];
    for (const el of walk(document, [])) if (el.shadowRoot) out.push(...el.shadowRoot.getAnimations());
    return out;
  };
  const animated = (el) => {
    for (let n = el; n; n = n.parentElement ?? n.getRootNode().host) {
      if (n.getAnimations().some((a) => a.playState === 'running' || a.playState === 'paused')) return true;
    }
    return false;
  };
  let shift = 0;
  let sources = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      shift += e.value;
      for (const s of e.sources ?? []) if (s.node) sources.push({ node: s.node, prev: s.previousRect, cur: s.currentRect });
    }
  }).observe({ type: 'layout-shift', buffered: false });

  window.__trMotion = {
    snapshot() {
      // Visible box of each element: its border box cut by every clipping ancestor and the viewport.
      const map = new Map();
      const clips = new Map();
      const view = { l: 0, t: 0, r: innerWidth, b: innerHeight };
      const cut = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
      const parentOf = (el) => el.assignedSlot?.parentElement ?? el.parentElement ?? el.getRootNode().host ?? null;
      const clipFor = (el) => {
        if (!el) return view;
        if (clips.has(el)) return clips.get(el);
        let c = clipFor(parentOf(el));
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || el.matches(':popover-open, dialog[open]')) c = view;
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.contain.includes('paint')) {
          const r = el.getBoundingClientRect();
          c = cut(c, { l: r.left, t: r.top, r: r.right, b: r.bottom });
        }
        clips.set(el, c);
        return c;
      };
      for (const el of walk(document, [])) {
        if (el.localName === 'style' || el.localName === 'script' || el.localName === 'slot') continue;
        const br = el.getBoundingClientRect();
        if (br.width * br.height < 1) continue;
        const c = cut(clipFor(parentOf(el)), { l: br.left, t: br.top, r: br.right, b: br.bottom });
        if (c.r - c.l < 1 || c.b - c.t < 1) continue;
        const shown = visible(el);
        // An element mid-transition (fading in or out) counts as animated, not as popped in or out.
        if (!shown && !(this.marking && animated(el))) continue;
        map.set(el, { x: c.l, y: c.t, w: c.r - c.l, h: c.b - c.t, anim: this.marking ? animated(el) : false, shown });
      }
      return map;
    },
    freezeFrames(on) {
      // JS motion (Trompe's shared spring loop) holds still too: see setTimeScale in loop.ts.
      globalThis.__trompeTimeScale = on ? 0 : 1;
    },
    resetShift() {
      shift = 0;
      sources = [];
    },
    takeShift() {
      const out = { score: shift, sources: sources.map((s) => ({ el: s.node.nodeType === 1 ? label(s.node) : label(s.node.parentElement ?? document.body), dy: Math.round(s.cur.y - s.prev.y), dx: Math.round(s.cur.x - s.prev.x), dh: Math.round(s.cur.height - s.prev.height) })) };
      shift = 0;
      sources = [];
      return out;
    },
    compare(a, b, { tolerance = 1.5 } = {}) {
      const moved = [];
      const appeared = [];
      const vanished = [];
      for (const [el, r] of b) {
        const p = a.get(el);
        if (r.anim) continue;
        if (!p) {
          // Count only "leaf-ish" boxes that carry pixels: skip pure wrappers whose children are also new.
          if (!el.parentElement || !b.has(el.parentElement) || a.has(el.parentElement)) appeared.push({ el: label(el), w: Math.round(r.w), h: Math.round(r.h) });
          continue;
        }
        const d = Math.max(Math.abs(r.x - p.x), Math.abs(r.y - p.y), Math.abs(r.w - p.w), Math.abs(r.h - p.h));
        if (d > tolerance) moved.push({ el: label(el), dx: Math.round(r.x - p.x), dy: Math.round(r.y - p.y), dw: Math.round(r.w - p.w), dh: Math.round(r.h - p.h) });
      }
      for (const [el, r] of a) {
        if (b.get(el)?.anim) continue;
        if (!b.has(el) && (!el.parentElement || !a.has(el.parentElement) || b.has(el.parentElement))) vanished.push({ el: label(el), w: Math.round(r.w), h: Math.round(r.h) });
      }
      return { moved, appeared, vanished };
    },
    async settled(timeout) {
      const end = performance.now() + timeout;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      while (performance.now() < end) {
        const running = allAnimations().filter((x) => {
          if (x.playState !== 'running') return false;
          const t = x.effect?.getComputedTiming();
          return t && Number.isFinite(t.endTime) && t.iterations !== Infinity;
        });
        if (!running.length) break;
        await Promise.race([Promise.all(running.map((x) => x.finished.catch(() => {}))), new Promise((r) => setTimeout(r, Math.max(0, end - performance.now())))]);
      }
      await frame();
      await frame();
    },
    async diff(pngs, threshold = 24) {
      const imgs = await Promise.all(
        pngs.map(async (b64) => {
          const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
          const bmp = await createImageBitmap(blob);
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          return g.getImageData(0, 0, bmp.width, bmp.height).data;
        }),
      );
      const count = (x, y) => {
        let n = 0;
        const len = Math.min(x.length, y.length);
        for (let i = 0; i < len; i += 4) {
          if (Math.abs(x[i] - y[i]) > threshold || Math.abs(x[i + 1] - y[i + 1]) > threshold || Math.abs(x[i + 2] - y[i + 2]) > threshold) n++;
        }
        return n;
      };
      const [a, b, c] = imgs;
      return { instantPx: count(a, b), totalPx: count(a, c), residualPx: count(b, c) };
    },
  };
}

const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

/**
 * Measures one change.
 * @param {import('playwright').Page} page
 * @param {(page: import('playwright').Page) => Promise<unknown>} trigger  makes the change
 *   mask: selectors (or locators) left out of the pixel comparison, such as typed text.
 * @param {{ mask?: Array<string|object>, wait?: number, settle?: number, clip?: {x:number,y:number,width:number,height:number}, saveFrames?: (f: {before: string, frozen: string, after: string}) => void }} [opts]
 *   wait: ms to wait after the trigger before the frozen capture (for delayed reactions, such as a
 *   tooltip's show delay); settle: max ms to let animations finish; clip: screenshot region.
 */
export async function measureChange(page, trigger, opts = {}) {
  const { wait = 60, settle = 2000, clip, mask = [] } = opts;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await page.evaluate(install);
  await page.evaluate((t) => window.__trMotion.settled(t), settle);
  await frames(page, 2);
  const masks = mask.map((m) => (typeof m === 'string' ? page.locator(m) : m));
  const shot = async () => (await page.screenshot({ clip, caret: 'hide', animations: 'allow', mask: masks })).toString('base64');
  try {
    // Before: freeze, then capture (infinite animations such as spinners hold still from here on).
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
    await page.evaluate(() => window.__trMotion.freezeFrames(true));
    await frames(page, 2);
    await page.evaluate(() => {
      window.__trMotion.a = window.__trMotion.snapshot();
      window.__trMotion.resetShift();
    });
    const before = await shot();

    await trigger(page);
    await frames(page, 2);
    if (wait) await page.waitForTimeout(wait);
    await frames(page, 2);
    const frozen = await page.evaluate(() => {
      const m = window.__trMotion;
      m.marking = true;
      m.b = m.snapshot();
      m.marking = false;
      // A view transition paints its own snapshots over the page: the DOM below may jump while
      // the person sees a glide and cross-fade, so the pixel check alone speaks for the change.
      const vt = !!document.activeViewTransition || document.getAnimations().some((x) => x.effect?.pseudoElement?.startsWith('::view-transition'));
      return { ...m.compare(m.a, m.b), shift: m.takeShift(), vt };
    });
    const mid = await shot();

    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    await page.evaluate(() => window.__trMotion.freezeFrames(false));
    await page.evaluate((t) => window.__trMotion.settled(t), settle);
    const after = await shot();
    const final = await page.evaluate(() => {
      const m = window.__trMotion;
      const c = m.snapshot();
      const r = m.compare(m.a, c);
      m.a = m.b = null;
      return { moved: r.moved.length, appeared: r.appeared.length, vanished: r.vanished.length };
    });
    const px = await page.evaluate((imgs) => window.__trMotion.diff(imgs), [before, mid, after]);
    if (opts.saveFrames) opts.saveFrames({ before, frozen: mid, after });
    const instant = px.totalPx < 1 ? (px.instantPx > 0 ? 1 : 0) : Math.min(1, px.instantPx / px.totalPx);
    return {
      instant: Math.round(instant * 1000) / 1000,
      changedPx: px.totalPx,
      instantPx: px.instantPx,
      shift: Math.round(frozen.shift.score * 10000) / 10000,
      shiftSources: frozen.shift.sources.slice(0, 8),
      moved: frozen.moved,
      appeared: frozen.appeared,
      vanished: frozen.vanished,
      viewTransition: frozen.vt,
      final,
    };
  } finally {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }).catch(() => {});
    await page.evaluate(() => window.__trMotion?.freezeFrames(false)).catch(() => {});
    await cdp.detach().catch(() => {});
  }
}

/** Default limits. A change is "smooth" when it passes all of them. */
export const MOTION_LIMITS = {
  /** Share of a change's pixels allowed to appear before any animation frame. */
  instant: 0.15,
  /** Ignore changes smaller than this many pixels (anti-aliasing, caret, subpixel text). */
  minPx: 40,
  /** Layout-shift score allowed for one change. Chromium reports 0 for animated transforms. */
  shift: 0.001,
  /** Pixels an existing element may move in the frozen frame. */
  move: 1.5,
};

/** Turns a measurement into a list of human-readable problems (empty = smooth). */
export function motionProblems(m, limits = {}) {
  const l = { ...MOTION_LIMITS, ...limits };
  const out = [];
  if (m.changedPx >= l.minPx && m.instant > l.instant) out.push(`${Math.round(m.instant * 100)}% of the change (${m.instantPx}px) appeared without animation`);
  if (m.changedPx < l.minPx && m.instantPx >= l.minPx) out.push(`${m.instantPx}px flashed in the frozen frame`);
  // Under a view transition the page is shown as animated snapshots; DOM jumps underneath are hidden.
  if (m.viewTransition) return out;
  if (m.shift > l.shift) out.push(`layout shift ${m.shift}: ${m.shiftSources.map((s) => `${s.el} (dy ${s.dy}, dh ${s.dh})`).join('; ')}`);
  const moved = m.moved.filter((x) => Math.max(Math.abs(x.dx), Math.abs(x.dy), Math.abs(x.dw), Math.abs(x.dh)) > l.move);
  if (moved.length) out.push(`moved without animation: ${moved.slice(0, 6).map((x) => `${x.el} (${[x.dx && `dx ${x.dx}`, x.dy && `dy ${x.dy}`, x.dw && `dw ${x.dw}`, x.dh && `dh ${x.dh}`].filter(Boolean).join(', ')})`).join('; ')}${moved.length > 6 ? ` and ${moved.length - 6} more` : ''}`);
  if (m.appeared.length) out.push(`appeared without a transition: ${m.appeared.slice(0, 6).map((x) => x.el).join('; ')}`);
  if (m.vanished.length) out.push(`vanished without a transition: ${m.vanished.slice(0, 6).map((x) => x.el).join('; ')}`);
  return out;
}

/** Controls a person can click or toggle, in the light DOM. */
const CLICKABLE = [
  'tr-button', 'tr-switch', 'tr-checkbox', 'tr-radio', 'tr-tab', 'tr-segmented tr-option', 'tr-list[selectable] tr-list-item',
  'tr-nav-item', 'tr-select', 'tr-menu-item', 'button', '[role="button"]', '[role="tab"]', '[role="switch"]', 'summary',
  'input[type="checkbox"]', 'input[type="radio"]', 'a[href^="#"]',
].join(',');

/**
 * Clicks every visible control on a page in turn and measures each change with
 * {@link measureChange}. After each click, Escape closes whatever opened. Returns one entry per
 * control: its description, the measurement and the problems found.
 * @param {import('playwright').Page} page
 * @param {{ limit?: number, include?: string, exclude?: string, limits?: object }} [opts]
 */
export async function sweepInteractions(page, opts = {}) {
  const { limit = 60, include = CLICKABLE, exclude = '[disabled], [aria-disabled="true"], [inert] *, [data-tr-probe-skip], [data-tr-probe-skip] *' } = opts;
  const count = await page.evaluate(
    ({ include, exclude, limit }) => {
      let i = 0;
      for (const el of document.querySelectorAll(include)) {
        // Links that go somewhere (another page, or a jump to an anchor) are navigation, not a state change.
        if (el.closest('a[href]:not([href="#"]), tr-nav-item[href]:not([href="#"])')) continue;
        if (el.matches(exclude) || el.closest('tr-menu:not(:popover-open), [hidden], dialog:not([open]), tr-dialog:not([open])')) continue;
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        el.setAttribute('data-tr-probe', String(i++));
        if (i >= limit) break;
      }
      return i;
    },
    { include, exclude, limit },
  );
  const out = [];
  for (let i = 0; i < count; i++) {
    const sel = `[data-tr-probe="${i}"]`;
    const loc = page.locator(sel);
    const info = await loc
      .evaluate((el) => {
        if (!el.isConnected || !el.checkVisibility()) return null;
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const r = el.getBoundingClientRect();
        return { desc: `${el.localName}${el.id ? '#' + el.id : ''}${text ? ` "${text}"` : ''}`, x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
      .catch(() => null);
    if (!info) continue;
    await page.waitForTimeout(100);
    // Clicking a link that leaves the page is not a change to measure.
    page.once('dialog', (d) => d.dismiss().catch(() => {}));
    let m;
    try {
      m = await measureChange(page, (p) => p.mouse.click(info.x, info.y), {
        wait: 120,
        settle: 1500,
        clip: opts.clipAround ? { x: Math.max(0, info.x - 300), y: Math.max(0, info.y - 150), width: 600, height: 300 } : undefined,
        saveFrames: opts.saveFrames ? (f) => opts.saveFrames(i, info.desc, f) : undefined,
      });
    } catch (e) {
      out.push({ target: info.desc, error: String(e).slice(0, 200), problems: [] });
      continue;
    }
    out.push({ target: info.desc, measurement: m, problems: motionProblems(m, opts.limits) });
    await page.keyboard.press('Escape').catch(() => {});
    // Escape is a key press, which turns on keyboard focus rings; drop focus so the next
    // measurement does not count the ring leaving (rings leave at once by design, so only one
    // control ever looks focused).
    await page
      .evaluate(() => {
        let a = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        a?.blur?.();
        document.activeElement?.blur?.();
      })
      .catch(() => {});
    await page.mouse.move(0, 0).catch(() => {});
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => document.querySelectorAll('[data-tr-probe]').forEach((el) => el.removeAttribute('data-tr-probe'))).catch(() => {});
  return out;
}
