// Drives every control on gallery/checkout.html, asserts state, and shoots key states.
//   node gallery/tools/shoot.mjs checkout.html /tmp/trompe-shots/checkout --script=gallery/tools/checkout-steps.mjs
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) fails++; };

export default async (page, { out, name }) => {
  const shot = (s, o = {}) => page.screenshot({ path: `${out}/${name}-${s}.png`, ...o });
  const attr = (sel, a) => page.getAttribute(sel, a);
  const clipOf = async (sel, pad = 24) => { const r = await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; }); return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 }; };
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // Close-ups of the resting state.
  await shot("account", { clip: await clipOf(".p-acc", 0), fullPage: true });
  await shot("summary", { clip: await clipOf(".p-sum", 0), fullPage: true });

  // 1. Sign in: validation error on email.
  await page.fill("#email", "aya@kosaka");
  { const r = await (await page.$("#signin-btn")).boundingBox();
    await shot("btn-rest", { clip: { x: r.x - 16, y: r.y - 12, width: r.width + 32, height: r.height + 30 } });
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.waitForTimeout(160);
    const p = await page.$eval("#signin-btn", (e) => +getComputedStyle(e).getPropertyValue("--tr-press"));
    ok(p > 0.8, "pebble travels on press (--tr-press " + p.toFixed(2) + ")");
    await shot("btn-pressed", { clip: { x: r.x - 16, y: r.y - 12, width: r.width + 32, height: r.height + 30 } });
    await page.mouse.up(); await page.waitForTimeout(250); }
  ok(await attr("#email", "aria-invalid") === "true", "invalid email -> aria-invalid");
  ok((await page.textContent("#email-msg")).length > 5, "email error message shown");
  ok(await page.$eval("#email-well", (e) => e.hasAttribute("data-invalid")), "email well has error edge");
  await page.fill("#pw", "kintsugi-2026");
  await shot("signin-error", { clip: await clipOf(".p-acc", 0), fullPage: true });

  // Show/hide password latch.
  await page.click("#pw-tog"); await page.waitForTimeout(200);
  ok(await attr("#pw", "type") === "text" && await attr("#pw-tog", "aria-pressed") === "true", "brass latch shows password");
  await page.focus("#pw-tog"); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
  ok(await attr("#pw", "type") === "password", "latch via keyboard hides password");

  // Remember me.
  await page.click(".check"); ok(await page.isChecked("#remember"), "remember me checked by click");
  await page.focus("#remember"); await page.keyboard.press("Space"); ok(!(await page.isChecked("#remember")), "remember me unchecked by Space");
  await page.keyboard.press("Space");

  // Secondary + link.
  await page.click('[data-alt="Passkey"]'); await page.waitForTimeout(200);
  ok((await page.textContent("#alt-msg")).includes("Passkey"), "passkey button gives status");

  // Fix email and sign in with Enter from the password field.
  await page.fill("#email", "aya@example.com");
  ok(await attr("#email", "aria-invalid") === null, "error clears when email becomes valid");
  await page.focus("#pw"); await page.keyboard.press("Enter"); await page.waitForSelector("#acct:not([hidden])", { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(200);
  ok(await page.isVisible("#acct") && !(await page.isVisible("#signin")), "signed in, account card shown");
  ok(await page.getAttribute(".steps li:nth-child(1)", "data-state") === "done", "stepper: account done");
  ok((await page.textContent("#addr-t")).includes("Higashiyama"), "saved address filled");

  // 2. Quantity steppers.
  const tot0 = await page.textContent("#t-total");
  await page.click('.item[data-id="bowl"] .kn[data-d="1"]'); await page.waitForTimeout(450);
  ok(await page.textContent('.item[data-id="bowl"] .qv span:last-child') === "2", "bowl qty 2 after +");
  ok(await page.textContent('.item[data-id="bowl"] .tot') === "¥36,800", "bowl line total updates");
  ok(await page.textContent("#t-total") !== tot0, "total changes");
  await page.focus('.item[data-id="hashi"] .kn[data-d="-1"]'); await page.keyboard.press("Enter"); await page.waitForTimeout(450);
  { const q = await page.textContent('.item[data-id="hashi"] .qv span:last-child'); ok(q === "1", "chopsticks qty 1 via keyboard (" + q + ")"); }
  ok(await attr('.item[data-id="hashi"] .kn[data-d="-1"]', "aria-disabled") === "true", "minus disabled at 1");

  // 3. Shipping cards.
  await page.click('.ship:has(input[value="exp"])'); await page.waitForTimeout(350);
  ok(await page.isChecked('input[value="exp"]'), "express selected by click");
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(100);
  ok(await page.isChecked('input[value="std"]'), "arrow key moves back to standard");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(350);

  // 4. Country listbox, keyboard.
  await page.focus("#country"); await page.keyboard.press("Enter");
  ok(await attr("#country", "aria-expanded") === "true", "Enter opens listbox");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  const ad = await attr("#country", "aria-activedescendant");
  ok(ad && (await page.textContent("#" + ad)).startsWith("New Zealand"), "arrows move active option (" + ad + ")");
  await page.keyboard.type("u"); await page.waitForTimeout(50);
  ok((await page.textContent("#" + await attr("#country", "aria-activedescendant"))).startsWith("United Kingdom"), "type-ahead u -> United Kingdom");
  await page.keyboard.type("u"); await page.waitForTimeout(50);
  ok((await page.textContent("#" + await attr("#country", "aria-activedescendant"))).startsWith("United States"), "repeat u cycles -> United States");
  await page.waitForTimeout(700);
  await page.keyboard.type("si"); await page.waitForTimeout(50);
  ok((await page.textContent("#" + await attr("#country", "aria-activedescendant"))).startsWith("Singapore"), "type-ahead 'si' -> Singapore");
  await page.keyboard.press("Escape");
  ok(await attr("#country", "aria-expanded") === "false" && await page.textContent("#country-v") === "Japan", "Escape closes without change");
  await page.waitForTimeout(700); await page.keyboard.press(" ");
  ok(await attr("#country", "aria-expanded") === "true", "Space opens listbox");
  await page.keyboard.press("End"); await page.keyboard.press("ArrowUp");
  await shot("select-open", { clip: await clipOf(".p-chk", 0), fullPage: true });
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok(await page.textContent("#country-v") === "United Kingdom" && await attr("#country", "aria-expanded") === "false", "Enter selects United Kingdom");
  ok((await page.textContent("#t-ship")) === "¥5,600", "express to UK costs ¥5,600");
  await page.click("#country"); await page.click("#country-lb li:has-text('Japan')"); await page.waitForTimeout(250);
  ok(await page.textContent("#country-v") === "Japan", "mouse selects Japan");

  // 5. Gift wrap switch.
  await page.click("#gift"); await page.waitForTimeout(350);
  ok(await attr("#gift", "aria-checked") === "true" && await page.isVisible("#t-gift"), "gift wrap on by click, line added");
  await page.focus("#gift"); await page.keyboard.press("Space"); await page.waitForTimeout(300);
  ok(await attr("#gift", "aria-checked") === "false", "gift wrap off by Space");
  const g = await (await page.$("#gift")).boundingBox();
  await page.mouse.move(g.x + 12, g.y + g.height / 2); await page.mouse.down();
  await page.mouse.move(g.x + 60, g.y + g.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(350);
  ok(await attr("#gift", "aria-checked") === "true", "gift wrap on by drag");

  // 6. Promo.
  ok(await attr("#apply", "aria-disabled") === "true", "Apply disabled when empty");
  await page.fill("#promo", "SPRING");
  await page.click("#apply"); await page.waitForTimeout(250);
  ok(await attr("#promo", "aria-invalid") === "true", "bad promo flagged");
  await page.fill("#promo", "aki10"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  ok(await page.isVisible("#t-disc") && (await page.textContent("#t-disc")).startsWith("−¥"), "AKI10 discount applied");

  // 7. Place order before card -> guided error.
  await page.click("#place"); await page.waitForTimeout(300);
  ok((await page.textContent("#place-msg")).length > 0 && !(await page.$eval("#done", (d) => d.open)), "place order blocked until card entered");

  // 8. Card: number, expiry, CVC flips the card.
  await page.fill("#cc", ""); await page.type("#cc", "4000123456789010");
  ok(await attr("#cc", "aria-invalid") === null, "card error clears on input");
  ok(await page.inputValue("#cc") === "4000 1234 5678 9010", "card number grouped");
  await page.type("#exp", "0829");
  ok(await page.inputValue("#exp") === "08 / 29", "expiry formatted");
  await page.focus("#cvc"); await page.waitForTimeout(150);
  await shot("card-flipping", { clip: await clipOf(".pay", 0), fullPage: true });
  await page.waitForTimeout(900);
  ok(await page.$eval("#card", (c) => c.hasAttribute("data-flipped")), "card flipped on CVC focus");
  await page.type("#cvc", "321");
  await shot("card-back", { clip: await clipOf(".pay", 0), fullPage: true });
  await page.focus("#cc"); await page.waitForTimeout(1000);
  ok(!(await page.$eval("#card", (c) => c.hasAttribute("data-flipped"))), "card returns on blur");
  ok(await page.getAttribute(".steps li:nth-child(3)", "data-state") === "done", "stepper: payment done");
  await page.mouse.move(10, 10); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await shot("signed-in-full", { fullPage: true });

  // 9. Remove (destructive) then place order -> dialog.
  await page.click('.item[data-id="hashi"] .rm'); await page.waitForTimeout(500);
  ok(!(await page.$('.item[data-id="hashi"]')), "item removed");
  await page.click("#place"); await page.waitForTimeout(1100);
  ok(await page.$eval("#done", (d) => d.open), "dialog opens on place order");
  await shot("dialog");
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok(!(await page.$eval("#done", (d) => d.open)), "Done closes dialog");

  // 10. Light angles.
  for (const a of [45, 180]) {
    await page.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
    await shot(`light-${a}`, { fullPage: false });
    await shot(`light-${a}-sum`, { clip: await clipOf(".p-sum", 0), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // 11. Phone width: no horizontal scroll in the signed-in state.
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(sw[0] <= sw[1], `no horizontal scroll at 390 (${sw})`);
  const small = await page.$$eval("button, input, [role=switch], [role=combobox], .check", (els) => els.filter((e) => e.offsetParent && !e.closest(".tg-bar")).map((e) => [e.id || e.className, Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]).filter(([, w, h]) => Math.min(w, h) < 43));
  ok(small.length === 0, "touch targets >= 44px at 390: " + JSON.stringify(small));
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  await shot("phone-signed-in", { fullPage: true });

  ok(errors.length === 0, "no console errors " + errors.join(" | "));
  console.log(fails ? `${fails} FAILED` : "ALL PASSED");
};
