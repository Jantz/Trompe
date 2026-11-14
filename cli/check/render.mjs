// Rendered rules: load each page in Chromium over a local static server, upgrade Trompe elements
// (injecting the package bundle if the page does not load one), then measure what only a browser
// can: axe-core, real contrast, target size, forced-colours boundaries, paint budget, runtime errors.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, relative, extname, join, sep } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { finding } from './rules.mjs';
import { elements, lineCol } from './markup.mjs';

const MIME = { '.html': 'text/html', '.htm': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const INTERACTIVE = ['button', 'checkbox', 'switch', 'radio', 'slider', 'tab', 'combobox', 'menuitem', 'option'];

async function loadPlaywright(cwd) {
  const names = ['playwright', '@playwright/test', 'playwright-core'];
  for (const name of names) {
    try { return await import(name); } catch {}
  }
  // Also look where the project and the machine keep it: the project's own node_modules, NODE_PATH,
  // and the global npm root (CI images and agent sandboxes often install Playwright globally).
  const bases = [join(cwd, 'package.json'), ...(process.env.NODE_PATH ?? '').split(/[:;]/).filter(Boolean).map((p) => join(p, 'x'))];
  try { bases.push(join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim(), 'x')); } catch {}
  for (const base of bases) {
    for (const name of names) {
      try { return await import(pathToFileURL(createRequire(base).resolve(name)).href); } catch {}
    }
  }
  throw new Error('--render needs Playwright. Install it with "npm i -D playwright" and "npx playwright install chromium".');
}

function serve(root, pkgRoot) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const base = url.startsWith('/__trompe__/') ? pkgRoot : root;
    const p = resolve(base, '.' + url.replace(/^\/__trompe__/, ''));
    if (!p.startsWith(base + sep) && p !== base) { res.writeHead(403).end(); return; }
    let file = p;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

