// Renders the gallery index thumbnails: node gallery/tools/thumbs.mjs [slug ...]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./shoot.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../img");
mkdirSync(out, { recursive: true });
const all = ["dashboard", "settings", "checkout", "files", "calendar", "messages", "journal", "thermostat"];
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;
const { srv, url } = await serve();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.75, reducedMotion: "reduce" });
for (const s of slugs) {
  const pg = await ctx.newPage();
  await pg.goto(`${url}${s}.html`, { waitUntil: "networkidle" });
  await pg.addStyleTag({ content: ".tg-bar{display:none!important}" });
  if (s === "journal") await pg.evaluate(() => document.querySelector("#openBtn, [data-open], .open-journal")?.click());
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: `${out}/${s}.jpg`, type: "jpeg", quality: 80 });
  console.log("wrote", `${out}/${s}.jpg`);
  await pg.close();
}
await browser.close(); srv.close();
