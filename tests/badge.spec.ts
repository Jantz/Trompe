import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-badge', () => {
  test('is presentational text with defaults', async ({ page }) => {
    await mount(page, `<tr-badge id="b">Draft</tr-badge>`);
    const b = page.locator('#b');
    await expect(b).toHaveText('Draft');
    expect(await b.getAttribute('role')).toBeNull();
    await expect(b).toHaveAttribute('tone', 'neutral');
    await expect(b).toHaveAttribute('variant', 'enamel');
    expect(await b.evaluate((el) => (el as HTMLElement).tabIndex)).toBe(-1);
  });

  test('dot shows the LED and label names a lone dot', async ({ page }) => {
    await mount(page, `<tr-badge id="b" dot tone="success" label="Online"></tr-badge><tr-badge id="c">Plain</tr-badge>`);
    expect(await page.locator('#b').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.dot')!).display)).not.toBe('none');
    expect(await page.locator('#c').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.dot')!).display)).toBe('none');
    await expect(page.getByText('Online')).toHaveCount(1);
  });

  test('success and warning resolve to distinct colors', async ({ page }) => {
    await mount(page, `<tr-badge tone="success" id="s">Ok</tr-badge><tr-badge tone="warning" id="w">Wait</tr-badge><tr-badge tone="danger" id="d">No</tr-badge>`);
    const bg = (id: string) => page.locator(id).evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.badge')!).backgroundColor);
    const [s, w, d] = [await bg('#s'), await bg('#w'), await bg('#d')];
    expect(new Set([s, w, d]).size).toBe(3);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<p>Status <tr-badge tone="success" dot>Online</tr-badge> <tr-badge tone="warning">Pending</tr-badge> <tr-badge tone="danger">Failed</tr-badge> <tr-badge tone="accent">12</tr-badge>
       <tr-badge variant="plate">v2.4</tr-badge> <tr-badge variant="well" tone="success">Live</tr-badge> <tr-badge variant="well">Archived</tr-badge></p>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in dark theme', async ({ page }) => {
    await mount(page, `<p><tr-badge tone="success" dot>Online</tr-badge> <tr-badge tone="warning">Pending</tr-badge> <tr-badge tone="danger">Failed</tr-badge> <tr-badge variant="well" tone="accent">Beta</tr-badge> <tr-badge variant="plate" tone="danger">Recall</tr-badge></p>`, { theme: 'dark' });
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: tones and variants', async ({ page }) => {
    await mount(
      page,
      `<div style="display:grid;gap:10px;padding:4px">
        <div style="display:flex;gap:8px"><tr-badge>Draft</tr-badge><tr-badge tone="accent">12</tr-badge><tr-badge tone="success" dot>Online</tr-badge><tr-badge tone="warning">Pending</tr-badge><tr-badge tone="danger" dot>Failed</tr-badge></div>
        <div style="display:flex;gap:8px"><tr-badge variant="plate">v2.4</tr-badge><tr-badge variant="plate" tone="success">Pass</tr-badge><tr-badge variant="plate" tone="danger" material="metal">Recall</tr-badge></div>
        <div style="display:flex;gap:8px"><tr-badge variant="well" tone="accent">Beta</tr-badge><tr-badge variant="well" tone="success" dot>Live</tr-badge><tr-badge variant="well">Archived</tr-badge><tr-badge size="md" tone="accent" realism="real">Large</tr-badge></div>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('badge-matrix.png');
  });
});
