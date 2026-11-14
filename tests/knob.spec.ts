import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-knob', () => {
  test('exposes slider role, name and value', async ({ page }) => {
    await mount(page, `<tr-knob label="Volume" value="40" unit="%"></tr-knob>`);
    const knob = page.getByRole('slider', { name: 'Volume' });
    await expect(knob).toHaveAttribute('aria-valuenow', '40');
    await expect(knob).toHaveAttribute('aria-valuemin', '0');
    await expect(knob).toHaveAttribute('aria-valuemax', '100');
    await expect(knob).toHaveAttribute('aria-valuetext', '40%');
    await expect(knob).toHaveAttribute('tabindex', '0');
  });

  test('keyboard follows the APG slider pattern', async ({ page }) => {
    await mount(page, `<tr-knob label="Gain" min="-12" max="12" step="0.5" value="0"></tr-knob>`);
    const knob = page.getByRole('slider', { name: 'Gain' });
    await knob.focus();
    await page.keyboard.press('ArrowUp');
    await expect(knob).toHaveAttribute('aria-valuenow', '0.5');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(knob).toHaveAttribute('aria-valuenow', '-0.5');
    await page.keyboard.press('PageUp');
    await expect(knob).toHaveAttribute('aria-valuenow', '2');
    await page.keyboard.press('End');
    await expect(knob).toHaveAttribute('aria-valuenow', '12');
    await page.keyboard.press('Home');
    await expect(knob).toHaveAttribute('aria-valuenow', '-12');
  });

  test('vertical drag turns the knob, Shift is fine, double-click resets', async ({ page }) => {
    await mount(page, `<tr-knob id="k" label="Drive" value="50"></tr-knob>`);
    await page.evaluate(() => {
      const w = window as any;
      w.inputs = 0;
      w.changes = 0;
      const k = document.getElementById('k')!;
      k.addEventListener('input', () => w.inputs++);
      k.addEventListener('change', () => w.changes++);
    });
    const box = (await page.locator('#k').locator('.knob').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 4 });
    await page.mouse.up();
    // 200px sweeps the whole range: 40px up is +20.
    expect(await page.evaluate(() => (document.getElementById('k') as any).value)).toBe(70);
    expect(await page.evaluate(() => (window as any).inputs)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).changes)).toBe(1);

    await page.mouse.move(cx, cy);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy, { steps: 4 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => (document.getElementById('k') as any).value)).toBe(72);

    await page.locator('#k .knob').dblclick();
    expect(await page.evaluate(() => (document.getElementById('k') as any).value)).toBe(50);
  });

  test('indicator angle follows the value', async ({ page }) => {
    await mount(page, `<tr-knob id="k" label="Pan" value="100"></tr-knob>`);
    expect(await page.evaluate(() => (document.getElementById('k') as any).angle)).toBe(135);
    await page.evaluate(() => ((document.getElementById('k') as any).value = 0));
    expect(await page.evaluate(() => (document.getElementById('k') as any).angle)).toBe(-135);
  });

  test('submits and resets with its form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-knob name="cutoff" label="Cutoff" value="30"></tr-knob></form>`);
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    expect(await read()).toBe('cutoff=30');
    await page.getByRole('slider', { name: 'Cutoff' }).focus();
    await page.keyboard.press('End');
    expect(await read()).toBe('cutoff=100');
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await expect(page.getByRole('slider', { name: 'Cutoff' })).toHaveAttribute('aria-valuenow', '30');
  });

  test('disabled ignores input and leaves the tab order', async ({ page }) => {
    await mount(page, `<tr-knob id="k" label="Off" value="10" disabled></tr-knob>`);
    const k = page.locator('#k');
    expect(await k.getAttribute('tabindex')).toBeNull();
    await expect(k).toHaveAttribute('aria-disabled', 'true');
    const box = (await k.locator('.knob').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 50, { steps: 3 });
    await page.mouse.up();
    expect(await page.evaluate(() => (document.getElementById('k') as any).value)).toBe(10);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-knob label="Volume" value="40"></tr-knob>
       <tr-knob aria-label="Gain" variant="skirt" marks="0,5,10"></tr-knob>
       <tr-knob label="Mode" variant="pointer" min="1" max="4" ticks="4"></tr-knob>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: variants, materials and themes', async ({ page }) => {
    const row = `<tr-knob label="Volume" value="40" unit="%"></tr-knob>
      <tr-knob label="Gain" min="-12" max="12" step="0.5" unit=" dB" arc="center" value="4" material="metal"></tr-knob>
      <tr-knob label="Chrome" value="70" material="chrome"></tr-knob>
      <tr-knob label="Cutoff" variant="skirt" material="rubber" value="65" marks="0,2,4,6,8,10"></tr-knob>
      <tr-knob label="Mode" variant="pointer" min="1" max="5" ticks="5" value="2" material="rubber"></tr-knob>
      <tr-knob label="Small" size="sm" value="80" realism="flat"></tr-knob>`;
    await mount(
      page,
      `<div style="display:flex;flex-wrap:wrap;gap:16px;padding:12px;align-items:flex-start">${row}</div>
       <div data-tr-theme="dark" style="display:flex;flex-wrap:wrap;gap:16px;padding:12px;align-items:flex-start;background:var(--tr-color-canvas);color:var(--tr-color-ink)">${row}</div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('knob-matrix.png');
  });
});
