// Dev helper: screenshot a URL. Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [scale]
import { chromium } from 'playwright';
const [url, out, w = '1000', h = '700', scale = '1'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
