import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-pagination', () => {
  test('pageSlots keeps a fixed number of slots', async ({ page }) => {
    await mount(page, '');
    const slots = await page.evaluate(() => {
      const f = (window as any).trompe.pageSlots;
      return { start: f(1, 12, 1), mid: f(6, 12, 1), end: f(12, 12, 1), few: f(2, 5, 1) };
    });
    expect(slots.start).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
    expect(slots.mid).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(slots.end).toEqual([1, 'gap', 8, 9, 10, 11, 12]);
    expect(slots.few).toEqual([1, 2, 3, 4, 5]);
  });

  test('navigation landmark, named keys, current page, change event', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 400 });
    await mount(page, '<tr-pagination id="p" total="120" page-size="10" page="6"></tr-pagination>');
    const nav = page.getByRole('navigation', { name: 'Pagination' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Page 6' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('button', { name: 'Page 12' })).toBeVisible();
    const detail = page.locator('#p').evaluate((el) => new Promise((r) => el.addEventListener('change', (e: any) => r(e.detail), { once: true })));
    await nav.getByRole('button', { name: 'Next page' }).click();
    expect(await detail).toEqual({ page: 7 });
    await expect(nav.getByRole('button', { name: 'Page 7' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('button', { name: 'Page 12' }).click();
    expect(await page.locator('#p').evaluate((el: any) => el.page)).toBe(12);
    await expect(nav.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true');
    // the clicked number keeps focus on the current page key
    await expect(nav.getByRole('button', { name: 'Page 12' })).toBeFocused();
  });

  test('the bar keeps its width while paging through the middle', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 400 });
    await mount(page, '<tr-pagination id="p" pages="30" page="10"></tr-pagination>');
    const width = () => page.locator('#p').evaluate((el) => el.shadowRoot!.querySelector('.full')!.getBoundingClientRect().width);
    const w0 = await width();
    for (const p of [11, 12, 13]) {
      await page.locator('#p').evaluate((el: any, p) => (el.page = p), p);
      expect(await width()).toBeCloseTo(w0, 0);
    }
  });

  test('switches to "Page 3 of 40" when the row does not fit', async ({ page }) => {
    await page.setViewportSize({ width: 300, height: 400 });
    await mount(page, '<tr-pagination id="p" pages="40" page="3"></tr-pagination>');
    await expect(page.locator('#p')).toHaveAttribute('data-compact', '');
    await expect(page.locator('#p').locator('[part=status]')).toHaveText('Page 3 of 40');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(300);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('#p').locator('[part=status]')).toHaveText('Page 4 of 40');
    await page.setViewportSize({ width: 1000, height: 400 });
    await expect(page.locator('#p')).not.toHaveAttribute('data-compact', '');
  });

  test('has no axe violations (full and compact)', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 400 });
    await mount(page, '<tr-pagination pages="12" page="1"></tr-pagination><tr-pagination pages="12" page="4" compact label="Results"></tr-pagination>');
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});
