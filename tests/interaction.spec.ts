import { test, expect, type Page } from '@playwright/test';

/**
 * Behaviour of the interaction layer on plain elements (no components), in a real browser.
 * Each test loads src/interaction from source through Vite.
 */
async function setup(page: Page, markup: string, script: string): Promise<void> {
  await page.goto('/tests/fixture.html');
  await page.evaluate(
    async ({ markup, script }) => {
      const ti = await import('/src/interaction/index.ts' as string);
      (window as any).ti = ti;
      (window as any).log = [];
      document.getElementById('root')!.innerHTML = markup;
      new Function('ti', 'log', script)(ti, (window as any).log);
    },
    { markup, script },
  );
}

const log = (page: Page) => page.evaluate(() => (window as any).log as string[]);

test.describe('PressController', () => {
  test('a quick tap stays visibly pressed for the minimum time', async ({ page }) => {
    await setup(
      page,
      `<button id="b" style="width:120px;height:40px">Go</button>`,
      `const b = document.getElementById('b');
       new ti.PressController(b);
       new MutationObserver(() => log.push((b.hasAttribute('data-tr-pressed') ? 'down' : 'up') + '@' + Math.round(performance.now())))
         .observe(b, { attributes: true, attributeFilter: ['data-tr-pressed'] });`,
    );
    await page.locator('#b').click({ delay: 5 });
    await page.waitForTimeout(150);
    const l = await log(page);
    expect(l.map((s) => s.split('@')[0])).toEqual(['down', 'up']);
    const [d, u] = l.map((s) => Number(s.split('@')[1]));
    expect(u! - d!).toBeGreaterThanOrEqual(85);
  });

  test('dragging off un-presses, dragging back re-presses, no click when released outside', async ({ page }) => {
    await setup(
      page,
      `<button id="b" style="width:120px;height:40px;margin:40px">Go</button>`,
      `const b = document.getElementById('b');
       new ti.PressController(b, { minPressMs: 0 });
       b.addEventListener('click', () => log.push('click'));`,
    );
    const box = (await page.locator('#b').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await expect(page.locator('#b')).toHaveAttribute('data-tr-pressed', '');
    await page.mouse.move(box.x + 300, box.y + 10);
    await expect(page.locator('#b')).not.toHaveAttribute('data-tr-pressed', '');
    await page.mouse.move(box.x + 20, box.y + 20);
    await expect(page.locator('#b')).toHaveAttribute('data-tr-pressed', '');
    await page.mouse.move(box.x + 300, box.y + 10);
    await page.mouse.up();
    expect(await log(page)).toEqual([]);
  });

  test('records the contact point for tilt', async ({ page }) => {
    await setup(page, `<div id="c" style="width:200px;height:100px"></div>`, `new ti.PressController(document.getElementById('c'))`);
    const box = (await page.locator('#c').boundingBox())!;
    await page.mouse.move(box.x + 150, box.y + 25);
    await page.mouse.down();
    const v = await page.evaluate(() => {
      const s = document.getElementById('c')!.style;
      return [s.getPropertyValue('--tr-press-x'), s.getPropertyValue('--tr-press-y')];
    });
    expect(v).toEqual(['0.500', '-0.500']);
    await page.mouse.up();
  });

  test('Space holds the press until key up', async ({ page }) => {
    await setup(page, `<button id="b">Go</button>`, `new ti.PressController(document.getElementById('b'), { minPressMs: 0 })`);
    await page.locator('#b').focus();
    await page.keyboard.down(' ');
    await expect(page.locator('#b')).toHaveAttribute('data-tr-pressed', '');
    await page.waitForTimeout(150);
    await expect(page.locator('#b')).toHaveAttribute('data-tr-pressed', '');
    await page.keyboard.up(' ');
    await expect(page.locator('#b')).not.toHaveAttribute('data-tr-pressed', '');
  });
});

test.describe('ToggleController', () => {
  const markup = `<div id="s" role="switch" aria-checked="false" tabindex="0" style="position:relative;width:60px;height:30px;background:#ccc">
    <div id="thumb" style="width:30px;height:30px;background:#333"></div></div>`;
  const script = `const s = document.getElementById('s');
    let on = false;
    const toggle = () => { on = !on; s.setAttribute('aria-checked', String(on)); log.push('toggle:' + on); s.dispatchEvent(new Event('change', { bubbles: true })); };
    s.addEventListener('click', toggle);
    new ti.ToggleController(s, { checked: () => on, toggle, thumb: () => document.getElementById('thumb') });`;

  test('click toggles once', async ({ page }) => {
    await setup(page, markup, script);
    await page.locator('#s').click();
    expect(await log(page)).toEqual(['toggle:true']);
  });

  test('dragging past centre throws it once, before release, and the trailing click is swallowed', async ({ page }) => {
    await setup(page, markup, script);
    const box = (await page.locator('#s').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 15, { steps: 3 });
    expect(await log(page)).toEqual([]);
    const held = await page.evaluate(() => parseFloat(document.getElementById('s')!.style.getPropertyValue('--tr-value-ratio')));
    // Inside its own half, a spring holds the thumb back: it moves less than the hand.
    expect(held).toBeGreaterThan(0);
    expect(held).toBeLessThan(0.33);
    await page.mouse.move(box.x + 40, box.y + 15, { steps: 4 });
    expect(await log(page)).toEqual(['toggle:true']);
    await page.mouse.up();
    await page.waitForTimeout(20);
    expect(await log(page)).toEqual(['toggle:true']);
    await expect(page.locator('#s')).not.toHaveAttribute('data-dragging', '');
  });
});

test.describe('ChoiceController', () => {
  const markup = `<div id="g" role="tablist" style="position:relative;display:flex;gap:8px;padding:4px">
    <span id="ind" style="position:absolute;left:0;top:0;background:#0002"></span>
    <button role="tab">Alpha</button><button role="tab">Beta</button><button role="tab" aria-disabled="true">Gamma</button><button role="tab">Delta</button></div>`;
  const script = `const g = document.getElementById('g');
    let sel = 0;
    const items = () => [...g.querySelectorAll('[role=tab]')];
    const c = new ti.ChoiceController(g, {
      items, selected: () => sel, indicator: () => document.getElementById('ind'),
      isDisabled: (i) => i.getAttribute('aria-disabled') === 'true',
      select: (i) => { sel = i; items().forEach((t, k) => t.setAttribute('aria-selected', String(k === i))); log.push('select:' + i); c.update(); },
    });
    items().forEach((t, i) => t.addEventListener('click', () => c.update(), { once: false }));
    window.choice = c;`;

  test('roving tabindex, arrows skip disabled items, Home/End, typeahead', async ({ page }) => {
    await setup(page, markup, script);
    await page.waitForTimeout(50);
    const tabs = page.getByRole('tab');
    await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0');
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1');
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    await page.keyboard.press('d');
    expect(await log(page)).toEqual(['select:1', 'select:3', 'select:0', 'select:3']);
    await expect(tabs.nth(3)).toBeFocused();
    await expect(tabs.nth(3)).toHaveAttribute('tabindex', '0');
  });

  test('the selector springs to the new item', async ({ page }) => {
    await setup(page, markup, script);
    await page.waitForTimeout(50);
    await page.getByRole('tab').nth(0).focus();
    await page.keyboard.press('ArrowRight');
    const mid = await page.evaluate(() => document.getElementById('ind')!.style.translate);
    await page.waitForTimeout(400);
    const end = await page.evaluate(() => document.getElementById('ind')!.style.translate);
    const beta = (await page.getByRole('tab').nth(1).boundingBox())!;
    const g = (await page.locator('#g').boundingBox())!;
    expect(parseFloat(end)).toBeCloseTo(beta.x - g.x, 0);
    expect(mid).not.toBe(end);
  });
});

test.describe('LinearController (slider)', () => {
  const markup = `<div id="s" aria-label="Volume" style="width:200px;height:20px;background:#ddd;margin:40px"></div>`;
  test('drag, keyboard, ARIA and events', async ({ page }) => {
    await setup(
      page,
      markup,
      `const s = document.getElementById('s');
       window.c = new ti.LinearController(s, { min: 0, max: 100, step: 1, value: 50 });
       s.addEventListener('input', () => log.push('input'));
       s.addEventListener('change', () => log.push('change:' + window.c.value));`,
    );
    const s = page.locator('#s');
    await expect(s).toHaveAttribute('role', 'slider');
    await expect(s).toHaveAttribute('aria-valuenow', '50');
    await expect(s).toHaveAttribute('aria-orientation', 'horizontal');
    const box = (await s.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 10, { steps: 5 });
    await page.mouse.up();
    await expect(s).toHaveAttribute('aria-valuenow', '75');
    const l = await log(page);
    expect(l.at(-1)).toBe('change:75');
    expect(l.filter((x) => x === 'input').length).toBeGreaterThan(1);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('End');
    await expect(s).toHaveAttribute('aria-valuenow', '100');
  });

  test('vertical fader increases upward', async ({ page }) => {
    await setup(
      page,
      `<div id="f" aria-label="Level" style="width:20px;height:200px;background:#ddd;margin:40px"></div>`,
      `window.c = new ti.LinearController(document.getElementById('f'), { orientation: 'vertical', value: 50 });`,
    );
    const box = (await page.locator('#f').boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 50, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window as any).c.value)).toBe(75);
  });

  test('reduced motion: keyboard changes land instantly', async ({ page }) => {
    await setup(
      page,
      `<div data-tr-motion="reduce"><div id="s" aria-label="V" style="width:200px;height:20px"></div></div>`,
      `window.c = new ti.LinearController(document.getElementById('s'), { value: 0 });`,
    );
    await page.locator('#s').focus();
    await page.keyboard.press('End');
    const r = await page.evaluate(() => document.getElementById('s')!.style.getPropertyValue('--tr-value-ratio'));
    expect(r).toBe('1.0000');
  });
});

