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
 * Runs the checker. Options: { inputs, cwd, manifest, tokens, skins, fix, render, shots }.
 * Returns { tool, version, summary, findings }.
 */
export async function run(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const data = loadData(opts);
  const files = collect(opts.inputs ?? [], cwd);
  data.localSkins = new Set();
  for (const f of files) if (f.endsWith('.skin.json')) {
    try { const n = JSON.parse(readFileSync(f, 'utf8')).name; if (n) data.localSkins.add(n); } catch {}
  }

  const findings = [];
  let fixed = 0;
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
    findings.push(...(await renderChecks(pages, data, { cwd, shots: opts.shots, chromium: opts.chromium })));
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
  lines.push('', `${s.files} file${s.files === 1 ? '' : 's'} checked: ${s.errors} error${s.errors === 1 ? '' : 's'}, ${s.warnings} warning${s.warnings === 1 ? '' : 's'}${s.fixed ? `, ${s.fixed} fixed` : ''}.`);
  return lines.join('\n').replace(/^\n/, '');
}
