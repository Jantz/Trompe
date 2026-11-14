// Drives every control on gallery/settings.html and shoots the interesting states.
//   node gallery/tools/shoot.mjs settings.html /tmp/trompe-shots/settings --script=gallery/tools/settings-steps.mjs
export default async (pg, { out, name }) => {
  const fails = [];
  const ok = (cond, msg) => { console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`); if (!cond) fails.push(msg); };
  const shot = (s, o = {}) => pg.screenshot({ path: `${out}/${name}-${s}.png`, ...o });
  const attr = (sel, a) => pg.getAttribute(sel, a);
  const st = () => pg.evaluate(() => ({ ...window.alloy.st }));
  const wait = (ms = 250) => pg.waitForTimeout(ms);
  const clip = async (sel, pad = 24) => { const b = await (await pg.$(sel)).boundingBox(); return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 }; };

  // Appearance: latching bank, mouse then keyboard
  await pg.click('#bank [data-theme="dark"]'); await wait(400);
  ok(await attr('#bank [data-theme="dark"]', "aria-pressed") === "true", "dark key latched");
  ok(await attr('#bank [data-theme="light"]', "aria-pressed") === "false", "light key released");
  ok(await attr("#app", "data-theme") === "dark", "slab re-themed dark");
  await shot("dark", { fullPage: true });
  await pg.keyboard.press("ArrowRight"); await wait(400);
  ok(await attr('#bank [data-theme="auto"]', "aria-pressed") === "true", "ArrowRight latches Auto");
  await pg.keyboard.press("ArrowLeft"); await wait(400);
  ok((await st()).theme === "dark", "ArrowLeft back to Dark");

  // Brightness fader: drag cap, then keys
  const cap = await (await pg.$("#bright .cap")).boundingBox();
  const fb = await (await pg.$("#bright")).boundingBox();
  await pg.mouse.move(cap.x + cap.width / 2, cap.y + cap.height / 2); await pg.mouse.down();
  await pg.mouse.move(fb.x + fb.width * 0.3, cap.y + cap.height / 2, { steps: 8 });
  ok(await pg.$eval("#bright", (e) => e.hasAttribute("data-dragging")), "fader shows dragging state");
  await pg.mouse.up(); await wait(300);
  const b1 = (await st()).bright;
  ok(b1 < 50 && b1 > 15, `fader dragged to ${b1}`);
  await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight");
  ok((await st()).bright === b1 + 2, "fader ArrowRight x2");
  ok(Number(await pg.evaluate(() => getComputedStyle(document.getElementById("app")).getPropertyValue("--dim"))) > 0.2, "glass dimmed");
  await pg.mouse.click(fb.x + fb.width * 0.85, cap.y + cap.height / 2); await wait(300);
  ok((await st()).bright > 80, "track click jumps");

  // Night shift switch: click, keyboard
  await pg.click("#night"); await wait(300);
  ok(await attr("#night", "aria-checked") === "false", "night shift off by click");
  await pg.keyboard.press("Space"); await wait(300);
  ok(await attr("#night", "aria-checked") === "true", "night shift on by Space");
  // Disabled HDR: click and keys do nothing
  await pg.click("#hdr", { force: true }); await pg.focus("#hdr"); await pg.keyboard.press("Space"); await pg.keyboard.press("ArrowRight"); await wait(200);
  ok(await attr("#hdr", "aria-checked") === "false", "disabled HDR ignores click + keys");

  // Schedule listbox: mouse open + pick, keyboard open + arrows + Enter, Escape, type-ahead
  await pg.click("#sched"); await wait(300);
  ok(await pg.$eval("#sched-list", (e) => e.matches(":popover-open")), "listbox opens on click");
  ok(await attr("#sched", "aria-expanded") === "true", "aria-expanded true");
  await shot("listbox", { clip: await clip("#c-bright", 60) });
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter"); await wait(300);
  ok((await st()).sched === "late", "ArrowDown + Enter picks Late evening");
  ok(!(await pg.$eval("#sched-list", (e) => e.matches(":popover-open"))), "listbox closed after pick");
  ok(await pg.evaluate(() => document.activeElement.id) === "sched", "focus returns to trigger");
  await pg.keyboard.press("Enter"); await wait(250);
  ok(await pg.$eval("#sched-list", (e) => e.matches(":popover-open")), "Enter opens listbox");
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Escape"); await wait(250);
  ok(!(await pg.$eval("#sched-list", (e) => e.matches(":popover-open"))) && (await st()).sched === "late", "Escape closes without change");
  await pg.keyboard.press("ArrowDown"); await wait(200); await pg.keyboard.press("m"); await pg.keyboard.press("Enter"); await wait(250);
  ok((await st()).sched === "manual", "type-ahead 'm' picks Manual only");
  await pg.click("#sched"); await wait(250);
  await pg.click("#opt-night"); await wait(250);
  ok((await st()).sched === "night", "click option picks Night owl");

  // Resolution jewels
  await pg.click('input[name=res][value=space]'); await wait(150);
  ok((await st()).res === "space", "radio More space");
  await pg.keyboard.press("ArrowUp"); await wait(150);
  ok((await st()).res === "default", "radio ArrowUp to Default");

  // Toggle keys
  await pg.click("#o-motion"); ok((await st()).motion === true, "Reduce motion checked");
  await pg.focus("#o-rate"); await pg.keyboard.press("Space"); ok((await st()).rate === false, "Show refresh rate unchecked by Space");

  // Stepper
  await pg.click("#ts-up"); await wait(150); await pg.click("#ts-up"); await wait(150); await pg.click("#ts-dn"); await wait(150);
  ok((await st()).size === 15, "text size 15 after +,+,-");
  ok((await pg.textContent("#ts-txt")) === "15 point", "LCD text alternative updated");
  await pg.focus("#ts-up"); await pg.keyboard.press("Enter"); await wait(150);
  ok((await st()).size === 16, "stepper Enter");

  // Display name validation
  await pg.fill("#dname", ""); await wait(100);
  ok(await attr("#dname", "aria-invalid") === "true", "empty name flagged");
  ok((await pg.textContent("#dname-msg")).includes("Name is required"), "error message shown");
  await shot("states", { fullPage: true });
  await pg.click("#apply"); await wait(300);
  ok(await pg.evaluate(() => document.activeElement.id) === "dname", "Apply with error focuses name");
  await pg.fill("#dname", "Studio Right"); await wait(100);
  ok(await attr("#dname", "aria-invalid") === "false", "error clears");

  // Apply
  ok((await pg.textContent("#st-txt")) === "Unsaved changes", "status shows unsaved");
  await pg.click("#apply"); await wait(300);
  ok((await pg.textContent("#st-txt")) === "All changes applied", "Apply commits");

  // Restore dialog: open, Escape, open, Cancel, open, Restore
  await pg.click("#restore"); await wait(500);
  ok(await pg.$eval("#dlg", (d) => d.open), "dialog opens");
  await shot("dialog");
  await pg.keyboard.press("Escape"); await wait(400);
  ok(!(await pg.$eval("#dlg", (d) => d.open)), "Escape closes dialog");
  await pg.click("#restore"); await wait(500); await pg.click("#d-cancel"); await wait(400);
  ok(!(await pg.$eval("#dlg", (d) => d.open)) && (await st()).theme === "dark", "Cancel keeps settings");
  await pg.click("#restore"); await wait(500); await pg.click("#d-ok"); await wait(600);
  const s2 = await st();
  ok(s2.theme === "light" && s2.bright === 72 && s2.size === 14 && s2.res === "default" && s2.sched === "sunset" && s2.motion === false, "Restore resets defaults");
  ok(await attr('#bank [data-theme="light"]', "aria-pressed") === "true" && await attr('#bank [data-theme="dark"]', "aria-pressed") === "false", "keys re-latched");
  ok(await pg.inputValue("#dname") === "Studio Right", "name kept");

  // Navigation + search
  await pg.click('.tab[data-sec="network"]'); await wait(400);
  ok((await pg.textContent("#pane-title")) === "Network" && await attr('.tab[data-sec="network"]', "aria-current") === "page", "nav to Network");
  await shot("network");
  await pg.click('.tab[data-sec="display"]'); await wait(300);
  await pg.fill("#q", "pri"); await wait(100);
  ok(await pg.$$eval(".nav li:not([hidden])", (l) => l.length) === 1, "search filters nav");
  await pg.fill("#q", ""); await wait(100);

  // Focus ring sample + light angles
  await pg.focus("#dname"); await pg.keyboard.press("End");
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "45deg")); await wait(200);
  await shot("light45", { fullPage: true });
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "180deg")); await wait(200);
  await shot("light180", { fullPage: true });
  await pg.click('#bank [data-theme="dark"]'); await wait(400);
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "45deg")); await wait(200);
  await shot("dark-light45", { fullPage: true });
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // Detail crops at desktop
  await pg.click('#bank [data-theme="light"]'); await wait(400);
  await shot("crop-bright", { clip: await clip("#c-bright", 30) });
  await shot("crop-app", { clip: await clip("#c-app", 30) });
  await shot("crop-side", { clip: { x: 120, y: 80, width: 520, height: 520 } });
  await shot("crop-opts", { clip: await clip("#c-opts", 30) });

  // Phone: overflow + dark + listbox
  await pg.setViewportSize({ width: 390, height: 844 }); await wait(400);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), "no horizontal scroll at 390");
  await pg.click('#bank [data-theme="dark"]'); await wait(400);
  await shot("phone-dark", { fullPage: true });
  await pg.click("#sched"); await wait(300);
  await shot("phone-listbox");
  await pg.keyboard.press("Escape");
  const small = await pg.$$eval("button, input:not(.jewel):not(.tk), [role=switch], [role=slider], label.chk, label.jrow", (els) => els.filter((e) => e.offsetParent && e.closest(".slab")).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => Math.min(w, h) < 24));
  ok(small.length === 0, "no target under 24px on phone " + JSON.stringify(small));
  await pg.setViewportSize({ width: 1440, height: 900 });
  console.log(fails.length ? `\n${fails.length} FAILED` : "\nall steps passed");
};
