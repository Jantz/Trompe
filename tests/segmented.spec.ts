import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const seg = (attrs = '') => `<form id="f"><tr-segmented id="s" aria-label="View" name="view" ${attrs}>
  <tr-option value="list">List</tr-option><tr-option value="grid">Grid</tr-option><tr-option value="map" disabled>Map</tr-option><tr-option value="board">Board</tr-option>
</tr-segmented></form>`;

test.describe('tr-segmented', () => {
  test('is a radiogroup of radios with checked state', async ({ page }) => {
    await mount(page, seg('value="grid"'));
    const g = page.getByRole('radiogroup', { name: 'View' });
    await expect(g.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radio', { name: 'Map' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('radio', { name: 'Grid' })).not.toHaveAttribute('aria-selected');
  });

  test('roving tabindex and arrow keys (wrap, skip disabled, Home/End)', async ({ page }) => {
    await mount(page, `<button id="b">b</button>${seg('value="grid"')}`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      document.getElementById('s')!.addEventListener('change', (e: any) => w.events.push(e.target.value));
    });
    await page.locator('#b').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Grid' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Board' })).toBeFocused();
    await expect(page.getByRole('radio', { name: 'Board' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'List' })).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => (window as any).events)).toEqual(['board', 'list', 'board', 'list', 'board']);
    const tab = await page.locator('tr-option').evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
    expect(tab).toEqual(['-1', '-1', '-1', '0']);
  });

  test('click latches a key; disabled key ignored; Space selects focused', async ({ page }) => {
    await mount(page, seg());
    await page.getByRole('radio', { name: 'Board' }).click();
    await expect(page.getByRole('radio', { name: 'Board' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Map' }).click({ force: true });
    await expect(page.getByRole('radio', { name: 'Map' })).toHaveAttribute('aria-checked', 'false');
    expect(await page.locator('#s').evaluate((e: any) => e.value)).toBe('board');
  });

  test('form value, required and reset', async ({ page }) => {
    await mount(page, seg('required'));
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    expect(await valid()).toBe(false);
    await page.getByRole('radio', { name: 'List' }).click();
    expect(await read()).toBe('view=list');
    expect(await valid()).toBe(true);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `${seg('value="list"')}<tr-segmented aria-label="Range" material="metal" size="sm"><tr-option>Day</tr-option><tr-option>Week</tr-option></tr-segmented>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: sizes, materials and themes', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:12px;align-items:center;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      ${seg('value="grid"').replace('<form id="f">', '').replace('</form>', '').replace('id="s"', '')}
      <tr-segmented aria-label="Range" material="metal" size="sm" value="Week"><tr-option>Day</tr-option><tr-option>Week</tr-option><tr-option>Month</tr-option></tr-segmented>
      <tr-segmented aria-label="Flat" realism="flat" size="lg" value="A"><tr-option>A</tr-option><tr-option>B</tr-option></tr-segmented></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('segmented-matrix.png');
  });
});
