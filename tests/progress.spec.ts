import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-progress', () => {
  test('exposes role, name and value', async ({ page }) => {
    await mount(page, `<tr-progress id="p" label="Uploading" value="40" show-value></tr-progress>`);
    const bar = page.getByRole('progressbar', { name: 'Uploading' });
    await expect(bar).toHaveAttribute('aria-valuenow', '40');
    await expect(bar).toHaveAttribute('aria-valuemin', '0');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
    await expect(bar).toHaveAttribute('aria-valuetext', '40%');
    await expect(bar.locator('[part=value]')).toHaveText('40%');
  });

  test('value updates, max scales and clamps', async ({ page }) => {
    await mount(page, `<tr-progress id="p" label="Files" value="3" max="12" value-text="3 of 12 files"></tr-progress>`);
    const bar = page.locator('#p');
    await expect(bar).toHaveAttribute('aria-valuetext', '3 of 12 files');
    expect(await bar.evaluate((el: any) => el.fraction)).toBe(0.25);
    await bar.evaluate(async (el: any) => {
      el.value = 30;
      await el.updateComplete;
    });
    await expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(await bar.evaluate((el: any) => el.fraction)).toBe(1);
  });

  test('indeterminate omits aria-valuenow', async ({ page }) => {
    await mount(page, `<tr-progress label="Syncing"></tr-progress><tr-progress label="Loading" indeterminate value="5" variant="ring"></tr-progress>`);
    for (const name of ['Syncing', 'Loading']) {
      const bar = page.getByRole('progressbar', { name });
      expect(await bar.getAttribute('aria-valuenow')).toBeNull();
      await expect(bar).toHaveAttribute('data-unknown', '');
    }
  });

  test('reduced motion stops the indeterminate animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, `<tr-progress label="Syncing"></tr-progress>`);
    const name = await page.locator('tr-progress').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.fill')!).animationName);
    expect(name).toBe('none');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-progress label="Upload" value="20" show-value></tr-progress><tr-progress variant="ring" value="70" show-value label="Disk" tone="warning"></tr-progress><tr-progress aria-label="Busy"></tr-progress>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: linear and ring', async ({ page }) => {
    await mount(
      page,
      `<div style="display:grid;gap:16px;width:420px">
        <tr-progress label="Uploading" value="62" show-value></tr-progress>
        <tr-progress label="Done" value="100" tone="success" size="lg"></tr-progress>
        <tr-progress label="Material" value="35" material="metal" realism="real"></tr-progress>
        <div style="display:flex;gap:16px;align-items:end">
          <tr-progress variant="ring" value="72" show-value label="Storage"></tr-progress>
          <tr-progress variant="ring" value="30" size="sm" tone="success" label="CPU"></tr-progress>
          <tr-progress variant="ring" value="88" size="lg" show-value tone="danger" label="Quota"></tr-progress>
        </div>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('progress-matrix.png');
  });
});
