import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-led', () => {
  test('labelled lamp is an image named with its state', async ({ page }) => {
    await mount(page, `<tr-led id="a" on label="Power"></tr-led><tr-led id="b" label="Record"></tr-led><tr-led id="c" blink label="Alarm"></tr-led>`);
    await expect(page.getByRole('img', { name: 'Power: on' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Record: off' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Alarm: blinking' })).toBeVisible();
    await page.evaluate(() => ((document.getElementById('a') as any).on = false));
    await expect(page.locator('#a')).toHaveAttribute('aria-label', 'Power: off');
  });

  test('unlabelled lamp is decorative', async ({ page }) => {
    await mount(page, `<tr-led id="d" on></tr-led><tr-led id="e" aria-label="Link"></tr-led>`);
    await expect(page.locator('#d')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#e')).toHaveAttribute('role', 'img');
    await expect(page.locator('#e')).not.toHaveAttribute('aria-hidden', 'true');
  });

  test('reflects attributes and accepts any CSS color', async ({ page }) => {
    await mount(page, `<tr-led id="f" color="#ff00aa" shape="bar" size="lg" on></tr-led>`);
    const lit = await page.locator('#f').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.light')!).opacity);
    expect(Number(lit)).toBeGreaterThan(0.9);
    await expect(page.locator('#f')).toHaveAttribute('shape', 'bar');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-led on label="Power"></tr-led><tr-led color="red" label="Rec"></tr-led><tr-led on></tr-led>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: colors, shapes, states', async ({ page }) => {
    await mount(
      page,
      `<div style="display:grid;gap:12px;font-size:20px">
        <div style="display:flex;gap:16px;align-items:center;padding:8px">
          <tr-led on color="red"></tr-led><tr-led color="red"></tr-led><tr-led on color="green"></tr-led><tr-led color="green"></tr-led>
          <tr-led on color="amber"></tr-led><tr-led on color="blue"></tr-led><tr-led on color="white"></tr-led>
          <tr-led on shape="square" color="green"></tr-led><tr-led on shape="bar" color="amber"></tr-led><tr-led size="lg" on color="yellow"></tr-led>
        </div>
        <div data-tr-theme="dark" data-tr-material="chrome" style="display:flex;gap:16px;align-items:center;padding:8px;background:var(--tr-color-canvas)">
          <tr-led on color="red"></tr-led><tr-led color="red"></tr-led><tr-led on color="blue" size="lg"></tr-led><tr-led shape="bar" color="green"></tr-led>
        </div>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('led-matrix.png');
  });
});
