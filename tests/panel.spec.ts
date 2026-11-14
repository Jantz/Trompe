import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-panel', () => {
  test('is presentational and renders its slots', async ({ page }) => {
    await mount(page, `<tr-panel id="p"><h2 slot="header">Mixer</h2><p>Body</p><small slot="footer">v1</small></tr-panel>`);
    const p = page.locator('#p');
    expect(await p.getAttribute('role')).toBeNull();
    await expect(page.getByRole('heading', { name: 'Mixer' })).toBeVisible();
    await expect(page.getByText('Body')).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();
  });

  test('hides empty header and footer strips', async ({ page }) => {
    await mount(page, `<tr-panel id="p">Only body</tr-panel>`);
    await expect(page.locator('#p .header')).toBeHidden();
    await expect(page.locator('#p .footer')).toBeHidden();
  });

  test('screws and bezel', async ({ page }) => {
    await mount(page, `<tr-panel id="a" screws>A</tr-panel><tr-panel id="b" bezel>B</tr-panel>`);
    await expect(page.locator('#a .screw')).toHaveCount(4);
    await expect(page.locator('#b .screw')).toHaveCount(0);
    await expect(page.locator('#b .well')).toBeVisible();
    await expect(page.locator('#a .well')).toHaveCount(0);
  });

  test('padding attribute and depth', async ({ page }) => {
    await mount(page, `<tr-panel id="n" padding="none">x</tr-panel><tr-panel id="l" padding="lg" depth="3">x</tr-panel>`);
    const pad = (id: string) => page.evaluate((id) => getComputedStyle(document.getElementById(id)!.shadowRoot!.querySelector('.chassis')!).paddingTop, id);
    expect(await pad('n')).toBe('0px');
    expect(parseFloat(await pad('l'))).toBeGreaterThan(20);
  });

  test('is a size container for its contents', async ({ page }) => {
    await mount(
      page,
      `<style>.probe{color:rgb(255,0,0)} @container tr-panel (min-width: 400px){.probe{color:rgb(0,0,255)}}</style>
       <div style="width:300px"><tr-panel><span class="probe" id="s">small</span></tr-panel></div>
       <div style="width:600px"><tr-panel><span class="probe" id="w">wide</span></tr-panel></div>`,
    );
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('s')!).color)).toBe('rgb(255, 0, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('w')!).color)).toBe('rgb(0, 0, 255)');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-panel screws material="metal"><span slot="header">Channel</span><tr-knob label="Gain"></tr-knob></tr-panel>
       <tr-panel bezel screws material="rubber"><tr-input label="Name"></tr-input></tr-panel>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: faceplates and bezels in both themes', async ({ page }) => {
    const block = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-panel screws material="metal"><span slot="header">CHANNEL 1</span>
        <div style="display:flex;gap:12px"><tr-knob label="Gain" value="60" size="sm" material="metal"></tr-knob><tr-switch checked>Phase</tr-switch></div>
        <span slot="footer">SN 0042</span></tr-panel>
      <tr-panel bezel screws material="rubber"><tr-input label="Preset" value="Warm pad"></tr-input></tr-panel>
      <tr-panel padding="sm">Plain card</tr-panel>
      <tr-panel bezel padding="sm" material="chrome" style="--tr-panel-screw-cross:1" screws>Chrome</tr-panel></div>`;
    await mount(page, `${block}<div data-tr-theme="dark">${block}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('panel-matrix.png');
  });
});
