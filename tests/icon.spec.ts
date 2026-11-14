import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const filterOf = (page: import('@playwright/test').Page, sel: string) =>
  page.locator(sel).evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('svg')!).filter);

test.describe('tr-icon', () => {
  test('draws a built-in icon in a 1em box, decorative unless labelled', async ({ page }) => {
    await mount(page, `<p style="font-size:20px"><tr-icon id="a" name="search"></tr-icon> <tr-icon id="b" name="bell" label="Alerts"></tr-icon></p>`);
    const a = page.locator('#a');
    await expect(a.locator('svg path')).toHaveCount(1);
    await expect(a.locator('svg circle')).toHaveCount(1);
    const box = (await a.boundingBox())!;
    expect(box.width).toBeCloseTo(20, 0);
    expect(box.height).toBeCloseTo(20, 0);
    await expect(a).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('img', { name: 'Alerts' })).toBeVisible();
    const names = await page.evaluate(() => (window as any).trompe.iconNames());
    expect(names.length).toBeGreaterThanOrEqual(70);
    expect(names).toEqual(expect.arrayContaining(['home', 'settings', 'chevron-down', 'credit-card', 'trash']));
  });

  test('an unknown name draws nothing, keeps its box and warns once; registerIcons fills it in', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && m.text().includes('tr-icon') && warnings.push(m.text()));
    await mount(page, `<tr-icon id="a" name="espresso" size="lg"></tr-icon><tr-icon name="espresso"></tr-icon>`);
    const a = page.locator('#a');
    await expect(a.locator('svg')).toHaveCount(0);
    expect((await a.boundingBox())!.width).toBeCloseTo(24, 0);
    expect(warnings).toHaveLength(1);
    await page.evaluate(() => (window as any).trompe.registerIcons({ espresso: '<path d="M5 8h11v6a5 5 0 0 1-10 0z"/>' }));
    await expect(a.locator('svg path')).toHaveCount(1);
  });

  test('variants change the paint: engraved and embossed follow the light, lit glows', async ({ page }) => {
    await mount(page, `<div data-tr-realism="real">
      <tr-icon id="p" name="lock"></tr-icon><tr-icon id="e" name="lock" variant="engraved"></tr-icon>
      <tr-icon id="m" name="lock" variant="embossed"></tr-icon><tr-icon id="l" name="lock" variant="lit"></tr-icon></div>`);
    const printed = await filterOf(page, '#p');
    const engraved = await filterOf(page, '#e');
    const embossed = await filterOf(page, '#m');
    const lit = await filterOf(page, '#l');
    expect(new Set([printed, engraved, embossed, lit]).size).toBe(4);
    // the default light comes from the top left, so the engraved lip falls to the bottom right
    const firstOffset = (f: string) => f.match(/drop-shadow\([^)]*?\)?\s*(-?[\d.]+)px (-?[\d.]+)px/)!.slice(1).map(Number);
    const [ex, ey] = firstOffset(engraved);
    const [mx, my] = firstOffset(embossed);
    expect(ex).toBeGreaterThan(0);
    expect(ey).toBeGreaterThan(0);
    expect(mx).toBeLessThan(0);
    expect(my).toBeLessThan(0);
    // turning the light round flips the relief
    await page.locator('#e').evaluate((el) => (el.parentElement as HTMLElement).style.setProperty('--tr-light-angle', '150deg'));
    await expect.poll(async () => firstOffset(await filterOf(page, '#e')).map(Math.sign)).toEqual([-1, -1]);
  });

  test('changing the name cross-fades in place without moving anything', async ({ page }) => {
    await mount(page, `<tr-button id="b"><tr-icon id="i" slot="start" name="play"></tr-icon>Start</tr-button>`);
    const before = (await page.locator('#b').boundingBox())!;
    await page.locator('#i').evaluate((el: any) => (el.name = 'pause'));
    await expect(page.locator('#i svg')).toHaveCount(2);
    expect(await page.locator('#b').boundingBox()).toEqual(before);
    await expect(page.locator('#i svg')).toHaveCount(1, { timeout: 2000 });
    await expect(page.locator('#i svg path')).toHaveAttribute('d', 'M8.5 5v14M15.5 5v14');
  });

  test('icon-only buttons and labelled icons have no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-button shape="circle" aria-label="Settings"><tr-icon name="settings"></tr-icon></tr-button>
       <tr-button><tr-icon name="close" label="Close"></tr-icon></tr-button>
       <tr-button><tr-icon slot="start" name="download"></tr-icon>Export</tr-button>
       <tr-input label="Search"><tr-icon slot="start" name="search"></tr-icon></tr-input>
       <tr-icon name="bolt" variant="lit" tone="warning" label="Charging"></tr-icon>`,
    );
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});
