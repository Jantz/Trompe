// Drives every control on gallery/files.html and asserts state. Used by:
//   node gallery/tools/shoot.mjs files.html /tmp/trompe-shots/files --script=gallery/tools/files-steps.mjs
export default async (pg, { out, name }) => {
  const shot = (s, o = {}) => pg.screenshot({ path: `${out}/${name}-${s}.png`, ...o });
  const fails = [];
  const ok = (cond, msg) => { console.log(`${cond ? "  ok  " : "  FAIL"} ${msg}`); if (!cond) fails.push(msg); };
  const st = () => pg.evaluate(() => ({ cwd: __archive.S.cwd, sel: [...__archive.S.sel], view: __archive.S.view, sort: __archive.S.sort, focus: __archive.S.focus, list: __archive.S.list }));
  const idOf = (n) => pg.evaluate((n) => [...__archive.I.values()].find((x) => x.name === n)?.id, n);
  const el = async (n) => `#o-${await idOf(n)}`;
  const wait = (ms) => pg.waitForTimeout(ms);
  const step = async (n, f) => { try { await f(); } catch (e) { ok(false, n + ": " + String(e.message).split("\n")[0]); await pg.keyboard.press("Escape").catch(() => {}); } };
  pg.setDefaultTimeout(4000);
  let s;

  // Selection: click, ctrl-click, shift-click
  await step('Selection: click, ctrl-click, shift-click', async () => {
    await pg.click(await el("Lease renewal.pdf")); await wait(300);
    s = await st(); ok(s.sel.length === 1, "click selects one card");
    await pg.click(await el("Minutes 11-03.doc"), { modifiers: ["Control"] }); await wait(300);
    s = await st(); ok(s.sel.length === 2, "ctrl-click adds a second card");
    await pg.mouse.move(5, 5);
    await wait(300);
    await shot("select", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.click(await el("Contracts"), { modifiers: ["Shift"] }); await wait(200);
    s = await st(); ok(s.sel.length > 2, `shift-click selects a range (${s.sel.length})`);
  });

  // Keyboard roving focus
  await step('Keyboard roving focus', async () => {
    await pg.click(await el("Contracts")); await wait(150);
    await pg.keyboard.press("ArrowRight"); await wait(150);
    s = await st(); ok(s.focus === (await idOf("Correspondence")) || s.list.indexOf(s.focus) === 1, "ArrowRight moves focus");
    ok(await pg.evaluate(() => document.activeElement.getAttribute("role") === "option" && document.activeElement.tabIndex === 0), "roving tabindex on focused card");
    await pg.keyboard.press("ArrowDown"); await wait(150);
    s = await st(); ok(s.list.indexOf(s.focus) > 1, "ArrowDown moves a row");
    await pg.keyboard.press("Home");
  });

  // View rocker keys
  await step('View rocker keys', async () => {
    await pg.click('.rk[data-view="list"]'); await wait(700);
    ok(await pg.getAttribute("#desk", "data-view") === "list", "list rocker latches list view");
    ok(await pg.getAttribute('.rk[data-view="grid"]', "aria-pressed") === "false", "grid rocker released");
    await pg.click(await el("Lease renewal.pdf")); await wait(300);
    await pg.click(`${await el("Insurance policy.pdf")} .punch`); await wait(300);
    s = await st(); ok(s.sel.length === 2, "punch box adds to selection in list view");
    await pg.mouse.move(5, 5); await wait(200);
    await shot("list", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.focus('.rk[data-view="grid"]'); await pg.keyboard.press("Enter"); await wait(700);
    ok(await pg.getAttribute("#desk", "data-view") === "grid", "Enter on grid rocker returns to grid");
  });

  // Sort listbox, keyboard
  await step('Sort listbox, keyboard', async () => {
    await pg.focus("#sortBtn"); await pg.keyboard.press("Enter"); await wait(350);
    ok(await pg.getAttribute("#sortBtn", "aria-expanded") === "true", "Enter opens sort slip");
    await shot("sort", { clip: { x: 700, y: 40, width: 740, height: 420 } });
    await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter"); await wait(500);
    s = await st(); ok(s.sort === "date", `arrows + Enter pick Newest first (${s.sort})`);
    ok(await pg.evaluate(() => document.activeElement.id === "sortBtn"), "focus returns to sort button");
    await pg.keyboard.press("Space"); await wait(200); await pg.keyboard.type("lar"); await pg.keyboard.press("Enter"); await wait(500);
    s = await st(); ok(s.sort === "size", `type-ahead picks Largest first (${s.sort})`);
    await pg.keyboard.press("Enter"); await wait(200); await pg.keyboard.press("Escape"); await wait(200);
    ok(await pg.getAttribute("#sortBtn", "aria-expanded") === "false", "Escape closes sort slip");
    await pg.click("#sortBtn"); await wait(300); await pg.click("#so-name"); await wait(500);
    s = await st(); ok(s.sort === "name", "click picks Name A–Z");
  });

  // Context menu: right click, then keyboard
  await step('Context menu: right click, then keyboard', async () => {
    await pg.click(await el("Minutes 11-03.doc"), { button: "right" }); await wait(300);
    ok(!(await pg.$eval("#menu", (m) => m.hidden)), "right-click opens paper slip menu");
    await shot("menu", { clip: { x: 300, y: 100, width: 1000, height: 700 } });
    await pg.keyboard.press("Escape"); await wait(150);
    ok(await pg.$eval("#menu", (m) => m.hidden), "Escape closes menu");
    ok(await pg.evaluate(() => document.activeElement.getAttribute("role") === "option"), "focus returns to card");
    await pg.keyboard.press("Shift+F10"); await wait(250);
    ok(await pg.evaluate(() => document.activeElement.dataset.act === "open"), "Shift+F10 opens menu, focus on Open");
    await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter"); await wait(200);
    ok(!!(await pg.$(".ren")), "Rename turns the label into an input");
    await pg.keyboard.type("Minutes 14-11"); await pg.keyboard.press("Enter"); await wait(300);
    ok(!!(await idOf("Minutes 14-11.doc")), "rename commits with Enter");
  });

  // Rename error
  await step('Rename error', async () => {
    await pg.click(await el("Reading list.txt")); await pg.keyboard.press("F2"); await wait(150);
    await pg.keyboard.press("Control+a"); await pg.keyboard.type("Letterhead.svg"); await pg.keyboard.press("Enter"); await wait(250);
    ok(await pg.getAttribute(".ren", "aria-invalid") === "true", "duplicate name shows error state");
    await shot("rename-error", { clip: { x: 300, y: 100, width: 1140, height: 700 } });
    await pg.keyboard.press("Escape"); await wait(200);
    ok(!(await pg.$(".ren")), "Escape cancels rename");
  });

  // Drag a card onto a folder
  await step('Drag a card onto a folder', async () => {
    const src = await (await pg.$(await el("Letterhead.svg"))).boundingBox();
    const dst = await (await pg.$(await el("Correspondence"))).boundingBox();
    await pg.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await pg.mouse.down();
    await pg.mouse.move(src.x + src.width / 2 + 20, src.y + src.height / 2 - 10, { steps: 3 });
    await pg.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2 + 10, { steps: 12 }); await wait(350);
    ok(await pg.$eval(await el("Correspondence"), (e) => e.classList.contains("is-drop")), "folder highlights as drop target");
    await shot("drag", { clip: { x: 300, y: 100, width: 1140, height: 700 } });
    await pg.mouse.up(); await wait(500);
    ok(await pg.evaluate(() => [...__archive.I.values()].find((x) => x.name === "Letterhead.svg").parent) === (await idOf("Correspondence")), "drop moves the card into the folder");
    ok(!(await pg.$eval("#toast", (t) => t.hidden)), "toast reports the move");
    await pg.click("#undo"); await wait(300);
    ok(await pg.evaluate(() => [...__archive.I.values()].find((x) => x.name === "Letterhead.svg").parent) === "documents", "Undo puts it back");
  });

  // Drag onto a drawer
  await step('Drag onto a drawer', async () => {
    const s2 = await (await pg.$(await el("Reading list.txt"))).boundingBox();
    const dr = await (await pg.$('.drawer[data-loc="shared"]')).boundingBox();
    await pg.mouse.move(s2.x + 30, s2.y + 30); await pg.mouse.down();
    await pg.mouse.move(dr.x + dr.width / 2, dr.y + dr.height / 2, { steps: 14 }); await wait(250);
    await pg.mouse.up(); await wait(400);
    ok(await pg.evaluate(() => [...__archive.I.values()].find((x) => x.name === "Reading list.txt").parent) === "shared", "drop on a drawer moves to that location");
  });

  // Trash with dialog
  await step('Trash with dialog', async () => {
    await pg.click(await el("Minutes 14-11.doc")); await pg.click(await el("Scans October.zip"), { modifiers: ["Control"] });
    const before = await pg.$eval("#gauge", (g) => g.getAttribute("aria-valuenow"));
    await pg.keyboard.press("Delete"); await wait(700);
    ok(await pg.$eval("#dlg", (d) => d.open), "Delete opens the discard dialog");
    ok((await pg.textContent("#dlgT")).includes("2"), "stamp names the count");
    await shot("dialog");
    await pg.keyboard.press("Escape"); await wait(200);
    ok(!(await pg.$eval("#dlg", (d) => d.open)), "Escape cancels dialog");
    await pg.keyboard.press("Delete"); await wait(600);
    await pg.click("#dOk"); await wait(900);
    ok(!(await idOf("Minutes 14-11.doc")) || (await pg.evaluate(() => [...__archive.I.values()].find((x) => x.name === "Minutes 14-11.doc").parent)) === "trash", "Discard removes the cards");
    const after = await pg.$eval("#gauge", (g) => g.getAttribute("aria-valuenow"));
    ok(+after < +before, `storage meter drops (${before} -> ${after})`);
  });

  // Open folder with Enter, back with button
  await step('Open folder with Enter, back with button', async () => {
    await pg.click(await el("Contracts")); await pg.keyboard.press("Enter"); await wait(250);
    await shot("fan", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await wait(600);
    s = await st(); ok(s.cwd === (await idOf("Contracts")), "Enter opens the folder");
    ok(await pg.evaluate(() => document.activeElement.getAttribute("role") === "option"), "focus lands inside the opened folder");
    await shot("open", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.click("#back"); await wait(500);
    s = await st(); ok(s.cwd === "documents", "Back button returns");
    await pg.click("#fwd"); await wait(400);
    s = await st(); ok(s.cwd === (await idOf("Contracts")), "Forward button goes forward");
    await pg.keyboard.press("Alt+ArrowLeft"); await wait(400);
    s = await st(); ok(s.cwd === "documents", "Alt+Left goes back");
    await pg.click('.crumb[aria-current]'); // no-op
  });

  // New folder (primary) + rename via typing
  await step('New folder (primary) + rename via typing', async () => {
    await pg.click("#newf"); await wait(400);
    ok(!!(await pg.$(".ren")), "New folder starts a rename");
    await pg.keyboard.type("Receipts"); await pg.keyboard.press("Enter"); await wait(300);
    ok(!!(await idOf("Receipts")), "new folder named Receipts");
  });

  // Duplicate via Ctrl+D
  await step('Duplicate via Ctrl+D', async () => {
    await pg.click(await el("Letterhead.svg")); await pg.keyboard.press("Control+d"); await wait(400);
    ok(!!(await idOf("Letterhead copy.svg")), "Ctrl+D duplicates");
  });

  // Tag filter + search
  await step('Tag filter + search', async () => {
    await pg.click('.tag[data-tag="urgent"]'); await wait(500);
    s = await st(); ok(s.list.length >= 1 && s.list.length < 8, `tag sticker filters (${s.list.length})`);
    await pg.click('.tag[data-tag="urgent"]'); await wait(300);
    await pg.click("#q"); await pg.keyboard.type("lease"); await wait(300);
    s = await st(); ok(s.list.length === 1, `search filters to 1 (${s.list.length})`);
    await shot("search", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.keyboard.type("zzz"); await wait(200);
    ok(await pg.$eval("#desk", (d) => d.classList.contains("is-empty")), "empty state shows");
    await shot("empty", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.keyboard.press("Escape"); await wait(200);
  });

  // Status bar: slide switch + slider
  await step("Switch and slider", async () => {
    await pg.click("#ff"); await wait(500);
    ok(await pg.getAttribute("#ff", "aria-checked") === "false", "Folders first switch turns off");
    ok(await pg.evaluate(() => { const d = __archive.S.list.map((id) => __archive.I.get(id).dir); return d.indexOf(false) < d.lastIndexOf(true); }), "cards interleave with folders when off");
    await shot("ff-off", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    await pg.focus("#ff"); await pg.keyboard.press("Space"); await wait(400);
    ok(await pg.getAttribute("#ff", "aria-checked") === "true", "Space turns the switch back on");
    await pg.focus("#zoom"); await pg.keyboard.press("ArrowRight"); await pg.keyboard.press("ArrowRight"); await wait(400);
    ok(await pg.getAttribute("#zoom", "aria-valuenow") === "4", "slider arrows step to Largest");
    await shot("zoom", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    const t = await (await pg.$(".ztrack")).boundingBox();
    await pg.mouse.click(t.x + 4, t.y + t.height / 2); await wait(400);
    ok(await pg.getAttribute("#zoom", "aria-valuenow") === "0", "clicking the slot start jumps to Smallest");
    await pg.keyboard.press("End"); await pg.keyboard.press("ArrowLeft"); await pg.keyboard.press("ArrowLeft"); await wait(300);
    ok(await pg.getAttribute("#zoom", "aria-valuetext") === "Medium cards", "valueText describes size");
  });

  // Drawer navigation
  await step('Drawer navigation', async () => {
    await pg.click('.drawer[data-loc="projects"]'); await wait(700);
    s = await st(); ok(s.cwd === "projects", "drawer opens Projects");
    await pg.mouse.move(5, 5);
    await shot("projects", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  });

  // Alternate light angles
  await step('Alternate light angles', async () => {
    for (const a of [45, 180]) {
      await pg.evaluate((a) => document.documentElement.style.setProperty("--tr-light-angle", a + "deg"), a); await wait(200);
      await shot(`light${a}`, { clip: { x: 0, y: 0, width: 1440, height: 900 } });
    }
    await pg.evaluate(() => document.documentElement.style.setProperty("--tr-light-angle", "315deg"));
  });

  // Phone
  await step('Phone', async () => {
    await pg.setViewportSize({ width: 390, height: 844 }); await wait(400);
    await pg.click('.drawer[data-loc="documents"]', { force: true }).catch(() => {});
    await pg.evaluate(() => { document.querySelector('.drawer[data-loc="documents"]').click(); }); await wait(600);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), "no horizontal scroll at 390px");
    await shot("phone-grid");
    await pg.click("#drawerBtn"); await wait(500);
    ok(await pg.evaluate(() => document.getElementById("cab").classList.contains("side-open")), "drawer button opens sidebar on phone");
    await shot("phone-drawer");
    await pg.keyboard.press("Escape"); await wait(400);
    ok(await pg.evaluate(() => !document.getElementById("cab").classList.contains("side-open")), "Escape closes phone sidebar");
    await pg.click('.rk[data-view="list"]'); await wait(600);
    await shot("phone-list");
    const small = await pg.evaluate(() => [...document.querySelectorAll(".tb button, .rk, .drawer-btn")].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 43.5).map((b) => b.id || b.className));
    ok(small.length === 0, `phone toolbar targets >= 44px (${small.join(", ")})`);
    await pg.setViewportSize({ width: 1440, height: 900 });
  });
  console.log(fails.length ? `${fails.length} FAILED` : "all steps passed");
};
