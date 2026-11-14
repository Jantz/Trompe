import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-display', () => {
  test('has no role by default and reads its text', async ({ page }) => {
    await mount(page, `<tr-display id="d" type="vfd">128 KBPS</tr-display><tr-display id="g" value="12:45" digits="4"></tr-display>`);
    await expect(page.locator('#d')).not.toHaveAttribute('role', /.+/);
    await expect(page.locator('#d')).toHaveText('128 KBPS');
    // glyph renderings carry a hidden text copy; the svg is hidden
    const sr = await page.locator('#g').evaluate((el) => el.shadowRoot!.querySelector('.sr')!.textContent);
    expect(sr).toBe('12:45');
    expect(await page.locator('#g').evaluate((el) => el.shadowRoot!.querySelector('svg')!.getAttribute('aria-hidden'))).toBe('true');
  });

  test('live sets a polite live region', async ({ page }) => {
    await mount(page, `<tr-display id="d" live value="A"></tr-display>`);
    await expect(page.locator('#d')).toHaveAttribute('aria-live', 'polite');
    await page.evaluate(() => ((document.getElementById('d') as any).live = false));
    await expect(page.locator('#d')).not.toHaveAttribute('aria-live', /.*/);
  });

  test('picks glyphs from digits, value and type', async ({ page }) => {
    await mount(
      page,
      `<tr-display id="a" value="12.5" digits="4"></tr-display><tr-display id="b" value="HELLO" digits="6"></tr-display>
       <tr-display id="c" type="led" value="ON AIR"></tr-display><tr-display id="d" value="Text"></tr-display>`,
    );
    const g = (id: string) => page.locator('#' + id).evaluate((el: any) => el.effectiveGlyphs);
    expect(await g('a')).toBe('7seg');
    expect(await g('b')).toBe('14seg');
    expect(await g('c')).toBe('matrix');
    expect(await g('d')).toBe('text');
  });

  test('marquee scrolls overflowing text, and not under reduced motion', async ({ page }) => {
    await mount(page, `<tr-display id="m" marquee style="width:8em" value="A very long line of text that does not fit"></tr-display>`);
    const mode = () => page.locator('#m').evaluate((el) => el.shadowRoot!.querySelector('.readout .track')!.getAttribute('data-scroll'));
    await expect.poll(mode).toBe('loop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(page, `<tr-display id="m" marquee style="width:8em" value="A very long line of text that does not fit"></tr-display>`);
    await page.waitForTimeout(100);
    expect(await mode()).toBeNull();
  });

  test('nested meter lights in the display ink', async ({ page }) => {
    await mount(page, `<tr-display type="lcd"><tr-meter id="m" mode="spectrum" label="Spectrum" values="0.5,1"></tr-meter></tr-display>`);
    await expect(page.locator('#m')).toHaveAttribute('data-embedded', '');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-display value="12:45" digits="4"></tr-display><tr-display type="vfd" live><span slot="top">Stereo</span>Track 7</tr-display>
       <tr-display type="led" value="ON AIR"></tr-display><tr-display type="oled" value="Hello"></tr-display>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: types and glyphs', async ({ page }) => {
    await mount(
      page,
      `<div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px;max-width:900px">
        <tr-display type="lcd" value="12:45" digits="4"></tr-display>
        <tr-display type="lcd" inverse color="blue" value="TRACK 07" glyphs="14seg"></tr-display>
        <tr-display type="vfd" value="AURORA 128K" glyphs="14seg"></tr-display>
        <tr-display type="led" value="ON AIR"></tr-display>
        <tr-display type="oled" value="Hello"></tr-display>
        <tr-display type="lcd" glyphs="matrix" color="amber" value="Matrix 0123"></tr-display>
        <tr-display type="vfd" style="width:14em"><span slot="top">Stereo</span><span slot="top" data-off>Mono</span>Kind of Blue<span slot="bottom">128 kbps</span></tr-display>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('display-matrix.png');
  });
});
