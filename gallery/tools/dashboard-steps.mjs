// Drives every control on dashboard.html, asserts state, and takes extra shots.
//   node gallery/tools/shoot.mjs dashboard.html /tmp/trompe-shots/dashboard --script=gallery/tools/dashboard-steps.mjs
export default async (pg, { out, name }) => {
  const errs = []; pg.on("pageerror", (e) => errs.push(String(e))); pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  const ok = (c, msg) => { console.log(`${c ? "PASS" : "FAIL"} ${msg}`); if (!c) process.exitCode = 1; };
  const S = () => pg.evaluate(() => ({ ...meridian.S, sel: [...meridian.S.sel], tot: meridian.M.tot, util: meridian.M.util }));
  const shot = (n, o = {}) => pg.screenshot({ path: `${out}/${name}-${n}.png`, ...o });
  // element box in page coordinates, for full-page clipped shots that don't depend on scroll position
  const pbox = (sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
  const W = (ms) => pg.waitForTimeout(ms);
  await pg.evaluate(() => document.fonts.ready);

  // tabs
  await pg.click("#t-fleet"); await W(250);
  ok(await pg.getAttribute("#t-fleet", "aria-selected") === "true" && await pg.getAttribute("#t-overview", "aria-selected") === "false", "tab click selects Fleet");
  ok((await pg.textContent("#vtitle")) === "Fleet", "title follows tab");
  await pg.keyboard.press("ArrowRight"); await W(250);
  ok(await pg.getAttribute("#t-riders", "aria-selected") === "true", "ArrowRight moves to Riders");
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector("#t-riders")).getPropertyValue("--tr-press")) > 0.3, "keyboard-selected tab rests latched");
  await pg.click("#t-overview"); await W(250);

  // range listbox
  const tot0 = (await S()).tot;
  await pg.click("#range-btn"); await W(200);
  ok(await pg.isVisible("#range-list"), "range menu opens");
  ok(await pg.evaluate(() => document.activeElement.id) === "range-list", "focus moves into listbox");
  await pg.keyboard.press("ArrowUp"); await W(60);
  await shot("menu", { clip: { x: 0, y: 0, width: 1440, height: 520 } });
  await pg.keyboard.press("Enter"); await W(700);
  let s = await S(); ok(s.range === "today" && !(await pg.isVisible("#range-list")), "ArrowUp + Enter picks Today and closes");
  ok(s.tot !== tot0, `deliveries recomputed (${Math.round(tot0)} -> ${Math.round(s.tot)})`);
  await pg.focus("#range-btn"); await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("3"); await pg.keyboard.press("Enter"); await W(200);
  ok((await S()).range === "d30", "typeahead '3' + Enter picks 30 days");
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Escape"); await W(100);
  ok(!(await pg.isVisible("#range-list")) && (await S()).range === "d30", "Escape closes without change");
  await pg.click("#range-btn"); await pg.click("#o-d7"); await W(700);
  ok((await S()).range === "d7", "click option picks 7 days");

  // region rotary
  await pg.focus("#region"); await pg.keyboard.press("ArrowRight"); await W(500);
  ok((await S()).region === 1 && await pg.getAttribute("#region", "aria-valuetext") === "Harbour", "knob ArrowRight -> Harbour");
  const kb = await (await pg.$("#region")).boundingBox(), cx = kb.x + kb.width / 2, cy = kb.y + kb.height / 2;
  await pg.mouse.move(cx, cy - 16); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { const a = -Math.PI / 2 + i * 0.1; await pg.mouse.move(cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)); }
  await pg.mouse.up(); await W(500);
  ok((await S()).region >= 2, `knob drag clockwise -> region ${(await S()).region}`);
  await pg.click(".rl[data-i='3']"); await W(600);
  ok((await S()).region === 3 && await pg.$eval(".rl[data-i='3']", (e) => e.classList.contains("on")), "label click -> Hillside, legend lit");
  ok((await pg.$$eval("#rows tr .ck[aria-disabled='false']", (e) => e.length)) === 5, "Hillside shows 5 routes, 6th soft-key disabled");
  await pg.click(".rl[data-i='0']"); await W(600);

  // live
  const c0 = (await S()).clock, tLive0 = (await S()).tot;
  await pg.click("#live"); await W(3300);
  s = await S(); ok(s.live && await pg.getAttribute("#live", "aria-checked") === "true", "live toggle on");
  ok(s.clock > c0, `live ticks advance clock (+${s.clock - c0}s)`);
  ok(s.tot > tLive0, `live ticks add deliveries in 7-day view (${Math.round(tLive0)} -> ${Math.round(s.tot)})`);
  await pg.click("#range-btn"); await pg.click("#o-today"); await W(3000);
  const t1 = (await S()).tot; await W(1600);
  ok((await S()).tot > t1, "live keeps ticking in Today view");
  await shot("live-today", { fullPage: true, clip: await pbox(".grid").then((b) => ({ x: b.x, y: b.y, width: b.width, height: 560 })) });
  await pg.click("#range-btn"); await pg.click("#o-d7"); await W(600);
  await shot("live", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await pg.focus("#live"); await pg.keyboard.press("Space"); await W(300);
  s = await S(); ok(!s.live, "Space turns live off"); const c1 = s.clock; await W(1700);
  ok((await S()).clock === c1, "no ticks after live off");

  // search
  await pg.fill("#search", "ridge"); await W(100);
  ok((await pg.$$eval("#rows tr .ck[aria-disabled='false']", (e) => e.length)) === 1, "search 'ridge' -> 1 row");
  await pg.fill("#search", "zzz"); await W(100);
  ok(await pg.getAttribute("#search", "aria-invalid") === "true", "no match -> invalid state");
  await shot("search-empty", { fullPage: true, clip: await pbox(".m-tbl").then((b) => ({ x: 0, y: b.y - 10, width: 1440, height: b.height + 20 })) });
  await pg.focus("#search"); await pg.keyboard.press("Escape"); await W(100);
  ok((await pg.inputValue("#search")) === "" && await pg.getAttribute("#search", "aria-invalid") === "false", "Escape clears search");

  // soft-keys + bulk
  ok(await pg.getAttribute("#hold", "aria-disabled") === "true", "bulk disabled with nothing selected");
  const keys = await pg.$$("#rows .ck");
  await keys[0].click(); await keys[2].click(); await W(300);
  s = await S(); ok(s.sel.length === 2 && await pg.getAttribute("#ck-all", "aria-checked") === "mixed", "2 rows selected, header mixed");
  ok(await pg.$eval("#rows tr", (e) => e.classList.contains("sel")), "selected row inverted on e-paper");
  await shot("selected", { fullPage: true, clip: await pbox(".m-tbl").then((b) => ({ x: 0, y: b.y - 10, width: 1440, height: b.height + 20 })) });
  ok(await pg.getAttribute("#hold", "aria-disabled") === "false", "bulk enabled");
  await pg.click("#hold"); await W(500);
  s = await S(); ok(s.sel.length === 0 && Object.values(s.flags).filter((v) => v === "Held").length === 2, "Hold flags 2 routes, clears selection");
  ok((await pg.textContent("#status")).includes("on hold"), "status reports hold");
  await pg.click("#ck-all"); await W(200);
  ok((await S()).sel.length === 6 && await pg.getAttribute("#ck-all", "aria-checked") === "true", "select all");
  await pg.focus("#ck-all"); await pg.keyboard.press("Enter"); await W(200);
  ok((await S()).sel.length === 0, "Enter on select-all clears");
  await pg.focus("#rows .ck"); await pg.keyboard.press("Space"); await W(200);
  ok((await S()).sel.length === 1, "Space toggles a soft-key"); await pg.keyboard.press("Space"); await W(200);
  await pg.click("#reassign", { force: true }); await W(100); ok((await S()).sel.length === 0 && !(await pg.textContent("#status")).includes("reassign"), "disabled reassign is inert");

  // SLA fader
  await pg.focus("#sla"); for (let i = 0; i < 4; i++) await pg.keyboard.press("ArrowRight"); await W(300);
  ok((await S()).sla === 97 && (await pg.textContent("#sla-out")) === "97.0%", "fader keyboard -> 97.0%");
  const fb = await (await pg.$("#sla")).boundingBox();
  await pg.mouse.click(fb.x + 12, fb.y + fb.height / 2); await W(300);
  ok((await S()).sla === 90, "fader click at left -> 90");
  await pg.focus("#sla"); await pg.keyboard.press("End"); await pg.keyboard.press("Home");
  for (let i = 0; i < 10; i++) await pg.keyboard.press("ArrowRight"); await W(400);

  // chart hover + keyboard
  const cb = await (await pg.$("#chart")).boundingBox();
  await pg.mouse.move(cb.x + cb.width * 0.62, cb.y + cb.height / 2); await W(150);
  ok(await pg.isVisible("#tip"), "chart hover shows readout");
  await shot("chart-hover", { clip: { x: cb.x - 30, y: cb.y - 60, width: cb.width + 60, height: cb.height + 90 } });
  await pg.mouse.move(5, 5); await pg.focus("#chart"); await pg.keyboard.press("ArrowLeft"); await W(100);
  ok((await pg.textContent("#tip")).startsWith("13:00"), "chart ArrowLeft reads 13:00");

  // refresh, dismiss
  await pg.click("#refresh"); await W(300); ok((await pg.textContent("#status")).startsWith("Synced"), "refresh syncs");
  await pg.click("#dismiss"); await W(500); ok(!(await pg.$("#alert")), "alert dismissed");

  // export dialog
  await pg.click("#export"); await W(350);
  ok(await pg.evaluate(() => document.querySelector("#dlg").open), "export dialog opens");
  await pg.click("label.jw:nth-of-type(2)"); await pg.fill("#note", "Hillside brake service context for Monday's review.");
  ok(await pg.isChecked("input[value=pdf]"), "PDF jewel selected");
  await shot("dialog");
  await pg.click("#do-export"); await W(300);
  ok(!(await pg.evaluate(() => document.querySelector("#dlg").open)) && (await pg.textContent("#status")).endsWith(".pdf"), "Export closes dialog, status names the pdf");
  await pg.click("#export"); await W(300); await pg.keyboard.press("Escape"); await W(200);
  ok(!(await pg.evaluate(() => document.querySelector("#dlg").open)), "Escape closes dialog");

  // alternate light angles
  for (const a of [45, 180]) {
    await pg.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a); await W(200);
    await shot(`light${a}`, { fullPage: true });
  }
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // phone: overflow + interaction shots
  const ctx = await pg.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const ph = await ctx.newPage(); ph.on("pageerror", (e) => errs.push("phone: " + e));
  await ph.goto(pg.url(), { waitUntil: "networkidle" }); await ph.waitForTimeout(500);
  const sw = await ph.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, `phone no horizontal scroll (scrollWidth ${sw})`);
  const small = await ph.$$eval("button, [role=slider], [role=switch], input, .rl", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44) && !e.closest(".tg-bar") && e.getAttribute("aria-disabled") !== "true"; }).map((e) => `${e.id || e.className}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  console.log("phone targets under 44px:", small.join(", ") || "none");
  await ph.tap("#range-btn"); await ph.waitForTimeout(250);
  await ph.screenshot({ path: `${out}/${name}-phone-menu.png` });
  await ph.tap("#o-today"); await ph.waitForTimeout(700);
  await ph.tap("#export"); await ph.waitForTimeout(350);
  await ph.screenshot({ path: `${out}/${name}-phone-dialog.png` });
  await ctx.close();
  console.log(errs.length ? "STEP ERRORS:\n  " + errs.join("\n  ") : "steps: no console errors");
};