export async function renderChecks(pages, data, { cwd, shots, chromium: exe } = {}) {
  if (!pages.length) return [];
  const { chromium } = await loadPlaywright(cwd);
  const server = await serve(cwd, data.pkgRoot);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  const browser = await chromium.launch(exe || process.env.TROMPE_CHROMIUM ? { executablePath: exe || process.env.TROMPE_CHROMIUM } : {});
  const out = [];
  try {
    for (const abs of pages) {
      const file = relative(cwd, abs);
      const src = readFileSync(abs, 'utf8');
      const staticEls = elements(abs, src);
      const locate = (tag, index) => {
        const e = staticEls.filter((x) => x.tag === tag)[index];
        return e?.nameStart != null ? lineCol(src, e.nameStart) : { line: 1, column: 1 };
      };
      const push = (id, props) => out.push(finding(id, { file, ...(props.tag ? locate(props.tag, props.index ?? 0) : { line: 1, column: 1 }), element: props.tag, ...props, tag: undefined, index: undefined }));

      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.goto(`${origin}/${relative(cwd, abs).split(sep).join('/')}`, { waitUntil: 'load' });
      await page.waitForTimeout(150);

      // Upgrade: inject the package bundle if the page did not define the elements it uses.
      const undefinedTags = await page.evaluate(() => [...new Set([...document.querySelectorAll('*')].filter((e) => e.localName.startsWith('tr-') && !customElements.get(e.localName)).map((e) => e.localName))]);
      if (undefinedTags.length) {
        await page.addStyleTag({ url: `${origin}/__trompe__/dist/tokens.css` }).catch(() => {});
        await page.addStyleTag({ url: `${origin}/__trompe__/dist/skins.css` }).catch(() => {});
        await page.addScriptTag({ url: `${origin}/__trompe__/dist/trompe.bundle.js`, type: 'module' }).catch((e) => errors.push(String(e)));
        await page.waitForTimeout(300);
      }
      const stillUndefined = await page.evaluate(async () => {
        const all = [...document.querySelectorAll('*')].filter((e) => e.localName.startsWith('tr-'));
        await Promise.all(all.map((e) => e.updateComplete).filter(Boolean));
        return [...new Set(all.filter((e) => !customElements.get(e.localName)).map((e) => e.localName))];
      });
      for (const t of stillUndefined) push('TR106', { tag: t, message: `<${t}> never upgraded; it renders as an unknown element.` });
      for (const e of [...new Set(errors)].slice(0, 5)) push('TR106', { message: `Runtime error: ${e.slice(0, 300)}${/MIME type/.test(e) ? ' The page loads a module a static server cannot run (TypeScript or a bare import). Check the built page instead.' : ''}` });

      // axe-core
      await page.addScriptTag({ path: axePath });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, url: v.helpUrl, nodes: v.nodes.slice(0, 10).map((n) => ({ target: n.target.flat().join(' >>> '), summary: n.failureSummary })) }));
      });
      for (const v of axe) for (const n of v.nodes) {
        const host = n.target.split(' >>> ')[0];
        const tag = (host.match(/^(tr-[a-z-]+)/) ?? [])[1];
        const index = tag ? await page.evaluate(([sel, t]) => [...document.querySelectorAll(t)].indexOf(document.querySelector(sel)), [host, tag]).catch(() => 0) : 0;
        push(v.id === 'color-contrast' ? 'TR101' : 'TR102', {
          tag, index: Math.max(0, index),
          severity: v.impact === 'minor' ? 'warning' : undefined,
          message: `${v.help} (${n.target}). ${n.summary?.split('\n').slice(0, 2).join(' ') ?? ''}`.trim(),
          axe: v.id, help: v.url,
        });
      }

      // Target size, paint budget
      const geo = await page.evaluate((roles) => {
        const small = [], targets = [];
        const counts = {};
        for (const el of document.querySelectorAll('*')) {
          if (!el.localName.startsWith('tr-')) continue;
          counts[el.localName] = (counts[el.localName] ?? 0) + 1;
          const role = el.getAttribute('role') || el.constructor.role || el.internals?.role || el.shadowRoot?.querySelector('[role]')?.getAttribute('role');
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
          if (roles.includes(role) || roles.includes(el.ariaRole ?? '')) targets.push({ el, r, tag: el.localName, index: counts[el.localName] - 1 });
        }
        // WCAG 2.5.8: an undersized target passes if a 24px circle on its centre touches no other target.
        for (const t of targets) {
          const { r } = t;
          if (r.width >= 24 && r.height >= 24) continue;
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          const crowded = targets.some((o) => o !== t && !o.el.contains(t.el) && !t.el.contains(o.el) &&
            Math.hypot(Math.max(o.r.left - cx, 0, cx - o.r.right), Math.max(o.r.top - cy, 0, cy - o.r.bottom)) < 12);
          if (crowded) small.push({ tag: t.tag, index: t.index, w: Math.round(r.width), h: Math.round(r.height) });
        }
        let blur = 0, heavy = [];
        const deep = (root) => { for (const el of root.querySelectorAll('*')) { const cs = getComputedStyle(el);
          if (cs.backdropFilter && cs.backdropFilter !== 'none') { const r = el.getBoundingClientRect(); if (r.width && r.height && r.bottom > 0 && r.top < innerHeight) blur++; }
          if (root === document && cs.boxShadow !== 'none') { const layers = cs.boxShadow.split(/,(?![^(]*\))/).length; if (layers > 6) heavy.push(layers); }
          if (el.shadowRoot) deep(el.shadowRoot); } };
        deep(document);
        return { small, blur, heavy: heavy.length, maxLayers: Math.max(0, ...heavy) };
      }, INTERACTIVE);
      for (const s of geo.small) push('TR103', { tag: s.tag, index: s.index, message: `<${s.tag}> is ${s.w}×${s.h} px; and too close to its neighbours; targets need 24×24 px or 24 px spacing (WCAG 2.5.8).` });
      if (geo.blur > 4) push('TR105', { message: `${geo.blur} backdrop-filter surfaces are visible at once; keep it to 4 for smooth scrolling.` });
      if (geo.heavy > 0) push('TR105', { severity: 'warning', message: `${geo.heavy} element(s) in the page's own CSS stack more than 6 box-shadow layers (up to ${geo.maxLayers}).` });

      // Forced colours strip shadows and backgrounds, so a control's edge must come from a border,
      // outline or SVG stroke on its visible part. Check computed styles, not pixels.
      await page.emulateMedia({ forcedColors: 'active' });
      await page.waitForTimeout(100);
      const noEdge = await page.evaluate((roles) => {
        const PARTS = ['control', 'trigger', 'field', 'box', 'socket', 'groove', 'track', 'knob', 'body', 'face', 'dial'];
        const counts = {}, res = [];
        const hasEdge = (el) => {
          const cs = getComputedStyle(el);
          const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && cs[`border${s}Color`] !== 'rgba(0, 0, 0, 0)');
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const stroke = el instanceof SVGElement && cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
          return border || outline || stroke;
        };
        for (const el of document.querySelectorAll('*')) {
          if (!el.localName.startsWith('tr-')) continue;
          counts[el.localName] = (counts[el.localName] ?? 0) + 1;
          const role = el.getAttribute('role') || el.shadowRoot?.querySelector('[role]')?.getAttribute('role') || '';
          if (!roles.includes(role) || ['option', 'menuitem', 'tab'].includes(role) || !el.shadowRoot) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const part = PARTS.map((p) => el.shadowRoot.querySelector(`[part~="${p}"]`)).find(Boolean);
          const scope = part ?? el.shadowRoot;
          const nodes = [...(part ? [part] : []), ...scope.querySelectorAll('*')].slice(0, 80);
          if (!hasEdge(el) && !nodes.some(hasEdge)) res.push({ tag: el.localName, index: counts[el.localName] - 1 });
        }
        return res;
      }, INTERACTIVE);
      for (const b of noEdge) push('TR104', { tag: b.tag, index: b.index, message: `Under forced colours <${b.tag}> has no border, outline or stroke, so its boundary disappears. Give its visible part a border (it maps to a system colour).` });
      await page.emulateMedia({ forcedColors: 'none' });

      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: join(shots, file.replace(/[\\/]/g, '__').replace(/\.html?$/, '.png')), fullPage: true });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return out;
}
