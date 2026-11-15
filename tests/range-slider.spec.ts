import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// @ts-expect-error plain ESM module shared with the CLI
import { measureChange, motionProblems } from '../cli/check/motion.mjs';

/** Opens the fixture, loads tr-range-slider, mounts the markup and waits for its first render. */
async function mount(page: Page, markup: string, theme?: 'light' | 'dark'): Promise<void> {
  await page.goto('/tests/fixture.html');
  await page.waitForFunction(() => (window as unknown as { trompeReady?: boolean }).trompeReady === true);
  await page.addScriptTag({ type: 'module', content: "import '/src/components/range-slider/range-slider.ts'" });
  await page.evaluate(() => customElements.whenDefined('tr-range-slider'));
  await page.evaluate(
    async ({ markup, theme }) => {
      if (theme) document.documentElement.dataset.trTheme = theme;
      const root = document.getElementById('root')!;
      root.innerHTML = markup;
      const els = [...root.querySelectorAll('*')].filter((el) => el.tagName.startsWith('TR-')) as Array<HTMLElement & { updateComplete?: Promise<unknown> }>;
      await Promise.all(els.map((el) => el.updateComplete));
    },
    { markup, theme },
  );
}

type RS = HTMLElement & { low: number; high: number; value: string; updateComplete: Promise<unknown> };
const vals = (page: Page) => page.evaluate(() => { const r = document.getElementById('r') as RS; return [r.low, r.high]; });

