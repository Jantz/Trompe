// Orchestrates a check run: collect files, run static rules, skin validation, optional render pass.
import * as nodeFs from 'node:fs';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, extname, join, basename } from 'node:path';
import { loadData } from './data.mjs';
import { checkMarkup, checkCss } from './static.mjs';
import { checkSkin } from './skin.mjs';

const MARKUP = new Set(['.html', '.htm', '.vue', '.svelte', '.js', '.mjs', '.ts', '.mts', '.jsx', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', '.vite', 'generated', 'coverage']);

export function collect(inputs, cwd = process.cwd()) {
  const files = new Set();
  const visit = (p) => {
    let st;
    try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) {
      for (const e of readdirSync(p)) if (!SKIP_DIRS.has(e) && !e.startsWith('.')) visit(join(p, e));
    } else if (MARKUP.has(extname(p)) || p.endsWith('.css') || p.endsWith('.skin.json')) files.add(p);
  };
  for (const input of inputs.length ? inputs : ['.']) {
    const abs = resolve(cwd, input);
    if (/[*?[]/.test(input)) {
      const globSync = nodeFs.globSync;
      if (!globSync) throw new Error('Glob patterns need Node 22+. Pass files or directories instead.');
      for (const f of globSync(input, { cwd })) visit(resolve(cwd, f));
    } else visit(abs);
  }
  return [...files].sort();
}

/**
 * What the rest of the project tells us about skins, so a page is not judged alone: custom skins
 * (`*.skin.json`, CSS from `trompe skin --css`, skin objects passed to applySkin) and whether some
 * module imports a skin stylesheet (`import 'trompe/skins.css'` in main.js counts for index.html).
 */
export function projectContext(cwd, files) {
  const skins = new Set();
  let loadsSkins = false;
  const roots = new Set();
  for (const start of [cwd, ...files.slice(0, 1).map((f) => resolve(f, '..'))]) {
    for (let d = start, i = 0; i < 6; i++) {
      if (nodeFs.existsSync(join(d, 'package.json'))) { roots.add(d); break; }
      const up = resolve(d, '..');
      if (up === d) break;
      d = up;
    }
  }
  const seen = new Set(files);
  const scan = [...files];
  let budget = 3000;
  const walk = (p) => {
    if (budget-- <= 0) return;
    let st;
    try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) {
      for (const e of readdirSync(p)) if (!SKIP_DIRS.has(e) && !e.startsWith('.')) walk(join(p, e));
    } else if (!seen.has(p) && (MARKUP.has(extname(p)) || p.endsWith('.css') || p.endsWith('.skin.json')) && st.size < 2_000_000) {
      seen.add(p);
      scan.push(p);
    }
  };
  for (const r of roots) walk(r);
  for (const f of scan) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (f.endsWith('.skin.json')) {
      try { const n = JSON.parse(text).name; if (n) skins.add(n); } catch {}
      continue;
    }
    for (const m of text.matchAll(/\[data-tr-skin\s*=\s*\\?['"]?([\w-]+)/g)) skins.add(m[1]);
    if (/\b(applySkin|compileSkin)\b/.test(text)) {
      loadsSkins = true;
      for (const m of text.matchAll(/\bname\s*:\s*['"]([\w-]+)['"]/g)) skins.add(m[1]);
    }
    if (/trompe\/skins(\.css|\/[\w-]+\.css)|\bskins\.css\b|\[data-tr-skin/.test(text) && !/\.html?$/.test(f)) loadsSkins = true;
  }
  return { skins, loadsSkins };
}

/**
 * Runs the checker. Options: { inputs, cwd, manifest, tokens, skins, fix, render, motion, shots }.
 * Returns { tool, version, summary, findings }.
 */
export async function run(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const data = loadData(opts);
  const files = collect(opts.inputs ?? [], cwd);
  const project = projectContext(cwd, files);
  data.localSkins = project.skins;
  data.projectLoadsSkins = project.loadsSkins;

  const findings = [];
  let fixed = 0;
  let rendered;
  const urls = (opts.inputs ?? []).filter((i) => /^https?:\/\//.test(i));
  if (urls.length) throw new Error(`trompe check reads files, not URLs (${urls[0]}). Build the app and pass the built page, e.g. "trompe check --render dist/index.html".`);
  for (const abs of files) {
    const file = relative(cwd, abs) || basename(abs);
    let src = readFileSync(abs, 'utf8');
    let fs = [];
    if (abs.endsWith('.skin.json')) fs = checkSkin(file, src, data);
    else if (abs.endsWith('.css')) fs = checkCss(file, src, src, 0, data);
    else fs = checkMarkup(file, src, data, abs);

    if (opts.fix) {
      const edits = fs.filter((f) => f._edits?.length).flatMap((f) => f._edits.map((e) => ({ ...e, f })));
      edits.sort((a, b) => b.start - a.start);
      let lastStart = Infinity;
      const applied = new Set();
      for (const e of edits) {
        if (e.end > lastStart || e.start == null) continue;
        src = src.slice(0, e.start) + e.text + src.slice(e.end);
        lastStart = e.start;
        applied.add(e.f);
      }
      if (applied.size) {
        writeFileSync(abs, src);
        fixed += applied.size;
        // Re-check the fixed file so the report reflects what is left.
        fs = abs.endsWith('.css') ? checkCss(file, src, src, 0, data) : checkMarkup(file, src, data, abs);
      }
    }
    findings.push(...fs);
  }

  if (opts.render) {
    const { renderChecks } = await import('./render.mjs');
    const pages = files.filter((f) => /\.html?$/.test(f));
    findings.push(...(await renderChecks(pages, data, { cwd, shots: opts.shots, chromium: opts.chromium, motion: opts.motion !== false })));
    rendered = pages.length;
  }

  for (const f of findings) delete f._edits;
  const order = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || order[a.severity] - order[b.severity]);
  const pkg = JSON.parse(readFileSync(resolve(data.pkgRoot, 'package.json'), 'utf8'));
  return {
    tool: 'trompe-check',
    version: pkg.version,
    summary: {
      files: files.length,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
      fixed,
      ...(rendered !== undefined ? { rendered } : {}),
    },
    findings,
  };
}

export function formatText(report, { color = false } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [];
  let current;
  for (const f of report.findings) {
    if (f.file !== current) { current = f.file; lines.push('', c(4, f.file)); }
    const sev = f.severity === 'error' ? c(31, 'error  ') : c(33, 'warning');
    lines.push(`  ${String(f.line ?? '').padStart(4)}:${String(f.column ?? '').padEnd(3)} ${sev} ${f.message} ${c(2, `${f.id} ${f.rule}`)}`);
  }
  const s = report.summary;
  const rendered = s.rendered === undefined ? '' : ` ${s.rendered} page${s.rendered === 1 ? '' : 's'} rendered in Chromium (axe, contrast, target size, forced colours)${s.rendered ? '' : ': pass a built .html page to render'}.`;
  lines.push('', `${s.files} file${s.files === 1 ? '' : 's'} checked: ${s.errors} error${s.errors === 1 ? '' : 's'}, ${s.warnings} warning${s.warnings === 1 ? '' : 's'}${s.fixed ? `, ${s.fixed} fixed` : ''}.${rendered}`);
  return lines.join('\n').replace(/^\n/, '');
}
