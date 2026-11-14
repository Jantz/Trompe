// Drives every control on gallery/messages.html, asserts state changes, and shoots
// alternate light angles plus the phone list -> thread flow.
//   node gallery/tools/shoot.mjs messages.html /tmp/trompe-shots/messages --script=gallery/tools/messages-steps.mjs
export default async (page, { out, name }) => {
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));
  const fails = [];
  const ok = (cond, msg) => { console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (s) => page.screenshot({ path: `${out}/${name}-${s}.png` });
  const attr = (sel, a) => page.getAttribute(sel, a);
  const count = (sel) => page.locator(sel).count();

  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "desktop: no horizontal scroll");
  ok(await attr("#infoBtn", "aria-expanded") === "true", "info pad open by default on wide screens");
  ok(await count(".typing") === 1, "typing indicator visible on load");

  // Search
  await page.click("#q"); await page.keyboard.type("tide");
  ok(await count(".row") === 1, "search 'tide' filters to 1 row");
  await page.keyboard.press("Escape");
  ok(await count(".row") === 8, "Escape clears search");

  // Filter keys (latching group)
  await page.click('.fkey[data-f="unread"]'); await wait(200);
  ok(await attr('.fkey[data-f="unread"]', "aria-pressed") === "true" && await attr('.fkey[data-f="all"]', "aria-pressed") === "false", "Unread key latches, All releases");
  ok(await count(".row") === 3, "Unread shows 3 chats");
  await page.click('.fkey[data-f="groups"]'); await wait(200);
  ok(await count(".row") === 2, "Groups shows 2 chats");
  await shot("filters");
  await page.focus('.fkey[data-f="all"]'); await page.keyboard.press("Space"); await wait(200);
  ok(await attr('.fkey[data-f="all"]', "aria-pressed") === "true", "All key latches from keyboard");

  // Select another chat, then back
  await page.click('.row[data-id="juno"]'); await wait(200);
  ok((await page.textContent("#thName")).includes("Juno"), "row click opens Juno's thread");
  ok(!(await page.locator('.row[data-id="juno"] .badge').count()), "opening clears the unread badge");
  await page.click('.row[data-id="mara"]'); await wait(200);

  // Reaction menu on the "Okay that view" bubble
  const target = page.locator(".msg.me").filter({ hasText: "Bringing the good coffee" });
  await target.hover(); await target.locator(".react").click(); await wait(250);
  ok(await page.evaluate(() => document.getElementById("reactMenu").matches(":popover-open")), "react button opens reaction menu");
  await shot("react-menu");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  ok(await page.evaluate(() => document.activeElement.dataset.act) === "laugh", "arrow keys move through reactions");
  await page.keyboard.press("Enter"); await wait(500);
  ok(await target.locator(".pin").count() === 1, "reaction pin added");
  ok(!(await page.evaluate(() => document.getElementById("reactMenu").matches(":popover-open"))), "menu closed after choice");

  // Composer
  ok(await attr("#send", "aria-disabled") === "true", "send disabled while empty");
  await page.click("#ta");
  const h0 = (await page.locator("#ta").boundingBox()).height;
  await page.keyboard.type("Perfect. I'll grab the ferry tickets tonight");
  await page.keyboard.press("Shift+Enter"); await page.keyboard.type("and bring the blue thermos 🔥");
  await page.keyboard.press("Shift+Enter"); await page.keyboard.type("see you Saturday");
  const h1 = (await page.locator("#ta").boundingBox()).height;
  ok(h1 > h0 + 20, `textarea grows (${h0.toFixed(0)} -> ${h1.toFixed(0)})`);
  ok(await attr("#send", "aria-disabled") === "false", "send enabled with text");
  await shot("composing");
  const n0 = await count(".msg.me");
  // Hold the send key down for a mid-travel shot.
  const sb = await page.locator("#send").boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.mouse.down(); await wait(120);
  await page.screenshot({ path: `${out}/${name}-send-pressed.png`, clip: { x: sb.x - 400, y: sb.y - 120, width: 520, height: 200 } });
  await page.mouse.up(); await wait(60);
  await shot("send-pop");
  await wait(500);
  ok(await count(".msg.me") === n0 + 1, "send key sends the message");
  ok(await page.inputValue("#ta") === "", "composer cleared");
  await page.keyboard.type("Enter sends too"); await page.keyboard.press("Enter"); await wait(400);
  ok(await count(".msg.me") === n0 + 2, "Enter sends");
  await wait(3400);
  ok(await page.locator(".msg.them:not(.typing)").last().textContent().then((t) => !t.includes("Address")), "reply arrived");
  await shot("after-reply");

  // Emoji palette
  await page.click("#emojiBtn"); await wait(200);
  ok(await page.evaluate(() => document.getElementById("emojiMenu").matches(":popover-open")), "emoji palette opens");
  await page.keyboard.press("End"); await page.keyboard.press("Enter"); await wait(150);
  ok((await page.inputValue("#ta")).includes("✨"), "emoji inserted into the message");
  await page.fill("#ta", ""); await page.dispatchEvent("#ta", "input");

  // Attach menu
  await page.click("#attach"); await wait(200);
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await wait(500);
  ok(await page.locator(".msg.me .doc-ico").count() >= 1, "attach menu sends a document");

  // More menu: keyboard model
  await page.focus("#moreBtn"); await page.keyboard.press("ArrowDown"); await wait(200);
  ok(await page.evaluate(() => document.activeElement.dataset.act) === "mute", "ArrowDown on More opens menu at first item");
  await page.keyboard.press("End");
  ok(await page.evaluate(() => document.activeElement.dataset.act) === "delete", "End jumps to last item");
  await page.keyboard.press("p");
  ok(await page.evaluate(() => document.activeElement.dataset.act) === "pin", "type-ahead 'p' focuses Pin");
  await shot("more-menu");
  await page.keyboard.press("Escape"); await wait(100);
  ok(await page.evaluate(() => document.activeElement.id) === "moreBtn", "Escape closes menu and restores focus");
  await page.click("#moreBtn"); await wait(200);
  await page.click('[data-act="mute"]'); await wait(300);
  ok(await page.locator('.row[data-id="mara"] .mt use[href="#i-mute"]').count() === 1, "Mute shows the mute icon on the row");
  ok(await attr("#sw", "aria-checked") === "false", "notification switch follows mute");

  // Notification switch + text size slider
  await page.click("#sw"); await wait(350);
  ok(await attr("#sw", "aria-checked") === "true", "switch click turns notifications on");
  ok(await page.locator('.row[data-id="mara"] .mt use[href="#i-mute"]').count() === 0, "unmute removes row icon");
  await page.focus("#sw"); await page.keyboard.press("ArrowLeft"); await wait(300);
  ok(await attr("#sw", "aria-checked") === "false", "switch ArrowLeft turns off");
  await page.keyboard.press("Space"); await wait(300);
  await page.focus("#ts"); await page.keyboard.press("ArrowRight"); await wait(350);
  ok(await attr("#ts", "aria-valuetext") === "Large", "text size slider steps to Large");
  await shot("large-text");
  await page.keyboard.press("Home"); await wait(300);
  ok(await attr("#ts", "aria-valuetext") === "Small", "Home goes to Small");
  const tb = await page.locator("#ts").boundingBox();
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await wait(350);
  ok(await attr("#ts", "aria-valuetext") === "Default", "track click to centre = Default");

  // Retry failed message
  await page.locator(".retry").first().click(); await wait(900);
  ok(await page.locator(".retry").count() === 0, "Retry delivers the failed message");

  // Archive + undo
  await page.click("#moreBtn"); await wait(150); await page.click('[data-act="archive"]'); await wait(300);
  ok(await page.locator('.row[data-id="mara"]').count() === 0, "Archive removes the chat");
  await page.click("#toast .linkbtn"); await wait(300);
  ok(await page.locator('.row[data-id="mara"]').count() === 1, "Undo restores it");

  // Delete dialog
  await page.click("#moreBtn"); await wait(150); await page.click('[data-act="delete"]'); await wait(450);
  ok(await page.evaluate(() => document.getElementById("delDlg").open), "Delete opens the dialog");
  await page.click("#dlgMedia");
  ok(await page.isChecked("#dlgMedia"), "checkbox checks");
  await shot("dialog");
  await page.keyboard.press("Escape"); await wait(200);
  ok(!(await page.evaluate(() => document.getElementById("delDlg").open)), "Escape cancels the dialog");
  ok(await page.locator('.row[data-id="mara"]').count() === 1, "cancel keeps the chat");
  await page.click("#moreBtn"); await wait(150); await page.click('[data-act="delete"]'); await wait(400);
  await page.click("#dlgOk"); await wait(500);
  ok(await page.locator('.row[data-id="mara"]').count() === 0, "Delete removes the chat");
  await page.click("#infoBtn"); await wait(200);
  ok(await attr("#infoBtn", "aria-expanded") === "false", "info button closes the pad");
  await page.click("#infoBtn"); await wait(200);

  // Light angles on a fresh load
  for (const a of [45, 180]) {
    await page.reload({ waitUntil: "networkidle" }); await wait(400);
    await page.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
    await wait(150); await shot(`light-${a}`);
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // Phone: list -> thread -> back
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const ph = await ctx.newPage();
  ph.on("console", (m) => m.type() === "error" && errs.push("phone: " + m.text()));
  ph.on("pageerror", (e) => errs.push("phone: " + String(e)));
  await ph.goto(page.url(), { waitUntil: "networkidle" }); await ph.waitForTimeout(400);
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: no horizontal scroll (list)");
  await ph.tap('.row[data-id="mara"]'); await ph.waitForTimeout(700);
  ok(await ph.getAttribute("#app", "data-view") === "thread", "phone: tapping a row shows the thread");
  ok(await ph.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: no horizontal scroll (thread)");
  const small = await ph.evaluate(() => [...document.querySelectorAll("#thread button, .composer .field")].filter((b) => b.offsetParent && !b.closest(".msg")).map((b) => [b.id || b.className, b.getBoundingClientRect()]).filter(([, r]) => r.width < 44 || r.height < 44).map(([n, r]) => `${n} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`));
  ok(small.length === 0, "phone: thread targets >= 44px " + small.join(", "));
  await ph.screenshot({ path: `${out}/${name}-phone-thread.png` });
  const pb = ph.locator(".msg.them .bubble").filter({ hasText: "Fog lifted" });
  await pb.tap(); await ph.waitForTimeout(200);
  ok(await ph.evaluate(() => getComputedStyle(document.querySelector(".msg.sel .react")).opacity) === "1", "phone: tapping a bubble reveals its react key");
  await ph.locator(".msg.sel .react").tap(); await ph.waitForTimeout(300);
  await ph.tap('#reactMenu [data-act="fire"]'); await ph.waitForTimeout(500);
  ok(await ph.locator(".msg.them").filter({ hasText: "Fog lifted" }).locator('.pin use[href="#g-fire"]').count() === 1, "phone: reaction by touch replaces the heart with fire");
  await ph.tap("#ta"); await ph.keyboard.type("On my way 👍"); await ph.waitForTimeout(150);
  await ph.screenshot({ path: `${out}/${name}-phone-compose.png` });
  await ph.tap("#infoBtn"); await ph.waitForTimeout(500);
  await ph.screenshot({ path: `${out}/${name}-phone-info.png` });
  await ph.tap("#infoClose"); await ph.waitForTimeout(300);
  await ph.tap("#back"); await ph.waitForTimeout(500);
  ok(await ph.getAttribute("#app", "data-view") === "list", "phone: back returns to the list");
  await ctx.close();

  ok(errs.length === 0, "no console errors " + errs.join(" | "));
  console.log(fails.length ? `\n${fails.length} FAILED` : "\nall steps passed");
};
