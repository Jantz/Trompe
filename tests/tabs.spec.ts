import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const set = (attrs = '') => `<tr-tabs id="t" label="Settings" ${attrs}>
  <tr-tab>General</tr-tab><tr-tab>Privacy</tr-tab><tr-tab disabled>Billing</tr-tab><tr-tab>Alerts</tr-tab>
  <tr-tab-panel>General panel</tr-tab-panel><tr-tab-panel>Privacy panel</tr-tab-panel><tr-tab-panel>Billing panel</tr-tab-panel><tr-tab-panel>Alerts panel</tr-tab-panel>
</tr-tabs>`;

test.describe('tr-tabs', () => {
  test('exposes tablist, tabs and linked panels', async ({ page }) => {
    await mount(page, set());
    await expect(page.getByRole('tablist', { name: 'Settings' })).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(page.getByRole('tab')).toHaveCount(4);
    const first = page.getByRole('tab', { name: 'General' });
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tab', { name: 'Privacy' })).toHaveAttribute('tabindex', '-1');
    const panel = page.getByRole('tabpanel', { name: 'General' });
    await expect(panel).toHaveText('General panel');
    expect(await first.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'));
    await expect(page.getByText('Privacy panel')).toBeHidden();
    expect(await page.locator('#t').evaluate((el: any) => el.value)).toBe('0');
  });

  test('arrow keys move and select (automatic), skipping disabled, wrapping, Home/End', async ({ page }) => {
    await mount(page, set());
    await page.evaluate(() => {
      (window as any).changes = 0;
      document.getElementById('t')!.addEventListener('change', () => (window as any).changes++);
    });
    await page.getByRole('tab', { name: 'General' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Privacy' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Privacy' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Privacy panel')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Alerts' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'General' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Alerts' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'General' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Alerts' })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => (window as any).changes)).toBe(6);
  });

  test('manual activation waits for Enter or Space', async ({ page }) => {
    await mount(page, set('activation="manual"'));
    await page.getByRole('tab', { name: 'General' }).focus();
    await page.keyboard.press('ArrowRight');
    const privacy = page.getByRole('tab', { name: 'Privacy' });
    await expect(privacy).toBeFocused();
    await expect(privacy).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(privacy).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await expect(page.getByRole('tab', { name: 'Alerts' })).toHaveAttribute('aria-selected', 'true');
  });

  test('vertical uses Up/Down', async ({ page }) => {
    await mount(page, set('orientation="vertical"'));
    await expect(page.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    await page.getByRole('tab', { name: 'General' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('tab', { name: 'Privacy' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
  });

  test('click selects; disabled tab does not', async ({ page }) => {
    await mount(page, set());
    await page.getByRole('tab', { name: 'Alerts' }).click();
    await expect(page.getByText('Alerts panel')).toBeVisible();
    await page.getByRole('tab', { name: 'Billing' }).click({ force: true });
    await expect(page.getByRole('tab', { name: 'Billing' })).toHaveAttribute('aria-selected', 'false');
  });

  test('pairs by panel/name and selects by value', async ({ page }) => {
    await mount(
      page,
      `<tr-tabs id="t" value="b" label="Named"><tr-tab panel="a">A</tr-tab><tr-tab panel="b">B</tr-tab>
       <tr-tab-panel name="b">Panel B</tr-tab-panel><tr-tab-panel name="a">Panel A</tr-tab-panel></tr-tabs>`,
    );
    await expect(page.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Panel B')).toBeVisible();
    await expect(page.getByText('Panel A')).toBeHidden();
    await page.locator('#t').evaluate((el: any) => (el.value = 'a'));
    await expect(page.getByText('Panel A')).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', (await page.getByRole('tab', { name: 'A' }).getAttribute('id'))!);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, set() + set('variant="keys" orientation="vertical"').replace('id="t"', 'id="t2"'));
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: folder and keys', async ({ page }) => {
    await mount(
      page,
      `<div style="display:grid;gap:20px;width:560px">${set()}${set('variant="keys"').replace('id="t"', '')}${set('orientation="vertical" material="metal"').replace('id="t"', '')}</div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('tabs-matrix.png');
  });
});
