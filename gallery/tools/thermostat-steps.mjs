// Step script for gallery/thermostat.html (Ember Home). Drives every control and asserts.
//   node gallery/tools/shoot.mjs thermostat.html /tmp/trompe-shots/thermostat --script=gallery/tools/thermostat-steps.mjs
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`); if (!cond) fails++; };

export default async (pg, { out, name }) => {
  const shot = (n, o = {}) => pg.screenshot({ path: `${out}/${name}-${n}.png`, ...o });
  const val = (sel) => pg.$eval(sel, (e) => e.value);
  const attr = (sel, a) => pg.getAttribute(sel, a);
  const box = async (sel) => (await pg.$(sel)).boundingBox();
  const wait = (ms) => pg.waitForTimeout(ms);
  const dialClip = async () => { await pg.$eval("#dial", (e) => e.scrollIntoView({ block: "center" })); const b = await box("#dial"); return { clip: { x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 60 } }; };

  await pg.evaluate(() => window.scrollTo(0, 0));
  await shot("dial-closeup", await dialClip());
  const plates = await box(".ctrls");
  await shot("plates-closeup", { clip: { x: plates.x - 30, y: plates.y - 30, width: plates.width + 60, height: plates.height + 60 } });

  // Room drift simulation.
  const r0 = await pg.$eval("#roomT", (e) => e.textContent);
  await wait(2500);
  const r1 = await pg.$eval("#roomT", (e) => e.textContent);
  ok(r0 !== r1, `room temperature drifts (${r0} -> ${r1})`);

  // Ring: drag clockwise around the rim.
  const d = await box("#ring");
  const cx = d.x + d.width / 2, cy = d.y + d.height / 2, rad = d.width * 0.46;
  const v0 = await val("#ring");
  await pg.mouse.move(cx, cy - rad); await pg.mouse.down();
  for (let i = 1; i <= 20; i++) { const a = -Math.PI / 2 + i * 0.03; await pg.mouse.move(cx + rad * Math.cos(a), cy + rad * Math.sin(a)); await wait(16); }
  await pg.mouse.up(); await wait(500);
  const v1 = await val("#ring");
  ok(v1 > v0, `ring drag cw raises set point ${v0} -> ${v1}`);
  ok(/°/.test(await pg.$eval("#temp", (e) => e.textContent)), "numeral shows degrees");

  // Flick: fast drag, release; inertia should carry it further.
  // The release velocity comes from performance.now() stamps on the pointer moves, and a busy
  // headless renderer can stall timers for longer than the controller's 90 ms velocity window,
  // which made this flaky. Dispatch the whole gesture synchronously on a virtual clock (12 ms per
  // move), start from a known value with headroom, and wait for the coast to settle instead of
  // a fixed delay.
  await pg.focus("#ring"); await pg.keyboard.press("Home");
  for (let i = 0; i < 10; i++) await pg.keyboard.press("ArrowUp"); // 15.0
  await wait(300);
  const lastV = await pg.evaluate(([cx, cy, rad]) => {
    const ring = document.getElementById("ring");
    const pt = (a) => ({ clientX: cx + rad * Math.cos(a), clientY: cy + rad * Math.sin(a), pointerId: 7, button: 0, bubbles: true, isPrimary: true });
    const realNow = performance.now.bind(performance); let t = realNow();
    performance.now = () => t;
    ring.setPointerCapture = () => {}; // synthetic pointers cannot be captured
    try {
      const a0 = -Math.PI / 2;
      ring.dispatchEvent(new PointerEvent("pointerdown", pt(a0)));
      for (let i = 1; i <= 6; i++) { t += 12; ring.dispatchEvent(new PointerEvent("pointermove", pt(a0 + i * 0.05))); }
      t += 4; ring.dispatchEvent(new PointerEvent("pointerup", pt(a0 + 0.3)));
    } finally { performance.now = realNow; delete ring.setPointerCapture; }
    return ring.value;
  }, [cx, cy, rad]);
  const coasting = await attr("#ring", "data-tr-state");
  await pg.waitForFunction(() => document.getElementById("ring").dataset.trState !== "settling", null, { timeout: 5000 }).catch(() => {});
  const vFlick = await val("#ring");
  ok(coasting === "settling" && vFlick > lastV && vFlick < 30, `flick coasts past release ${lastV} -> ${vFlick}`);

  // Keyboard on the ring.
  await pg.focus("#ring");
  await pg.keyboard.press("Home"); ok(await val("#ring") === 10, "Home -> 10");
  await pg.keyboard.press("End"); ok(await val("#ring") === 30, "End -> 30");
  for (let i = 0; i < 17; i++) await pg.keyboard.press("ArrowDown");
  ok(await val("#ring") === 21.5, `ArrowDown x17 -> ${await val("#ring")}`);
  ok((await attr("#ring", "aria-valuetext")).includes("21.5"), "ring aria-valuetext: " + await attr("#ring", "aria-valuetext"));

  // Glass: press cycles modes.
  const modeOf = () => pg.$eval("#modes svg.on", (e) => e.dataset.m);
  const m0 = await modeOf();
  await pg.click("#glass");
  await pg.waitForFunction(() => document.querySelector("#modes svg.on")?.dataset.m !== "heat", null, { timeout: 2000 }).catch(() => {});
  const m1 = await modeOf();
  ok(m0 === "heat" && m1 === "cool", `glass click cycles ${m0} -> ${m1}`);
  await pg.focus("#glass"); await pg.keyboard.press("Enter"); await wait(250);
  ok(await modeOf() === "auto", "Enter on glass -> auto");
  await pg.keyboard.press(" "); await wait(250);
  ok(await modeOf() === "off" && (await attr("#dial", "data-glow")) === "off", "Space -> off (ghost display)");
  await wait(400);
  await shot("dial-off", await dialClip());
  await pg.keyboard.press(" "); await wait(400);
  ok(await modeOf() === "heat", "back to heat");

  // Cooling look: set point below room.
  await pg.click("#glass"); await wait(200); // cool
  await pg.focus("#ring"); for (let i = 0; i < 8; i++) await pg.keyboard.press("ArrowDown");
  await wait(600);
  ok((await attr("#dial", "data-glow")) === "cool", "cooling glows blue");
  await shot("dial-cool", await dialClip());
  await pg.focus("#glass"); for (let i = 0; i < 3; i++) { await pg.keyboard.press("Enter"); await wait(150); } // auto, off, heat
  await pg.focus("#ring"); for (let i = 0; i < 8; i++) await pg.keyboard.press("ArrowUp");

  // Dimmer: drag cap down, then keyboard.
  const cap = await box("#cap");
  const l0 = await val("#dimmer");
  await pg.mouse.move(cap.x + cap.width / 2, cap.y + cap.height / 2); await pg.mouse.down();
  await pg.mouse.move(cap.x + cap.width / 2, cap.y + cap.height / 2 + 60, { steps: 10 }); await pg.mouse.up(); await wait(300);
  const l1 = await val("#dimmer");
  ok(l1 < l0, `dimmer drag down ${l0} -> ${l1}`);
  await pg.focus("#dimmer"); await pg.keyboard.press("End"); await wait(300);
  ok(await val("#dimmer") === 100, "dimmer End -> 100");
  ok(+(await pg.$eval("#warm", (e) => e.style.opacity)) > 0.8, "plaster warms at 100%");
  await wait(400);
  ok(+(await pg.$eval("#dimmer", (e) => e.style.getPropertyValue("--tr-value-ratio"))) > 0.97, "cap display follows a key press right after a drag");
  await shot("light-100");
  await pg.keyboard.press("PageDown"); ok(await val("#dimmer") === 90, "PageDown -> 90");

  // Rockers.
  await pg.click("#shades"); await wait(400);
  ok((await attr("#shades", "aria-checked")) === "true" && (await attr("#wall", "data-shades")) === "1", "shades rocker on, daylight dims");
  const fb = await box("#fan .aperture");
  await pg.mouse.move(fb.x + fb.width / 2, fb.y + fb.height * 0.7); await pg.mouse.down();
  await pg.mouse.move(fb.x + fb.width / 2, fb.y + fb.height * 0.2, { steps: 6 }); await pg.mouse.up(); await wait(400);
  ok((await attr("#fan", "aria-checked")) === "true", "fan rocker drag up -> on");
  await shot("plates-on", { clip: { x: plates.x - 30, y: plates.y - 30, width: plates.width + 60, height: plates.height + 60 } });
  await pg.focus("#fan"); await pg.keyboard.press(" "); await wait(300);
  ok((await attr("#fan", "aria-checked")) === "false", "fan Space -> off");

  // Tabs.
  await pg.click("#t-kitchen"); await wait(600);
  ok(await val("#ring") === 20 && await val("#dimmer") === 85, "Kitchen tab loads its set point and light");
  await pg.keyboard.press("ArrowRight"); await wait(400);
  ok((await attr("#t-bedroom", "aria-selected")) === "true" && await pg.evaluate(() => document.activeElement.id) === "t-bedroom", "ArrowRight -> Bedroom (focus follows)");
  await pg.keyboard.press("Home"); await wait(400);
  ok((await attr("#t-living", "aria-selected")) === "true", "Home -> Living");

  // Scene listbox.
  await pg.click("#sceneBtn"); await wait(250);
  ok(!(await pg.$eval("#sceneList", (e) => e.hidden)) && (await attr("#sceneBtn", "aria-expanded")) === "true", "scene listbox opens");
  await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowDown");
  await shot("scene-menu");
  await pg.keyboard.press("Escape"); await wait(100);
  ok(await pg.$eval("#sceneList", (e) => e.hidden) && await pg.evaluate(() => document.activeElement.id) === "sceneBtn", "Escape closes, focus returns");
  await pg.keyboard.press("ArrowDown"); await wait(100);
  await pg.keyboard.type("mo"); await pg.keyboard.press("Enter"); await wait(600);
  ok((await pg.$eval("#sceneVal", (e) => e.textContent)) === "Morning" && await val("#dimmer") === 55, "type-ahead 'mo' + Enter -> Morning applies 55%");
  await pg.click("#sceneBtn"); await wait(200);
  await pg.click("#sc-3"); await wait(600);
  ok((await pg.$eval("#sceneVal", (e) => e.textContent)) === "Movie" && await val("#ring") === 21, "click Movie applies");

  // Schedule checkboxes.
  const cb = (await pg.$$(".sw"))[2];
  const c0 = await cb.isChecked(); await (await pg.$$(".card"))[2].click(); await wait(200);
  ok((await cb.isChecked()) !== c0, "schedule card toggles its checkbox");
  await (await pg.$$(".sw"))[0].focus(); await pg.keyboard.press(" "); await wait(150);
  ok(!(await (await pg.$$(".sw"))[0].isChecked()), "Space toggles schedule checkbox");

  // Confirm dialog.
  await pg.click("#allOff"); await wait(350);
  ok(await pg.$eval("#dlg", (e) => e.open), "All off opens dialog");
  ok(await pg.evaluate(() => document.activeElement.textContent.trim()) === "Cancel", "Cancel is focused first");
  await shot("dialog");
  await pg.keyboard.press("Escape"); await wait(200);
  ok(!(await pg.$eval("#dlg", (e) => e.open)) && await modeOf() !== "off", "Escape cancels without changes");
  await pg.click("#allOff"); await wait(300);
  await pg.click("#dlg .warn"); await wait(600);
  ok(await modeOf() === "off" && await val("#dimmer") === 0, "Turn off: heating off, lights 0");
  await pg.click("#glass"); await wait(200); // heat again
  await pg.click("#t-studio"); await wait(800);

  // Light angles.
  for (const a of [45, 180]) {
    await pg.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a);
    await wait(500);
    await shot(`light-${a}`);
    await shot(`dial-light-${a}`, await dialClip());
  }
  await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));

  // Phone width: no horizontal scroll, targets >= 44px.
  await pg.setViewportSize({ width: 390, height: 844 }); await wait(500);
  const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth]);
  ok(Math.max(...sw) <= 390, `no horizontal scroll at 390 (${sw})`);
  const small = await pg.evaluate(() => [...document.querySelectorAll(".tab, #sceneBtn, #allOff, #ring, #glass, .rk, #dimmer, .card")].map((e) => [e.id || e.className, Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]).filter(([, w, h]) => w < 44 || h < 44));
  ok(small.length === 0, "phone targets >= 44px " + JSON.stringify(small));
  await pg.setViewportSize({ width: 1440, height: 900 });
  console.log(fails ? `${fails} FAILED` : "all checks passed");
};
