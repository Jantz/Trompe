import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-meter', () => {
  test('bar exposes role meter with values', async ({ page }) => {
    await mount(page, `<tr-meter id="m" label="Level" min="-48" max="6" unit=" dB" value="-12"></tr-meter>`);
    const m = page.getByRole('meter', { name: 'Level' });
    await expect(m).toHaveAttribute('aria-valuemin', '-48');
    await expect(m).toHaveAttribute('aria-valuemax', '6');
    await expect(m).toHaveAttribute('aria-valuenow', '-12');
    await expect(m).toHaveAttribute('aria-valuetext', '-12 dB');
  });

  test('value lights whole segments without re-rendering', async ({ page }) => {
    await mount(page, `<tr-meter id="m" label="Level" segments="10" value="0.5"></tr-meter>`);
    const v = () => page.locator('#m').evaluate((el) => (el.shadowRoot!.querySelector('.band') as HTMLElement).style.getPropertyValue('--_mv'));
    expect(await v()).toBe('0.5');
    await page.evaluate(() => ((document.getElementById('m') as any).value = 0.83));
    expect(await v()).toBe('0.8');
    await expect(page.locator('#m')).toHaveAttribute('aria-valuenow', '0.83');
  });

  test('spectrum takes values as attribute and property', async ({ page }) => {
    await mount(page, `<tr-meter id="s" mode="spectrum" segments="10" values="0.1, 0.5, 1" peak></tr-meter>`);
    await expect(page.getByRole('img', { name: 'Spectrum analyzer' })).toBeVisible();
    expect(await page.locator('#s').evaluate((el) => el.shadowRoot!.querySelectorAll('.band').length)).toBe(3);
    await page.evaluate(() => {
      const s = document.getElementById('s') as any;
      s.bands = 8;
    });
    await page.evaluate(async () => {
      const s = document.getElementById('s') as any;
      await s.updateComplete;
      s.values = [0, 0.2, 0.4, 0.6, 0.8, 1, 0.5, 0.3];
    });
    const vs = await page.locator('#s').evaluate((el) =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.band')].map((b) => b.style.getPropertyValue('--_mv')),
    );
    expect(vs).toEqual(['0', '0.2', '0.4', '0.6', '0.8', '1', '0.5', '0.3']);
  });

  test('invert puts the danger zone at the low end', async ({ page }) => {
    await mount(page, `<tr-meter id="b" label="Battery" segments="5" value="0.15" invert peak></tr-meter>`);
    await expect(page.getByRole('meter', { name: 'Battery' })).toBeVisible();
    // first segment is lit, in the first zone, which invert colors red
    const zone = await page.locator('#b').evaluate((el) => (el.shadowRoot!.querySelector('.peak') as HTMLElement).dataset.zone);
    expect(zone).toBe('lo');
    const lo = await page.locator('#b').evaluate((el) => getComputedStyle(el).getPropertyValue('--_lo'));
    expect(lo).toContain('27');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-meter label="Left" value="0.6"></tr-meter><tr-meter mode="spectrum" label="Spectrum" values="0.2,0.4,0.6"></tr-meter>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: bar, vertical, spectrum, invert', async ({ page }) => {
    await mount(
      page,
      `<div style="display:flex;gap:20px;align-items:center;padding:8px">
        <div style="display:grid;gap:8px"><tr-meter label="L" value="0.62"></tr-meter><tr-meter label="R" value="0.95" segments="24"></tr-meter>
        <tr-meter label="Battery" value="0.15" segments="5" invert style="width:5em"></tr-meter></div>
        <tr-meter label="V" value="0.8" orientation="vertical"></tr-meter>
        <tr-meter mode="spectrum" bands="12" segments="10" label="Spectrum" values="0.2,0.4,0.6,0.8,0.95,1,0.85,0.7,0.5,0.4,0.3,0.1"></tr-meter>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('meter-matrix.png');
  });
});