test.describe('tr-range-slider', () => {
  test('a named group with two sliders that limit each other', async ({ page }) => {
    await mount(page, `<tr-range-slider id="r" label="Price" min="0" max="1000" step="10" low="280" high="620" currency="EUR" min-gap="50"></tr-range-slider>`);
    await expect(page.getByRole('group', { name: 'Price' })).toBeVisible();
    const lo = page.getByRole('slider', { name: 'Minimum price' });
    const hi = page.getByRole('slider', { name: 'Maximum price' });
    await expect(lo).toHaveAttribute('aria-valuenow', '280');
    await expect(lo).toHaveAttribute('aria-valuemin', '0');
    await expect(lo).toHaveAttribute('aria-valuemax', '570');
    await expect(lo).toHaveAttribute('aria-valuetext', /280/);
    await expect(hi).toHaveAttribute('aria-valuenow', '620');
    await expect(hi).toHaveAttribute('aria-valuemin', '330');
    await expect(hi).toHaveAttribute('aria-valuemax', '1000');
    await expect(page.locator('#r [part~="value"]')).toHaveText(/280.*–.*620/);
  });

  test('keyboard moves each cap; caps stop min-gap short of each other', async ({ page }) => {
    await mount(page, `<tr-range-slider id="r" label="Hours" min="0" max="24" low="6" high="18" min-gap="2"></tr-range-slider>`);
    const lo = page.getByRole('slider', { name: 'Minimum hours' });
    const hi = page.getByRole('slider', { name: 'Maximum hours' });
    await lo.focus();
    await page.keyboard.press('ArrowRight');
    expect(await vals(page)).toEqual([7, 18]);
    await page.keyboard.press('End');
    expect(await vals(page)).toEqual([16, 18]);
    await page.keyboard.press('Home');
    expect(await vals(page)).toEqual([0, 18]);
    await hi.focus();
    await page.keyboard.press('PageDown');
    expect(await vals(page)).toEqual([0, 16]);
    await page.keyboard.press('Home');
    expect(await vals(page)).toEqual([0, 2]);
    await page.keyboard.press('ArrowLeft');
    expect(await vals(page)).toEqual([0, 2]);
    await expect(hi).toHaveAttribute('aria-valuenow', '2');
  });

  test('code keeps the range valid', async ({ page }) => {
    await mount(page, `<tr-range-slider id="r" label="Size" min="10" max="50" min-gap="5"></tr-range-slider>`);
    expect(await vals(page)).toEqual([10, 50]);
    await page.evaluate(async () => { const r = document.getElementById('r') as RS; r.value = '40,20'; await r.updateComplete; });
    const [a, b] = await vals(page);
    expect(b - a).toBeGreaterThanOrEqual(5);
    expect(a).toBeGreaterThanOrEqual(10);
    expect(b).toBeLessThanOrEqual(50);
    await page.evaluate(async () => { const r = document.getElementById('r') as RS; r.low = -5; r.high = 99; await r.updateComplete; });
    expect(await vals(page)).toEqual([10, 50]);
  });

  test('pointer: the slot moves the nearer cap, a cap drags without jumping and never crosses', async ({ page }) => {
    await mount(page, `<div style="width:420px"><tr-range-slider id="r" label="Price" min="0" max="100" low="20" high="80" hide-value></tr-range-slider></div>`);
    await page.evaluate(() => {
      const w = window as unknown as { inputs: number; changes: number };
      w.inputs = 0; w.changes = 0;
      const r = document.getElementById('r')!;
      r.addEventListener('input', () => w.inputs++);
      r.addEventListener('change', () => w.changes++);
    });
    const track = (await page.locator('#r .track').boundingBox())!;
    const cap = (await page.locator('#r .thumb.low').boundingBox())!;
    const xAt = (v: number) => track.x + cap.width / 2 + (v / 100) * (track.width - cap.width);
    const y = track.y + track.height / 2;
    // a press near 90 moves the high cap
    await page.mouse.click(xAt(90), y);
    let [a, b] = await vals(page);
    expect(a).toBe(20);
    expect(b).toBeGreaterThanOrEqual(89);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(1);
    // grab the low cap off-centre: no jump on press
    const lowBox = (await page.locator('#r .thumb.low').boundingBox())!;
    await page.mouse.move(lowBox.x + lowBox.width * 0.8, y);
    await page.mouse.down();
    expect((await vals(page))[0]).toBe(20);
    // drag it past the high cap: it stops there
    await page.mouse.move(xAt(99), y, { steps: 8 });
    [a, b] = await vals(page);
    expect(a).toBe(b);
    await expect(page.locator('#r')).toHaveAttribute('data-dragging', '');
    await page.mouse.up();
    await expect(page.locator('#r')).not.toHaveAttribute('data-dragging', '');
    expect(await page.evaluate(() => (window as unknown as { inputs: number }).inputs)).toBeGreaterThan(2);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(2);
  });

  test('submits low and high under its name and resets with the form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-range-slider id="r" name="price" label="Price" min="0" max="1000" step="10" low="200" high="600"></tr-range-slider></form>`);
    await page.getByRole('slider', { name: 'Minimum price' }).focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).getAll('price'))).toEqual(['210', '600']);
    expect(await page.evaluate(() => (document.getElementById('r') as RS).value)).toBe('210,600');
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await expect.poll(() => vals(page)).toEqual([200, 600]);
  });

  test('disabled: no focus, no input', async ({ page }) => {
    await mount(page, `<tr-range-slider id="r" label="Price" low="20" high="80" disabled></tr-range-slider>`);
    await expect(page.getByRole('slider', { name: 'Minimum price' })).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('slider', { name: 'Minimum price' })).toHaveAttribute('aria-disabled', 'true');
    const track = (await page.locator('#r .track').boundingBox())!;
    await page.mouse.click(track.x + track.width - 4, track.y + track.height / 2);
    expect(await vals(page)).toEqual([20, 80]);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-range-slider label="Price" min="0" max="1000" step="10" low="280" high="620" currency="EUR" ticks="5"></tr-range-slider>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test.describe('motion', () => {
    const markup = '<tr-range-slider id="r" label="Price" min="0" max="1000" step="10" low="80" high="620" currency="EUR" style="width:360px"></tr-range-slider>';
    const cases: Array<[string, (p: Page) => Promise<unknown>, ((p: Page) => Promise<unknown>)?]> = [
      ['code sets low and high', (p) => p.evaluate(() => { const r = document.getElementById('r') as RS; r.low = 300; r.high = 900; })],
      ['arrow key step', (p) => p.keyboard.press('PageUp'), (p) => p.getByRole('slider', { name: 'Maximum price' }).focus()],
      ['becomes disabled', (p) => p.evaluate(() => document.getElementById('r')!.setAttribute('disabled', ''))],
    ];
    for (const [name, trigger, setup] of cases) {
      test(name, async ({ page }) => {
        await page.setViewportSize({ width: 800, height: 600 });
        await mount(page, markup);
        if (setup) await setup(page);
        const m = await measureChange(page, trigger, { clip: { x: 0, y: 0, width: 800, height: 600 } });
        expect(motionProblems(m), JSON.stringify(m, null, 1)).toEqual([]);
      });
    }
  });
});
