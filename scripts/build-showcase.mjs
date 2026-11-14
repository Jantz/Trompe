#!/usr/bin/env node
// Builds the showcase into one self-contained HTML file: showcase/dist/index.html.
// Script and styles are bundled with esbuild and inlined, so the page works from anywhere.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'showcase');
// ignoreAnnotations: package.json "sideEffects" describes dist/, but here we bundle src/ whose modules define elements.
const common = { bundle: true, minify: true, write: false, logLevel: 'warning', ignoreAnnotations: true };
const js = await build({ ...common, entryPoints: [resolve(dir, 'showcase.ts')], format: 'esm', target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' } });
const cssOut = await build({ ...common, entryPoints: [resolve(dir, 'showcase.css')], loader: { '.css': 'css' } });
const script = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = cssOut.outputFiles[0].text;

let html = readFileSync(resolve(dir, 'index.html'), 'utf8');
html = html.replace(/\s*<link rel="stylesheet" href="\.\/showcase\.css" \/>/, () => `\n    <style>${css}</style>`);
html = html.replace(/\s*<script type="module" src="\.\/showcase\.ts"><\/script>/, '');
// Function replacers: the minified code contains $-patterns that string replacements would expand.
html = html.replace('</body>', () => `<script type="module">${script}</script>\n  </body>`);
mkdirSync(resolve(dir, 'dist'), { recursive: true });
writeFileSync(resolve(dir, 'dist/index.html'), html);
console.log(`showcase: ${(html.length / 1024).toFixed(0)} KiB -> showcase/dist/index.html`);
