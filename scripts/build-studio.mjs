#!/usr/bin/env node
// Builds Trompe Studio into one self-contained HTML file: studio/dist/index.html.
// Script and styles are bundled with esbuild and inlined, so the page works from anywhere
// (a file, a static host, an artifact) with no network access.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'studio');
// ignoreAnnotations: package.json "sideEffects" describes dist/, but here we bundle src/ whose modules define elements.
const common = { bundle: true, minify: true, write: false, logLevel: 'warning', ignoreAnnotations: true };
const js = await build({ ...common, entryPoints: [resolve(dir, 'studio.ts')], format: 'esm', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' } });
const cssOut = await build({ ...common, entryPoints: [resolve(dir, 'studio.css')], loader: { '.css': 'css' } });
const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = cssOut.outputFiles[0].text;

let html = readFileSync(resolve(dir, 'index.html'), 'utf8');
html = html.replace(/\s*<link rel="stylesheet" href="\.\/studio\.css" \/>/, () => `\n    <style>${css}</style>`);
html = html.replace(/\s*<script type="module" src="\.\/studio\.ts"><\/script>/, '');
// Function replacers: the minified code contains $-patterns that string replacements would expand.
html = html.replace('</body>', () => `<script type="module">${script}</script>\n  </body>`);
mkdirSync(resolve(dir, 'dist'), { recursive: true });
writeFileSync(resolve(dir, 'dist/index.html'), html);
console.log(`studio: ${(html.length / 1024).toFixed(0)} KiB -> studio/dist/index.html`);
