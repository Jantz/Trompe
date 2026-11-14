#!/usr/bin/env node
// Tiny static server for the built framework examples: /<name>/... -> examples/<name>/dist/...
// Usage: node scripts/serve-examples.mjs [port=5291]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../examples');
const port = Number(process.argv[2] ?? process.env.PORT ?? 5291);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const [, name, ...rest] = decodeURIComponent(url.pathname).split('/');
  if (!name) {
    res.writeHead(200, { 'content-type': TYPES['.html'] });
    res.end(['html', 'react', 'vue', 'svelte'].map((n) => `<p><a href="/${n}/">${n}</a></p>`).join(''));
    return;
  }
  const base = join(root, name, 'dist');
  let file = normalize(join(base, ...rest));
  if (!file.startsWith(base)) return void res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(`not found: ${url.pathname}`);
  }
}).listen(port, () => console.log(`examples: http://localhost:${port}/`));
