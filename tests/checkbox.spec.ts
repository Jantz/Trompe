import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-checkbox', () => {
  test('exposes role, name and checked / mixed state', async ({ page }) => {
    await mount(page, `<tr-checkbox checked>Updates</tr-checkbox><tr-checkbox>Terms</tr-checkbox><tr-checkbox indeterminate>All</tr-checkbox>`);
    await expect(page.getByRole('checkbox', { name: 'Updates' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('checkbox', { name: 'Terms' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('checkbox', { name: 'All' })).toHaveAttribute('aria-checked', 'mixed');
  });

  test('toggles with click on box or label and with Space; fires input + change', async ({ page }) => {
    await mount(page, `<tr-checkbox id="c">Alerts</tr-checkbox>`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const c = document.getElementById('c')!;
      c.addEventListener('input', () => w.events.push('input'));
      c.addEventListener('change', () => w.events.push('change'));
    });
    const c = page.getByRole('checkbox', { name: 'Alerts' });
    await page.locator('#c .box').click();
    await expect(c).toHaveAttribute('aria-checked', 'true');
    await page.getByText('Alerts').click();
    await expect(c).toHaveAttribute('aria-checked', 'false');
    await c.focus();
    await page.keyboard.press('Space');
    await expect(c).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(c).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => (window as any).events)).toEqual(['input', 'change', 'input', 'change', 'input', 'change']);
  });

  test('clicking an indeterminate checkbox checks it', async ({ page }) => {
    await mount(page, `<tr-checkbox id="c" indeterminate>All</tr-checkbox>`);
    await page.locator('#c').click();
    await expect(page.locator('#c')).toHaveAttribute('aria-checked', 'true');
    expect(await page.locator('#c').evaluate((e: any) => e.indeterminate)).toBe(false);
  });

  test('submits, validates and resets with its form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-checkbox name="terms" required>Terms</tr-checkbox><tr-checkbox name="news" value="yes" checked>News</tr-checkbox></form>`);
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    expect(await read()).toBe('news=yes');
    expect(await valid()).toBe(false);
    await page.getByRole('checkbox', { name: 'Terms' }).click();
    await page.getByRole('checkbox', { name: 'News' }).click();
    expect(await read()).toBe('terms=on');
    expect(await valid()).toBe(true);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('news=yes');
  });

  test('disabled (directly or by fieldset) does not toggle and leaves the tab order', async ({ page }) => {
    await mount(page, `<tr-checkbox id="d" disabled>Locked</tr-checkbox><fieldset disabled><tr-checkbox id="e">In fieldset</tr-checkbox></fieldset>`);
    await page.locator('#d').click({ force: true });
    await page.locator('#e').click({ force: true });
    await expect(page.locator('#d')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#e')).toHaveAttribute('aria-checked', 'false');
    expect(await page.locator('#d').getAttribute('tabindex')).toBeNull();
    await expect(page.locator('#e')).toHaveAttribute('aria-disabled', 'true');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-checkbox checked>One</tr-checkbox><tr-checkbox aria-label="Two"></tr-checkbox><tr-checkbox indeterminate material="metal">Three</tr-checkbox><tr-checkbox disabled>Four</tr-checkbox>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('error and hint: described, invalid, and the box does not move', async ({ page }) => {
    await mount(page, '<form id="f"><tr-checkbox id="c" name="terms" hint="We never share it.">I accept the terms</tr-checkbox></form>');
    const c = page.locator('#c');
    await expect(c).toHaveAttribute('aria-description', 'We never share it.');
    const box = () => c.evaluate((el) => el.shadowRoot!.querySelector('.box')!.getBoundingClientRect().top);
    const before = await box();
    await c.evaluate((el) => el.setAttribute('error', 'Accept the terms to continue.'));
    await expect(c).toHaveAttribute('aria-invalid', 'true');
    await expect(c).toHaveAttribute('aria-description', 'Accept the terms to continue.. We never share it.');
    expect(await c.evaluate((el) => (el as unknown as { checkValidity(): boolean }).checkValidity())).toBe(false);
    expect(await box()).toBe(before);
    await c.evaluate((el) => el.removeAttribute('error'));
    expect(await c.evaluate((el) => (el as unknown as { checkValidity(): boolean }).checkValidity())).toBe(true);
  });

  test('visual: states, materials and themes', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:12px;align-items:center;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-checkbox>Off</tr-checkbox><tr-checkbox checked>On</tr-checkbox><tr-checkbox indeterminate>Mixed</tr-checkbox>
      <tr-checkbox checked material="metal" size="lg">Metal</tr-checkbox><tr-checkbox checked finish="gloss">Gloss</tr-checkbox>
      <tr-checkbox checked realism="flat">Flat</tr-checkbox><tr-checkbox checked disabled>Disabled</tr-checkbox></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('checkbox-matrix.png');
  });

  test('form reset restores the original state after the control is moved', async ({ page }) => {
    await mount(page, `<form id="f"><div id="a"><tr-checkbox id="x" name="c">C</tr-checkbox></div><div id="b"></div></form>`);
    await page.click('#x');
    await expect(page.locator('#x')).toHaveAttribute('checked');
    const after = await page.evaluate(async () => {
      const el = document.getElementById('x') as any;
      document.getElementById('b')!.append(el);
      (document.getElementById('f') as HTMLFormElement).reset();
      await el.updateComplete;
      return el.checked;
    });
    expect(after).toBe(false);
  });
});
