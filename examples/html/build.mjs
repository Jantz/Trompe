// Builds the plain-HTML example into dist/: the page, the shared stylesheet, and the single-file
// bundle resolved from the installed "trompe" package (its "./bundle" export).
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
rmSync(here('./dist'), { recursive: true, force: true });
mkdirSync(here('./dist'), { recursive: true });
const bundle = fileURLToPath(import.meta.resolve('trompe/bundle'));
copyFileSync(bundle, here('./dist/trompe.bundle.js'));
copyFileSync(here('./index.html'), here('./dist/index.html'));
copyFileSync(here('../shared/example.css'), here('./dist/example.css'));
console.log(`html example: dist/ (bundle from ${bundle})`);
