import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const TIP = `<div style="padding:80px 120px;display:flex;gap:24px">
  <tr-button id="save">Save</tr-button>
  <tr-tooltip id="t" for="save">Save the document</tr-tooltip>
  <tr-button id="share">Share</tr-button>
  <tr-tooltip id="t2" placement="bottom">Copy a link</tr-tooltip>
</div>`;

const isOpen = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`#${id}`).evaluate((t) => t.matches(':popover-open'));

test.describe('tr-tooltip', () => {
  test('role and aria-describedby on the anchor (for= and previous sibling)', async ({ page }) => {
    await mount(page, TIP);
    await expect(page.locator('#t')).toHaveAttribute('role', 'tooltip');
    await expect(page.locator('#save')).toHaveAttribute('aria-describedby', 't');
    await expect(page.locator('#share')).toHaveAttribute('aria-describedby', 't2');
    await expect(page.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription('Save the document');
  });

  test('shows on hover after a delay, hides on leave', async ({ page }) => {
    await mount(page, TIP);
    await page.locator('#save').hover();
    expect(await isOpen(page, 't')).toBe(false);
    await expect.poll(() => isOpen(page, 't')).toBe(true);
    // Above the anchor, centered.
    const a = (await page.locator('#save').boundingBox())!;
    const t = (await page.locator('#t').boundingBox())!;
    expect(t.y + t.height).toBeLessThanOrEqual(a.y + 1);
    expect(Math.abs(t.x + t.width / 2 - (a.x + a.width / 2))).toBeLessThan(3);
    await page.mouse.move(5, 300);
    await expect.poll(() => isOpen(page, 't')).toBe(false);
  });

  test('stays open while the pointer moves onto it', async ({ page }) => {
    await mount(page, TIP);
    await page.locator('#t').evaluate((t: any) => t.show());
    await page.locator('#save').hover();
    await page.locator('#t').hover();
    await page.waitForTimeout(300);
    expect(await isOpen(page, 't')).toBe(true);
  });

  test('shows at once on keyboard focus, hides on Escape and blur', async ({ page }) => {
    await mount(page, TIP);
    await page.keyboard.press('Tab');
    await expect(page.locator('#save')).toBeFocused();
    expect(await isOpen(page, 't')).toBe(true);
    await page.keyboard.press('Escape');
    expect(await isOpen(page, 't')).toBe(false);
    await expect(page.locator('#save')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await isOpen(page, 't2')).toBe(true);
    // placement=bottom
    const a = (await page.locator('#share').boundingBox())!;
    const t = (await page.locator('#t2').boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
    await page.keyboard.press('Shift+Tab');
    expect(await isOpen(page, 't2')).toBe(false);
    expect(await isOpen(page, 't')).toBe(true);
  });

  test('only one tooltip at a time; a press on the anchor hides it', async ({ page }) => {
    await mount(page, TIP);
    await page.locator('#t').evaluate((t: any) => t.show());
    await page.locator('#t2').evaluate((t: any) => t.show());
    expect(await isOpen(page, 't')).toBe(false);
    expect(await isOpen(page, 't2')).toBe(true);
    await page.locator('#share').click();
    expect(await isOpen(page, 't2')).toBe(false);
  });

  test('Escape on a tooltip inside a dialog does not close the dialog', async ({ page }) => {
    await mount(
      page,
      `<tr-dialog id="d" label="Tools"><tr-button id="b">Undo</tr-button><tr-tooltip for="b">Undo last change</tr-tooltip></tr-dialog>`,
    );
    await page.locator('#d').evaluate((d: any) => d.show());
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#b')).toBeFocused();
    await expect.poll(() => page.locator('tr-tooltip').evaluate((t) => t.matches(':popover-open'))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.locator('tr-tooltip').evaluate((t) => t.matches(':popover-open'))).toBe(false);
    await expect(page.locator('#d')).toHaveAttribute('open', '');
  });

  test('JS placement fallback', async ({ page }) => {
    await mount(page, TIP);
    await page.evaluate(async () => {
      const mod = await import('/src/components/menu/position.ts' as string);
      mod.positioning.css = false;
    });
    await page.locator('#t2').evaluate((t: any) => t.show());
    // The tooltip re-places itself when its size changes (e.g. a web font finishing loading).
    await expect
      .poll(async () => {
        const a = (await page.locator('#share').boundingBox())!;
        const t = (await page.locator('#t2').boundingBox())!;
        return t.y >= a.y + a.height - 1 && Math.abs(t.x + t.width / 2 - (a.x + a.width / 2)) < 3;
      })
      .toBe(true);
  });

  test('has no axe violations when shown', async ({ page }) => {
    await mount(page, TIP);
    await page.locator('#t').evaluate((t: any) => t.show());
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: label plate', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 200 });
    await mount(page, TIP);
    await page.locator('#t').evaluate((t: any) => t.show());
    await expect(page).toHaveScreenshot('tooltip.png');
  });
});
