// Drives every control on gallery/calendar.html and captures state shots.
//   node gallery/tools/shoot.mjs calendar.html /tmp/trompe-shots/calendar --script=gallery/tools/calendar-steps.mjs
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`); if (!cond) fails++; };

export default async (pg, { out, name }) => {
  const shot = (s, o = {}) => pg.screenshot({ path: `${out}/${name}-${s}.png`, ...o });
  const st = () => pg.evaluate(() => ({ view: frost.view, cursor: frost.cursor, n: frost.events.length }));
  const light = (a) => pg.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
  await pg.evaluate(() => document.fonts.ready);

  // Mini picker keyboard grid.
  const s0 = await st();
  await pg.focus('.pday[aria-selected="true"]');
  await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowDown");
  const s1 = await st();
  ok(s1.cursor !== s0.cursor, `picker arrows move selection ${s0.cursor} -> ${s1.cursor}`);
  ok(await pg.evaluate(() => document.activeElement.getAttribute("aria-selected") === "true"), "focus follows selected cell");
  await pg.keyboard.press("PageDown");
  const s2 = await st();
  ok(s2.cursor.slice(0, 7) !== s1.cursor.slice(0, 7), `PageDown changes month -> ${s2.cursor}`);
  await pg.keyboard.press("PageUp"); await pg.keyboard.press("Home");
  ok((await pg.evaluate(() => new Date(frost.cursor).getDay())) === 1, "Home goes to Monday");
  await pg.waitForTimeout(400);
  await shot("picker-moved", { clip: await (await pg.$(".picker")).boundingBox().then((b) => ({ x: b.x - 20, y: b.y - 20, width: b.width + 40, height: b.height + 40 })) });

  // Today + prev/next glass keys.
  await pg.click("#today"); await pg.waitForTimeout(200);
  const today = (await st()).cursor;
  await pg.click("#next"); await pg.waitForTimeout(250);
  ok((await st()).cursor.slice(0, 7) !== today.slice(0, 7), "next key advances month");
  await pg.click("#prev"); await pg.waitForTimeout(250);
  ok((await st()).cursor.slice(0, 7) === today.slice(0, 7), "prev key returns");

  // Pressed state of a glass key, mid-press.
  const nb = await (await pg.$("#next")).boundingBox();
  await pg.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(120);
  ok(+(await pg.evaluate(() => getComputedStyle(document.querySelector("#next")).getPropertyValue("--tr-press"))) > 0.5, "glass key travels on press");
  await shot("key-pressed", { clip: { x: nb.x - 160, y: nb.y - 20, width: 420, height: nb.height + 40 } });
  await pg.mouse.move(nb.x + 400, nb.y + 300); await pg.mouse.up(); await pg.waitForTimeout(250);
  ok((await st()).cursor.slice(0, 7) === today.slice(0, 7), "press dragged off the key cancels");

  // Calendar visibility (enamel bead checkboxes).
  const before = await pg.$$eval("#vMonth .chip", (c) => c.length);
  await pg.click('[data-cal="fit"]');
  const after = await pg.$$eval("#vMonth .chip", (c) => c.length);
  ok(after < before && (await pg.$$eval("#vMonth .chip.c-vermilion", (c) => c.length)) === 0, `hiding Training removes its chips (${before} -> ${after})`);
  await pg.click('[data-cal="fit"]');
  ok((await pg.$$eval("#vMonth .chip", (c) => c.length)) === before, "showing it restores them");

  // Search.
  await pg.fill("#q", "review");
  const dimmed = await pg.$$eval("#vMonth .chip.dim", (c) => c.length);
  ok(dimmed > 0 && (await pg.textContent("#qnote")).includes("match"), `search dims non-matching chips (${dimmed}) and reports`);
  await shot("search");
  await pg.fill("#q", "");

  // Views.
  await pg.click('[data-view="week"]'); await pg.waitForTimeout(450);
  ok((await st()).view === "week" && (await pg.getAttribute('[data-view="week"]', "aria-pressed")) === "true", "Week key latches, week view shown");
  ok((await pg.getAttribute('[data-view="month"]', "aria-pressed")) === "false", "Month key released");
  await shot("week");
  await pg.click('[data-view="day"]'); await pg.waitForTimeout(450);
  ok((await st()).view === "day", "Day view");
  await shot("day");
  await pg.focus('[data-view="month"]'); await pg.keyboard.press("Enter"); await pg.waitForTimeout(450);
  ok((await st()).view === "month", "Month via keyboard");

  // Drag a chip to another day.
  const chip = await pg.$('#vMonth .chip:has(.tx:text-is("Design review"))');
  const from = await chip.getAttribute("data-date");
  const cb = await chip.boundingBox();
  const target = await pg.$(`#vMonth .cell[data-date="${await pg.evaluate((d) => { const t = new Date(d); t.setDate(t.getDate() + 8); return t.toISOString().slice(0, 10); }, from + "T12:00")}"]`);
  const tb = await target.boundingBox();
  await pg.mouse.move(cb.x + 30, cb.y + cb.height / 2); await pg.mouse.down();
  for (let i = 1; i <= 12; i++) await pg.mouse.move(cb.x + 30 + (tb.x + tb.width / 2 - cb.x - 30) * i / 12, cb.y + cb.height / 2 + (tb.y + tb.height - 22 - cb.y - cb.height / 2) * i / 12);
  await pg.waitForTimeout(220);
  ok(!!(await pg.$(".chip.ghost")) && !!(await pg.$(".cell.drop")), "drag lifts a ghost and lights the drop cell");
  await shot("drag");
  await pg.mouse.up(); await pg.waitForTimeout(450);
  const moved = await pg.evaluate(() => frost.events.find((e) => e.title === "Design review").date);
  ok(moved !== from, `drop moved event ${from} -> ${moved}`);

  // Keyboard alternative: Alt+arrow on a focused chip.
  await pg.focus('#vMonth .chip:has(.tx:text-is("Design review"))');
  await pg.keyboard.press("Alt+ArrowLeft"); await pg.waitForTimeout(300);
  const moved2 = await pg.evaluate(() => frost.events.find((e) => e.title === "Design review").date);
  ok(moved2 !== moved, `Alt+Left moves event ${moved} -> ${moved2}`);
  ok(await pg.evaluate(() => document.activeElement.classList.contains("chip")), "focus stays on moved chip");

  // New event via cell click; validation; full editor.
  const n0 = (await st()).n;
  const cell = await pg.$("#vMonth .cell:not(.out):nth-child(20)") || await pg.$("#vMonth .cell:not(.out)");
  const ccb = await (await pg.$$("#vMonth .cell:not(.out)"))[9].boundingBox();
  await pg.mouse.click(ccb.x + ccb.width - 10, ccb.y + ccb.height - 8); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.querySelector("#editor").open), "clicking a day opens the editor");
  await pg.click("#edSave"); await pg.waitForTimeout(400);
  ok((await pg.getAttribute("#fTitle", "aria-invalid")) === "true" && !(await pg.$eval("#eTitle", (e) => e.hidden)), "empty title shows error");
  await shot("editor-error");
  await pg.fill("#fTitle", "Glass studio tour");
  await pg.waitForTimeout(200); await pg.click("#fAll"); await pg.waitForTimeout(250);
  const swc = await pg.getAttribute("#fAll", "aria-checked"), swd = await pg.$eval("#fStart", (e) => e.disabled);
  ok(swc === "true" && swd, `All-day switch on disables times (${swc}, ${swd})`);
  await pg.focus("#fAll"); await pg.keyboard.press("Space"); await pg.waitForTimeout(250);
  ok((await pg.getAttribute("#fAll", "aria-checked")) === "false", "switch toggles by keyboard");
  await pg.fill("#fStart", "13:00"); await pg.fill("#fEnd", "15:30");
  await pg.focus("#fCal"); await pg.keyboard.press("ArrowDown"); await pg.waitForTimeout(150);
  ok(!(await pg.$eval("#calList", (e) => e.hidden)), "listbox opens with ArrowDown");
  await pg.keyboard.press("End"); await pg.keyboard.press("ArrowUp"); await pg.waitForTimeout(100);
  await shot("editor-listbox");
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.querySelector("#editor").open) && (await pg.$eval("#calList", (e) => e.hidden)), "Escape closes listbox only");
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("p"); await pg.keyboard.press("Enter");
  ok((await pg.textContent("#fCalT")) === "Personal", "type-ahead + Enter picks Personal");
  await pg.click('label:has(input[value="weekly"])');
  ok(await pg.$eval('input[value="weekly"]', (e) => e.checked), "repeat radio");
  await pg.focus("#fAlert"); await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight");
  ok((await pg.getAttribute("#fAlert", "aria-valuetext")) === "1 hour before", "alert slider by keyboard");
  const sb = await (await pg.$("#fAlert")).boundingBox();
  await pg.mouse.click(sb.x + sb.width * 0.42, sb.y + sb.height / 2); await pg.waitForTimeout(350);
  ok(+(await pg.getAttribute("#fAlert", "aria-valuenow")) === 2, "alert slider track click snaps to detent");
  await pg.fill("#fNotes", "Meet at the loading dock, bring the sample case.");
  await pg.click("#fTitle");
  await shot("editor");
  await pg.click("#edSave"); await pg.waitForTimeout(600);
  ok((await st()).n === n0 + 1 && !(await pg.evaluate(() => document.querySelector("#editor").open)), "Save adds event and closes");
  ok(!!(await pg.$('#vMonth .chip:has(.tx:text-is("Glass studio tour"))')), "new chip in grid");

  // Edit + delete.
  await pg.click('#vMonth .chip:has(.tx:text-is("Glass studio tour"))'); await pg.waitForTimeout(400);
  ok((await pg.textContent("#edh")) === "Edit event" && (await pg.getAttribute("#edDel", "aria-disabled")) === "false", "chip click opens editor with Delete enabled");
  await pg.click("#edDel"); await pg.waitForTimeout(500);
  ok((await st()).n === n0, "Delete removes event");
  await pg.click("#new"); await pg.waitForTimeout(350);
  ok((await pg.getAttribute("#edDel", "aria-disabled")) === "true", "Delete disabled for new event");
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(350);
  ok(!(await pg.evaluate(() => document.querySelector("#editor").open)), "Escape closes editor");

  // Hover state of a chip + alternate light.
  await pg.mouse.move(0, 0);
  await shot("final");
  for (const a of [45, 180]) { await light(a); await pg.waitForTimeout(150); await shot(`light-${a}`); }
  await light(315);

  // 2x detail crops: slab edge, standoff, chips, lens.
  {
    const c2 = await pg.context().browser().newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const p2 = await c2.newPage(); await p2.goto(pg.url()); await p2.waitForTimeout(700);
    await p2.screenshot({ path: `${out}/${name}-detail-picker.png`, clip: { x: 20, y: 150, width: 330, height: 360 } });
    await p2.screenshot({ path: `${out}/${name}-detail-grid.png`, clip: { x: 1000, y: 380, width: 440, height: 520 } });
    await c2.close();
  }

  // Phone: agenda + editor.
  const ctx = await pg.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const ph = await ctx.newPage();
  const errs = []; ph.on("pageerror", (e) => errs.push(String(e))); ph.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await ph.goto(pg.url()); await ph.waitForTimeout(700);
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= 390), "phone: no horizontal scroll");
  const small = await ph.evaluate(() => [...document.querySelectorAll(".hdr .gkey, .pday, .ag-row, .cals label, #q")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 43.5 || r.height < 43.5); }).map((b) => b.className + " " + Math.round(b.getBoundingClientRect().width) + "x" + Math.round(b.getBoundingClientRect().height)));
  ok(small.length === 0, "phone: targets >= 44px " + small.slice(0, 4).join(", "));
  await ph.screenshot({ path: `${out}/${name}-phone-top.png` });
  await ph.tap(".ag-row"); await ph.waitForTimeout(500);
  await ph.screenshot({ path: `${out}/${name}-phone-editor.png` });
  ok(errs.length === 0, "phone: no console errors " + errs.join(" | "));
  await ctx.close();

  console.log(fails ? `${fails} FAILED` : "all checks passed");
};
