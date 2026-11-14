#!/usr/bin/env node
// Builds the Touch Lab demo: bundles src/interaction into an IIFE (global TrompeInteraction) and
// inlines it into demo/interaction-lab/index.html.
//
// Outputs:
//   dist-demo/interaction-lab.html       page fragment (for hosts that add their own <html> skeleton)
//   dist-demo/interaction-lab.page.html  full standalone document (open it directly in a browser)

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist-demo');
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [resolve(root, 'src/interaction/index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'TrompeInteraction',
  minify: true,
  target: 'es2022',
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync(resolve(root, 'demo/interaction-lab/index.html'), 'utf8').replace('/*BUNDLE*/', () => js);
writeFileSync(resolve(out, 'interaction-lab.html'), page);
writeFileSync(
  resolve(out, 'interaction-lab.page.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`,
);
console.log(`interaction demo: bundle ${(js.length / 1024).toFixed(1)} KB -> dist-demo/`);
