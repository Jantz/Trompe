// Screenshot + smoke-test helper for gallery pages. Kit check: node gallery/tools/shoot.mjs kit/smoke.html --script=gallery/tools/smoke-steps.mjs
//   node gallery/tools/shoot.mjs <page.html> [outDir] [--phone] [--script=steps.mjs]
// Serves gallery/ on a local port, loads the page at desktop (1440x900) and phone (390x844),
// reports console errors and page errors, writes PNGs to outDir (default: /tmp/trompe-shots).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
export function serve() {
  return new Promise((ok) => {
    const srv = createServer(async (req, res) => {
      try {
        const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
        const body = await readFile(p.endsWith("/") ? p + "index.html" : p);
        res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
        res.end(body);
      } catch { res.writeHead(404); res.end("404"); }
    });
    srv.listen(0, () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const page = args.find((a) => !a.startsWith("--") && a.endsWith(".html"));
  const out = args.find((a) => !a.startsWith("--") && !a.endsWith(".html")) || "/tmp/trompe-shots";
  const script = args.find((a) => a.startsWith("--script="))?.slice(9);
  mkdirSync(out, { recursive: true });
  const { srv, url } = await serve();
  const browser = await chromium.launch();
  const name = page.replace(/\.html$/, "").replace(/\//g, "_");
  for (const [label, vp, dpr] of [["desktop", { width: 1440, height: 900 }, 1], ["phone", { width: 390, height: 844 }, 2]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: label === "phone" });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    pg.on("pageerror", (e) => errs.push(String(e)));
    await pg.goto(url + page, { waitUntil: "networkidle" });
    await pg.waitForTimeout(600);
    await pg.screenshot({ path: `${out}/${name}-${label}.png`, fullPage: true });
    if (script && label === "desktop") {
      const mod = await import(resolve(script));
      await mod.default(pg, { out, name });
    }
    console.log(`${label}: ${errs.length ? "ERRORS:\n  " + errs.join("\n  ") : "no console errors"} -> ${out}/${name}-${label}.png`);
    await ctx.close();
  }
  await browser.close(); srv.close();
}
