// Tests for `trompe skin`. Run with: npm run test:check (needs `npm run build` first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { run } from '../check/index.mjs';

const bin = resolve(dirname(fileURLToPath(import.meta.url)), '../../bin/trompe.mjs');
const trompe = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
const dir = mkdtempSync(join(tmpdir(), 'trompe-skin-'));

test('describe -> skin JSON + CSS that trompe check accepts', async () => {
  const out = join(dir, 'library.skin.json');
  const css = join(dir, 'library.css');
  const r = trompe('skin', 'walnut panels with brushed brass knobs, amber accent, low evening light', '--name', 'library', '--out', out, '--css', css);
  assert.equal(r.status, 0, r.stderr);
  const skin = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(skin.name, 'library');
  assert.match(readFileSync(css, 'utf8'), /\[data-tr-skin='library'\]/);
  assert.match(r.stderr, /wrote/);
  const check = await run({ inputs: [out] });
  assert.deepEqual(check.findings.filter((f) => f.severity === 'error'), []);
});

test('--format json gives agents skin, notes and findings', () => {
  const r = trompe('skin', 'clinical white ceramic, mint accent', '--format', 'json');
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.ok(j.skin.elements);
  assert.ok(j.notes.length > 0);
  assert.deepEqual(j.findings.filter((f) => f.severity === 'error'), []);
});

test('check finds unreadable text and --fix repairs it', () => {
  const file = join(dir, 'bad.skin.json');
  writeFileSync(file, JSON.stringify({ name: 'bad', description: 'A test skin with unreadable grey ink.', colorScheme: 'light', tokens: { 'color.ink': 'oklch(85% 0 0)' }, elements: {} }));
  assert.equal(trompe('skin', 'check', file).status, 1);
  const fixed = trompe('skin', 'check', file, '--fix');
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  assert.notEqual(JSON.parse(readFileSync(file, 'utf8')).tokens['color.ink'], 'oklch(85% 0 0)');
});

test('build compiles a skin file to CSS', () => {
  const file = join(dir, 'bad.skin.json');
  const r = trompe('skin', 'build', file);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--tr-color-ink:/);
});

test('trompe check flags an unknown texture', async () => {
  const file = join(dir, 'tex.skin.json');
  writeFileSync(file, JSON.stringify({ name: 'tex', description: 'A test skin with a made-up texture.', colorScheme: 'light', tokens: {}, elements: { 'tr-panel': { material: 'plastic', texture: 'plaid' } } }, null, 2));
  const r = await run({ inputs: [file] });
  assert.ok(r.findings.some((f) => f.id === 'TR202' && /plaid/.test(f.message)));
});

test('vocab lists what the generator understands', () => {
  const r = trompe('skin', 'vocab', '--format', 'json');
  assert.equal(r.status, 0);
  const v = JSON.parse(r.stdout);
  assert.ok(v.materials.includes('walnut'));
  assert.ok(v.moods.includes('retro'));
});