test.describe('DragSurfaceController', () => {
  test('a downward flick moves a sheet to the next snap point; rubber band past the end', async ({ page }) => {
    await setup(
      page,
      `<div id="sheet" style="position:fixed;left:0;right:0;top:100px;height:400px;background:#eee"></div>`,
      `window.d = new ti.DragSurfaceController(document.getElementById('sheet'), { axis: 'y', snapPoints: () => [0, 200, 380], onSnap: (i) => log.push('snap:' + i) });`,
    );
    await page.mouse.move(200, 150);
    await page.mouse.down();
    await page.mouse.move(200, 120, { steps: 4 });
    const up = await page.evaluate(() => parseFloat(document.getElementById('sheet')!.style.translate.split(' ')[1]!));
    // Pulled 30 px past the top: the rubber band gives less than that.
    expect(up).toBeLessThan(0);
    expect(up).toBeGreaterThan(-30);
    // Slow drag and a pause before lifting: no momentum, nearest point wins.
    await page.mouse.move(200, 330, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(await log(page)).toEqual(['snap:1']);
    // A fast flick from there carries on to the next point, even though released nearer to 1.
    await page.mouse.move(200, 330);
    await page.mouse.down();
    await page.mouse.move(200, 380, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect(await log(page)).toEqual(['snap:1', 'snap:2']);
  });

  test('a mostly sideways gesture is left to the page', async ({ page }) => {
    await setup(
      page,
      `<div id="sheet" style="position:fixed;left:0;right:0;top:100px;height:400px"></div>`,
      `window.d = new ti.DragSurfaceController(document.getElementById('sheet'), { axis: 'y', snapPoints: () => [0, 200] });`,
    );
    await page.mouse.move(200, 150);
    await page.mouse.down();
    await page.mouse.move(260, 160, { steps: 4 });
    await page.mouse.up();
    expect(await page.evaluate(() => document.getElementById('sheet')!.hasAttribute('data-dragging'))).toBe(false);
    expect(await page.evaluate(() => (window as any).d.offset)).toBe(0);
  });
});

test.describe('surfaces', () => {
  test('dialog opens and Escape animates it closed', async ({ page }) => {
    await setup(
      page,
      `<button id="open">Open</button><dialog id="d"><p>Hello</p><button>OK</button></dialog>`,
      `window.m = ti.dialogMotion(document.getElementById('d'));
       document.getElementById('open').addEventListener('click', (e) => window.m.open(e.currentTarget));`,
    );
    await page.locator('#open').click();
    await expect(page.locator('#d')).toBeVisible();
    await page.keyboard.press('Escape');
    // Still open while animating out, then closed.
    await expect(page.locator('#d')).toHaveAttribute('data-tr-closing', '');
    await expect(page.locator('#d')).not.toBeVisible();
    await expect(page.locator('#open')).toBeFocused();
  });

  test('shake falls back to an alert attribute under reduced motion', async ({ page }) => {
    await setup(page, `<input id="i" data-tr-motion="reduce">`, `ti.shake(document.getElementById('i'))`);
    await expect(page.locator('#i')).toHaveAttribute('data-tr-alert', '');
  });
});

test.describe('RotaryController', () => {
  test('stepped selector snaps into notches and clicks through them by keyboard', async ({ page }) => {
    await setup(
      page,
      `<div id="k" aria-label="Mode" style="width:48px;height:48px;margin:60px"></div>`,
      `window.k = new ti.RotaryController(document.getElementById('k'), { min: 0, max: 4, step: 1, detents: 'steps', value: 0 });`,
    );
    const k = page.locator('#k');
    await k.focus();
    await page.keyboard.press('ArrowUp');
    await expect(k).toHaveAttribute('aria-valuenow', '1');
    const box = (await k.boundingBox())!;
    await page.mouse.move(box.x + 24, box.y + 24);
    await page.mouse.down();
    // 220 px is the full range: 70 px up is ~1.27 steps, which must settle on a notch.
    await page.mouse.move(box.x + 24, box.y + 24 - 70, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(k).toHaveAttribute('aria-valuenow', '2');
    expect(await page.evaluate(() => document.getElementById('k')!.style.getPropertyValue('--tr-angle'))).toBe('0.00deg');
  });
});
