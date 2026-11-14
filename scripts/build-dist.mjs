#!/usr/bin/env node
// Second half of the library build, run after `tsc` has emitted dist/**/*.js + .d.ts:
//   - dist/trompe.bundle.js: one minified ES module with Lit included, for <script type="module">
//     and CDN use (import 'https://cdn.jsdelivr.net/npm/trompe/dist/trompe.bundle.js').
//   - copies the generated stylesheets and metadata into dist: tokens.css, tokens.json and, when
//     the token build produced them, skins.css, skins/<name>.css and skins.json.

import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gen = resolve(root, 'src/generated');
const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });

const pkg = (await import(resolve(root, 'package.json'), { with: { type: 'json' } })).default;

const result = await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(dist, 'trompe.bundle.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  minify: true,
  sourcemap: 'linked',
  legalComments: 'eof',
  tsconfig: resolve(root, 'tsconfig.json'),
  banner: { js: `/*! trompe ${pkg.version} | MIT | bundle with lit */` },
  metafile: true,
  logLevel: 'warning',
});
const bytes = result.metafile.outputs[Object.keys(result.metafile.outputs).find((k) => k.endsWith('.js'))].bytes;
console.log(`bundle: dist/trompe.bundle.js ${(bytes / 1024).toFixed(1)} KiB`);

/** Copies a file or directory tree if it exists. Returns the number of files copied. */
function copy(from, to) {
  if (!existsSync(from)) return 0;
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true });
    return readdirSync(from).reduce((n, name) => n + copy(join(from, name), join(to, name)), 0);
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return 1;
}

const required = ['tokens.css', 'tokens.json'];
for (const f of required) {
  if (!copy(join(gen, f), join(dist, f))) throw new Error(`missing src/generated/${f}: run npm run tokens`);
}
// Skins are optional: older token builds do not produce them.
const optional = ['skins.css', 'skins.json', 'skins'];
const copied = optional.filter((f) => copy(join(gen, f), join(dist, f)) > 0);
console.log(`assets: ${[...required, ...copied].join(', ')} -> dist/`);
