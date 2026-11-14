import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { importAlone, mount } from './helpers';

const plain = `<tr-list label="Account">
  <tr-list-item>Email<span slot="description">ada@example.com</span><tr-button slot="end" size="sm">Change</tr-button></tr-list-item>
  <tr-list-item>Notifications<tr-switch slot="end" aria-label="Notifications"></tr-switch></tr-list-item>
  <tr-list-item>Plan<tr-badge slot="end" tone="accent">Pro</tr-badge></tr-list-item>
</tr-list>`;
const box = (attrs = '') => `<tr-list id="l" selectable label="Files" ${attrs}>
  <tr-list-item value="notes">Notes</tr-list-item>
  <tr-list-item value="plan">Plan</tr-list-item>
  <tr-list-item value="budget" disabled>Budget</tr-list-item>
  <tr-list-item value="photos">Photos</tr-list-item>
</tr-list>`;

test.describe('tr-list', () => {
  test('plain list exposes list and listitems; controls inside stay usable', async ({ page }) => {
    await mount(page, plain);
    const list = page.getByRole('list', { name: 'Account' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();
    await page.getByRole('switch', { name: 'Notifications' }).click();
    await expect(page.getByRole('switch', { name: 'Notifications' })).toHaveAttribute('aria-checked', 'true');
    expect(await page.locator('tr-list-item').first().getAttribute('tabindex')).toBeNull();
  });

  test('selectable list is a listbox with one Tab stop; selection follows focus', async ({ page }) => {
    await mount(page, box('value="plan"'));
    const lb = page.getByRole('listbox', { name: 'Files' });
    await expect(lb.getByRole('option')).toHaveCount(4);
    await expect(page.getByRole('option', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Plan' })).toHaveAttribute('tabindex', '0');
    await page.evaluate(() => {
      (window as any).changes = 0;
      document.getElementById('l')!.addEventListener('change', () => (window as any).changes++);
    });
    await page.getByRole('option', { name: 'Plan' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Photos' })).toBeFocused();
    await expect(page.getByRole('option', { name: 'Photos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Plan' })).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Home');
    await expect(page.getByRole('option', { name: 'Notes' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('option', { name: 'Photos' })).toBeFocused();
    await page.keyboard.press('n');
    await expect(page.getByRole('option', { name: 'Notes' })).toBeFocused();
    expect(await page.locator('#l').evaluate((el: any) => el.value)).toBe('notes');
    expect(await page.evaluate(() => (window as any).changes)).toBe(4);
  });

  test('multiple: Space and click toggle; aria-multiselectable', async ({ page }) => {
    await mount(page, box('multiple'));
    await expect(page.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    await page.getByRole('option', { name: 'Notes' }).click();
    await page.getByRole('option', { name: 'Photos' }).click();
    expect(await page.locator('#l').evaluate((el: any) => el.selectedValues)).toEqual(['notes', 'photos']);
    await page.keyboard.press('Space');
    await expect(page.getByRole('option', { name: 'Photos' })).toHaveAttribute('aria-selected', 'false');
    await page.getByRole('option', { name: 'Budget' }).click({ force: true });
    await expect(page.getByRole('option', { name: 'Budget' })).toHaveAttribute('aria-selected', 'false');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, plain + box('value="plan" variant="card"'));
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: inset and selectable card', async ({ page }) => {
    await mount(page, `<div style="display:grid;gap:16px;width:420px">${plain}${box('value="plan" variant="card"')}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('list-matrix.png');
  });

  test('importing list alone defines tr-list-item', async ({ page }) => {
    expect(await importAlone(page, '/src/components/list/list.ts', ['tr-list', 'tr-list-item'])).toEqual({ 'tr-list': true, 'tr-list-item': true });
  });
});
