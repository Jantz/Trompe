import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-switch', () => {
  test('exposes switch role, name and checked state', async ({ page }) => {
    await mount(page, `<tr-switch checked>Wi-Fi</tr-switch><tr-switch>Bluetooth</tr-switch>`);
    await expect(page.getByRole('switch', { name: 'Wi-Fi' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: 'Bluetooth' })).toHaveAttribute('aria-checked', 'false');
  });

  test('toggles with click, Space and Enter and fires input + change', async ({ page }) => {
    await mount(page, `<tr-switch id="s">Alerts</tr-switch>`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const s = document.getElementById('s')!;
      s.addEventListener('input', () => w.events.push('input'));
      s.addEventListener('change', () => w.events.push('change'));
    });
    const s = page.getByRole('switch', { name: 'Alerts' });
    await s.click();
    await expect(s).toHaveAttribute('aria-checked', 'true');
    await s.focus();
    await page.keyboard.press('Space');
    await expect(s).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Enter');
    await expect(s).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => (window as any).events)).toEqual(['input', 'change', 'input', 'change', 'input', 'change']);
  });

  test('sizes are in em and scale with font-size', async ({ page }) => {
    await mount(page, `<tr-switch id="a">A</tr-switch><div style="font-size:32px"><tr-switch id="b">B</tr-switch></div>`);
    const a = (await page.locator('#a .track').boundingBox())!;
    const b = (await page.locator('#b .track').boundingBox())!;
    expect(b.width / a.width).toBeCloseTo(2, 1);
  });

  test('submits, validates and resets with its form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-switch name="alerts" required>Alerts</tr-switch><tr-switch name="dark" value="yes" checked>Dark</tr-switch></form>`);
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    expect(await read()).toBe('dark=yes');
    expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(false);
    await page.getByRole('switch', { name: 'Alerts' }).click();
    await page.getByRole('switch', { name: 'Dark' }).click();
    expect(await read()).toBe('alerts=on');
    expect(await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity())).toBe(true);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('dark=yes');
  });

  test('disabled does not toggle', async ({ page }) => {
    await mount(page, `<tr-switch id="d" disabled>Locked</tr-switch>`);
    await page.locator('#d').click({ force: true });
    await expect(page.locator('#d')).toHaveAttribute('aria-checked', 'false');
    expect(await page.locator('#d').getAttribute('tabindex')).toBeNull();
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-switch checked>One</tr-switch><tr-switch aria-label="Two"></tr-switch><tr-switch material="metal" size="lg">Three</tr-switch>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: sizes, materials and themes', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:12px;align-items:center;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-switch size="sm" checked>Small</tr-switch><tr-switch>Off</tr-switch><tr-switch checked>On</tr-switch>
      <tr-switch size="lg" checked material="metal">Metal</tr-switch><tr-switch size="lg" material="chrome">Chrome</tr-switch>
      <tr-switch checked material="rubber" finish="gloss">Gloss</tr-switch><tr-switch realism="flat" checked>Flat</tr-switch></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('switch-matrix.png');
  });

  test('form reset restores the original state after the control is moved', async ({ page }) => {
    await mount(page, `<form id="f"><div id="a"><tr-switch id="x" name="s" checked>S</tr-switch></div><div id="b"></div></form>`);
    await page.click('#x');
    await expect(page.locator('#x')).not.toHaveAttribute('checked');
    const after = await page.evaluate(async () => {
      const el = document.getElementById('x') as any;
      document.getElementById('b')!.append(el);
      (document.getElementById('f') as HTMLFormElement).reset();
      await el.updateComplete;
      return el.checked;
    });
    expect(after).toBe(true);
  });
});
