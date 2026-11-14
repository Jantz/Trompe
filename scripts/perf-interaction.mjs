#!/usr/bin/env node
// Measures what each interaction costs the main thread, on the Touch Lab demo, in Chromium.
//
// For every scenario it drives real pointer input through CDP and reports, per frame: layouts,
// style recalcs, script time, and the worst frame, with the CPU throttled 4x to stand in for a
// mid-range phone. Run `node scripts/build-interaction-demo.mjs` first.
//
//   node scripts/perf-interaction.mjs [--json out.json] [--throttle 4]

import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const throttle = Number(args[args.indexOf('--throttle') + 1]) || 4;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(pathToFileURL(resolve(root, 'dist-demo/interaction-lab.page.html')).href);
await page.waitForTimeout(500);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

async function metrics() {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

async function center(sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const b = await page.locator(sel).first().boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}

/** Moves the pointer along a path at ~60 Hz (one move per frame). */
async function drag(from, to, frames = 40, { hold = 0 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  if (hold) await page.waitForTimeout(hold);
  await page.mouse.up();
}

const scenarios = {
  'button press': async () => {
    const c = await center('.btn.primary');
    for (let i = 0; i < 6; i++) await page.mouse.click(c.x, c.y, { delay: 30 });
  },
  'card press + tilt': async () => {
    const c = await center('.card');
    await drag({ x: c.b.x + 20, y: c.y }, { x: c.b.x + c.b.width - 20, y: c.y }, 30);
  },
  'switch throw (drag)': async () => {
    const c = await center('#sw2');
    await drag({ x: c.b.x + 8, y: c.y }, { x: c.b.x + c.b.width + 10, y: c.y }, 24);
  },
  'segmented slide': async () => {
    const seg = await center('#seg');
    const wk = await center('#seg [role=radio]:nth-of-type(2)');
    await drag(wk, { x: seg.b.x + seg.b.width - 10, y: wk.y }, 30);
  },
  'slider drag': async () => {
    const cap = await center('#s-bright .cap');
    const tr = await center('#s-bright');
    await drag(cap, { x: tr.b.x + 10, y: cap.y }, 50);
  },
  'sheet drag + flick': async () => {
    await page.locator('#share').scrollIntoViewIfNeeded();
    await page.locator('#share').click();
    await page.waitForTimeout(600);
    const g = await center('#sheet .grabber');
    await drag(g, { x: g.x, y: g.y + 160 }, 20);
  },
  'carousel flick': async () => {
    const c = await center('#carousel');
    await drag({ x: c.x + 100, y: c.y }, { x: c.x - 120, y: c.y }, 12);
  },
};

const results = [];
for (const [name, run] of Object.entries(scenarios)) {
  await page.evaluate(() => {
    window.__ft = [];
    let last = 0;
    window.__stop = false;
    const f = (t) => {
      if (last) window.__ft.push(t - last);
      last = t;
      if (!window.__stop) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const a = await metrics();
  await run();
  await page.waitForTimeout(900); // let springs settle
  const b = await metrics();
  const ft = await page.evaluate(() => {
    window.__stop = true;
    return window.__ft;
  });
  const frames = ft.length || 1;
  const sorted = [...ft].sort((x, y) => x - y);
  const r = {
    scenario: name,
    frames,
    layoutsPerFrame: +((b.LayoutCount - a.LayoutCount) / frames).toFixed(2),
    styleRecalcsPerFrame: +((b.RecalcStyleCount - a.RecalcStyleCount) / frames).toFixed(2),
    layoutMsPerFrame: +(((b.LayoutDuration - a.LayoutDuration) * 1000) / frames).toFixed(3),
    styleMsPerFrame: +(((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000) / frames).toFixed(3),
    scriptMsPerFrame: +(((b.ScriptDuration - a.ScriptDuration) * 1000) / frames).toFixed(3),
    p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
  };
  results.push(r);
}
await browser.close();

console.log(`CPU throttle ${throttle}x (headless Chromium; frame times are capped by the headless compositor, so read the per-frame costs)\n`);
console.table(results);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ throttle, results }, null, 2));
