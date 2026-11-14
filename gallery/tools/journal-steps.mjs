// Drives every control on gallery/journal.html, asserts state, and captures shots.
//   node gallery/tools/shoot.mjs journal.html /tmp/trompe-shots/journal --script=gallery/tools/journal-steps.mjs
const ok = (c, msg) => { if (!c) { console.log("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };

export default async (page, { out, name }) => {
  const shot = (s, full = false) => page.screenshot({ path: `${out}/${name}-${s}.png`, fullPage: full });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const st = () => page.evaluate(() => document.getElementById("journal").dataset.state);

  // 1. band: a short drag springs back, a long drag snaps it off and opens the cover
  const b = await (await page.$("#band")).boundingBox();
  const bx = b.x + b.width / 2, by = b.y + b.height / 2;
  await page.mouse.move(bx, by); await page.mouse.down();
  await page.mouse.move(bx + 18, by + 18, { steps: 5 });
  const mid = await page.evaluate(() => +getComputedStyle(document.getElementById("band")).getPropertyValue("--pull"));
  ok(mid > 0.3, `band stretches while dragged (pull=${mid})`);
  await shot("band-stretch");
  await page.mouse.up(); await page.waitForTimeout(700);
  ok(await st() === "closed", "short pull springs back, journal stays closed");
  await page.mouse.move(bx, by); await page.mouse.down();
  await page.mouse.move(bx + 30, by + 30, { steps: 4 });
  await shot("band-pull");
  await page.mouse.move(bx + 120, by + 120, { steps: 10 });
  await page.waitForTimeout(450);
  await shot("cover-opening");
  await page.mouse.up();
  await page.waitForTimeout(1100);
  ok(await st() === "open", "long pull snaps band and opens journal");
  ok(await page.evaluate(() => document.getElementById("journal").dataset.band) === "off", "band is off");
  await shot("open");

  // 2. trip picker (combobox) via keyboard
  await page.focus("#tripBtn");
  await page.keyboard.press("ArrowDown");
  ok(await page.getAttribute("#tripBtn", "aria-expanded") === "true", "ArrowDown opens trip list");
  await page.keyboard.press("ArrowDown");
  await shot("trip-list");
  await page.keyboard.press("Enter");
  ok((await page.textContent("#tripName")) === "Loch Sorn Circuit", "Enter picks second trip");
  ok(await page.getAttribute("#tripBtn", "aria-expanded") === "false", "list closes after pick");
  await page.keyboard.press("c"); await page.keyboard.press("Enter");
  ok((await page.textContent("#tripName")) === "Corrie Bàn Bivvy", "type-ahead 'c' + Enter picks Corrie Bàn");
  await page.click("#tripBtn"); await page.click("#trip-0");
  ok((await page.textContent("#tripName")) === "Harrowfell Ridge", "mouse pick first trip");

  // 3. tabs: click Packing, flip mid-shot
  await page.click("#t-pack");
  await page.waitForTimeout(300);
  await shot("page-turn");
  await page.waitForTimeout(600);
  ok(await page.getAttribute("#t-pack", "aria-selected") === "true", "Packing tab selected");
  ok(!(await page.$eval("#p-pack", (e) => e.hidden)), "Packing panel visible");

  // 4. checkboxes
  const before = await page.textContent("#tally");
  await page.click("#checks li:nth-child(1) label");
  await page.keyboard.press("Tab"); // focus moves; use keyboard on item 3
  await page.focus("#checks li:nth-child(3) input"); await page.keyboard.press("Space");
  await page.waitForTimeout(700);
  const after = await page.textContent("#tally");
  ok(before !== after && after.startsWith("4"), `ticks update tally (${before} -> ${after})`);

  // 5. ink + stamp
  await page.click(".ink.b"); await page.waitForTimeout(150);
  ok(await page.getAttribute(".ink.b", "aria-pressed") === "true" && await page.getAttribute(".ink.r", "aria-pressed") === "false", "indigo ink selected, red released");
  await page.click(".ink.r");
  await page.click("#stamp"); await page.waitForTimeout(1000);
  await shot("stamping");
  await page.waitForTimeout(700);
  await page.focus("#stamp"); await page.keyboard.press("Enter"); await page.waitForTimeout(1700);
  const imps = await page.$$eval("#p-pack .imp", (e) => e.length);
  ok(imps === 2, `two stamps on Packing page (${imps})`);
  await shot("packing");

  // 6. press-stud pocket
  await page.click("#stud"); await page.waitForTimeout(650);
  ok(await page.getAttribute("#stud", "aria-expanded") === "true", "press-stud opens pocket");
  await shot("pocket");

  // 7. notes: keyboard tab nav, add a note, delete via dialog
  await page.focus("#t-pack"); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(900);
  ok(await page.getAttribute("#t-notes", "aria-selected") === "true", "ArrowDown moves to Notes tab");
  await page.click("#addNote");
  await page.fill("#nfTitle", "Bus times");
  await page.fill("#nfBody", "Keldby 16:10, 17:40 (Sun).");
  await shot("note-form");
  await page.click("#noteForm .btn.pri"); await page.waitForTimeout(500);
  ok((await page.$$eval(".icard h3", (e) => e.map((x) => x.textContent)))[0] === "Bus times", "Save note adds card at top");
  await page.click(".icard .del"); await page.waitForTimeout(400);
  ok(await page.$eval("#tear", (d) => d.open), "delete opens confirm dialog");
  await shot("dialog");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  ok((await page.$$eval(".icard", (e) => e.length)) === 4, "Escape keeps the card");
  await page.click(".icard .del"); await page.waitForTimeout(350);
  await page.click("#tear .btn.pri"); await page.waitForTimeout(600);
  ok((await page.$$eval(".icard", (e) => e.length)) === 3, "Tear out removes the card");
  await page.click("#addNote"); await page.keyboard.press("Escape");
  ok(!(await page.$("#noteForm")), "Escape cancels the new-note form");
  await page.click("#t-trip"); await page.waitForTimeout(900);
  ok(await page.getAttribute("#t-trip", "aria-selected") === "true", "back to Trip (backward turn)");

  // 8. alternate light angles
  for (const a of [45, 180]) {
    await page.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
    await page.waitForTimeout(300);
    const az = await page.$eval("feDistantLight.bind", (l) => l.getAttribute("azimuth"));
    ok(+az === (a + 270) % 360, `deboss light azimuth follows (${a}deg -> ${az})`);
    await shot("light-" + a);
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // 9. close with the button, reopen with keyboard on the band
  await page.click("#openBtn"); await page.waitForTimeout(450);
  await shot("closing");
  await page.waitForTimeout(1100);
  ok(await st() === "closed", "Close journal closes");
  ok(await page.evaluate(() => document.getElementById("journal").dataset.band) === "on", "band back on");
  await shot("closed-again");
  for (const a of [45, 180]) {
    await page.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
    await page.waitForTimeout(250); await shot("closed-light-" + a);
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));
  await page.focus("#band"); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  ok(await st() === "open", "Enter on band opens");

  // 10. phone: layout, no horizontal scroll, open, tabs on top
  const ctx = page.context(); const browser = ctx.browser();
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await pctx.newPage();
  p.on("pageerror", (e) => errs.push("phone: " + e)); p.on("console", (m) => m.type() === "error" && errs.push("phone: " + m.text()));
  await p.goto(page.url(), { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "phone: no horizontal scroll (closed)");
  await p.screenshot({ path: `${out}/${name}-phone-closed.png` });
  await p.tap("#openBtn"); await p.waitForTimeout(1600);
  ok(await p.evaluate(() => document.getElementById("journal").dataset.state) === "open", "phone: opens");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "phone: no horizontal scroll (open)");
  ok(await p.getAttribute("[role=tablist]", "aria-orientation") === "horizontal", "phone: tablist horizontal");
  const small = await p.$$eval(".tab, .stud, .ink, #stamp, #openBtn, #tripBtn", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => Math.min(w, h) < 40));
  ok(small.length === 0, "phone: primary targets >= ~44px " + JSON.stringify(small));
  await p.screenshot({ path: `${out}/${name}-phone-open.png`, fullPage: true });
  await p.tap("#t-pack"); await p.waitForTimeout(900);
  await p.tap("#checks li:nth-child(4) label"); await p.waitForTimeout(500);
  await p.tap("#stud"); await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${name}-phone-packing.png`, fullPage: true });
  await p.tap("#t-notes"); await p.waitForTimeout(900);
  await p.tap("#addNote"); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-phone-notes.png`, fullPage: true });
  await pctx.close();

  ok(errs.length === 0, "no console errors " + JSON.stringify(errs));
};
