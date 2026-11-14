// Tests for `trompe check`. Run with: npm run test:check (needs `npm run build` first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { run } from '../check/index.mjs';
import { parseType } from '../check/data.mjs';
import { parseColor, contrast, themed } from '../check/color.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (f) => join(here, 'fixtures', f);
const ids = (r, file) => r.findings.filter((f) => !file || f.file.endsWith(file)).map((f) => `${f.id}@${f.line}`);

test('parseType reads CEM unions', () => {
  assert.deepEqual(parseType("'a' | 'b' | undefined"), { kind: 'enum', values: ['a', 'b'] });
  assert.deepEqual(parseType('-2 | -1 | 0 | 1'), { kind: 'enum', values: ['-2', '-1', '0', '1'] });
  assert.equal(parseType('boolean').kind, 'boolean');
  assert.equal(parseType("'amber' | (string & {}) | undefined").kind, 'any');
});

test('colour maths matches WCAG reference values', () => {
  assert.equal(contrast(parseColor('#000'), parseColor('#fff')).toFixed(2), '21.00');
  assert.equal(contrast(parseColor('#767676'), parseColor('white')).toFixed(2), '4.54');
  assert.deepEqual(parseColor('oklch(62.8% 0.2577 29.23)').map((x) => Math.round(x * 255)), [255, 0, 0, 255]);
  assert.deepEqual(themed('light-dark(#fff, oklch(20% 0 0))'), { light: '#fff', dark: 'oklch(20% 0 0)' });
  assert.equal(parseColor('color-mix(in oklch, red, blue)'), null);
});

test('bad.html: every planted mistake is found at the right line', async () => {
  const r = await run({ inputs: [fx('bad.html')] });
  assert.deepEqual(new Set(ids(r)), new Set([
    'TR006@4', 'TR001@5', 'TR003@6', 'TR004@6', 'TR005@7', 'TR002@8', 'TR005@8', 'TR011@9',
    'TR007@10', 'TR009@10', 'TR010@10', 'TR008@11', 'TR014@12', 'TR012@13', 'TR016@14',
  ]));
  const tone = r.findings.find((f) => f.attribute === 'size');
  assert.deepEqual(tone.fix, { kind: 'set-attribute', name: 'size', value: 'md' });
  assert.ok(tone.expected.includes('lg'));
  assert.equal(r.summary.errors, r.findings.filter((f) => f.severity === 'error').length);
});

test('good.html and good.skin.json are clean', async () => {
  const r = await run({ inputs: [fx('good.html'), fx('good.skin.json')] });
  assert.deepEqual(r.findings, []);
});

test('Vue templates, self-closing tags and Lit literals are understood', async () => {
  const r = await run({ inputs: [fx('Player.vue'), fx('widget.ts')] });
  assert.deepEqual(ids(r), ['TR003@4', 'TR003@4']);
  assert.ok(r.findings.some((f) => f.file.endsWith('widget.ts') && f.value === 'plastik' && f.fix?.value === 'plastic'));
  assert.ok(!r.findings.some((f) => f.id === 'TR014'), 'a self-closing <tr-knob /> must not swallow its siblings');
});

test('skin validation: schema, vocabulary and contrast', async () => {
  const r = await run({ inputs: [fx('bad.skin.json')] });
  const got = new Set(ids(r));
  for (const want of ['TR201@2', 'TR201@3', 'TR203@6', 'TR202@7', 'TR202@10', 'TR202@11', 'TR203@12']) assert.ok(got.has(want), `missing ${want}`);
});

test('--fix applies only unambiguous fixes and leaves the rest reported', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trompe-check-'));
  copyFileSync(fx('bad.html'), join(dir, 'bad.html'));
  const r = await run({ inputs: [join(dir, 'bad.html')], fix: true });
  const after = readFileSync(join(dir, 'bad.html'), 'utf8');
  assert.match(after, /data-tr-skin="chrome"/);
  assert.match(after, /<tr-button>Save<\/tr-button>/);
  assert.match(after, /size="md"/);
  assert.match(after, /tone="accent"/);
  assert.doesNotMatch(after, /toggle="false"/);
  assert.match(after, /label="Volume"/);
  assert.ok(r.summary.fixed >= 6);
  assert.ok(!r.findings.some((f) => ['TR001', 'TR002', 'TR004', 'TR006'].includes(f.id)));
});

test('the CLI prints JSON and exits 1 on errors', () => {
  const bin = join(here, '../../bin/trompe.mjs');
  let out, code = 0;
  try { out = execFileSync(process.execPath, [bin, 'check', '--format', 'json', fx('bad.skin.json')], { encoding: 'utf8' }); }
  catch (e) { out = e.stdout; code = e.status; }
  assert.equal(code, 1);
  const report = JSON.parse(out);
  assert.equal(report.tool, 'trompe-check');
  assert.ok(report.findings.every((f) => f.id && f.rule && f.severity && f.message && f.docs && f.line));
});

test('the shipped skins have no schema or vocabulary errors', async () => {
  const r = await run({ inputs: [join(here, '../../skins')] });
  assert.deepEqual(r.findings.filter((f) => f.id !== 'TR203'), []);
});

test('--render: upgrades the page and finds nothing on a clean page', { timeout: 120_000 }, async (t) => {
  let pw;
  try { pw = await import('@playwright/test'); const b = await pw.chromium.launch(); await b.close(); }
  catch { t.skip('Chromium is not available'); return; }
  const r = await run({ inputs: [fx('good.html')], render: true });
  const rendered = r.findings.filter((f) => f.id.startsWith('TR1'));
  assert.deepEqual(rendered.map((f) => `${f.id} ${f.message}`), []);
});

test('--render motion: cuts, jumps and pop-ins are found; a transition is clean', { timeout: 120_000 }, async (t) => {
  let pw;
  try { pw = await import('@playwright/test'); const b = await pw.chromium.launch(); await b.close(); }
  catch { t.skip('Chromium is not available'); return; }
  const r = await run({ inputs: [fx('motion.html')], render: true });
  const motion = r.findings.filter((f) => /^TR12/.test(f.id)).map((f) => `${f.id} ${f.message}`);
  assert.ok(motion.some((m) => m.startsWith('TR120') && m.includes('#cut')), motion.join('\n'));
  assert.ok(motion.some((m) => m.startsWith('TR121') && m.includes('#jump')), motion.join('\n'));
  assert.ok(motion.some((m) => m.startsWith('TR122') && m.includes('#jump')), motion.join('\n'));
  assert.ok(!motion.some((m) => m.includes('#smooth')), motion.join('\n'));
});
