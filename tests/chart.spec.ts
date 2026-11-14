import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const TABLE = `<table><thead><tr><th>Day</th><th>Steps</th><th>Goal</th></tr></thead><tbody>
  <tr><td>Mon</td><td>8,200</td><td>10,000</td></tr><tr><td>Tue</td><td>10,400</td><td>10,000</td></tr><tr><td>Wed</td><td>6,900</td><td>10,000</td></tr>
</tbody></table>`;

const settle = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('tr-chart')].every((c) => c.shadowRoot!.getAnimations().length === 0));

const marks = (page: Page, sel: string, cls: string) => page.locator(sel).evaluate((el, cls) => el.shadowRoot!.querySelectorAll(`[data-k].${cls}`).length, cls);

test.describe('tr-chart', () => {
  test('reads a slotted table: bars per cell, legend, accessible name and table', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="bar" label="Steps" style="width:600px">${TABLE}</tr-chart>`);
    await expect.poll(() => marks(page, '#c', 'bar')).toBe(6);
    await expect(page.locator('#c').locator('[part=legend] li')).toHaveText(['Steps', 'Goal']);
    const img = page.getByRole('img', {
      name: /^Steps\. Bar chart, 3 points from Mon to Wed\./,
    });
    await expect(img).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(1);
    await expect(page.getByRole('cell', { name: '10,400' })).toHaveCount(1);
  });

  test('line, area and sparkline draw from data and values', async ({ page }) => {
    await mount(
      page,
      `<tr-chart id="l" type="line" label="Money" x="m" series="a:Income,b:Spending" currency="USD" style="width:600px"></tr-chart>
       <tr-chart id="a" type="area" label="Balance" style="width:600px"></tr-chart>
       <tr-chart id="s" type="sparkline" label="Heart rate" values="62,64,61,70"></tr-chart>`,
    );
    await page.evaluate(() => {
      (document.querySelector('#l') as any).data = [
        { m: 'Jan', a: 4200, b: 3100 },
        { m: 'Feb', a: 5100, b: 2900 },
        { m: 'Mar', a: 4800, b: 3500 },
      ];
      (document.querySelector('#a') as any).data = [
        { x: 'Q1', y: 10 },
        { x: 'Q2', y: 14 },
      ];
    });
    await expect.poll(() => marks(page, '#l', 'line')).toBe(2);
    expect(await marks(page, '#a', 'area')).toBe(1);
    expect(await marks(page, '#s', 'line')).toBe(1);
    await expect(
      page.getByRole('img', {
        name: /Heart rate\. Trend, 4 points.*latest 70/,
      }),
    ).toBeVisible();
    // money: whole amounts, axis ticks without cents
    await expect(page.locator('#l').locator('text.ylabel').first()).toHaveText(/^\$\d/);
    expect(await page.locator('#l text.ylabel').allTextContents()).not.toContain(expect.stringContaining('.00'));
    const box = (await page.locator('#s').boundingBox())!;
    expect(box.height).toBeLessThan(40);
  });

  test('stacked bars: one rounded end per column, the axis covers the sums', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="bar" stacked label="Hours" style="width:500px"></tr-chart>`);
    await page.evaluate(() => {
      (document.querySelector('#c') as any).data = [
        { x: 'W1', design: 8, build: 14 },
        { x: 'W2', design: 11, build: 19 },
      ];
    });
    await expect.poll(() => marks(page, '#c', 'bar')).toBe(4);
    const labels = await page.locator('#c text.ylabel').allTextContents();
    expect(Number(labels[labels.length - 1])).toBeGreaterThanOrEqual(30);
  });

  test('keeps its box: empty, loading and when data arrives (no layout shift)', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="line" label="Sales" loading style="width:500px"></tr-chart><p id="after">After</p>`);
    const before = (await page.locator('#c').boundingBox())!;
    expect(before.height).toBeGreaterThan(200);
    await expect(page.locator('#c').locator('.empty')).toHaveText('Loading…');
    const after0 = (await page.locator('#after').boundingBox())!;
    await page.evaluate(() => {
      const c = document.querySelector('#c') as any;
      c.data = [
        { x: 'a', y: 1 },
        { x: 'b', y: 3 },
      ];
      c.loading = false;
    });
    await expect.poll(() => marks(page, '#c', 'line')).toBe(1);
    expect(await page.locator('#c').boundingBox()).toEqual(before);
    expect(await page.locator('#after').boundingBox()).toEqual(after0);
  });

  test('follows its container width and thins x labels when narrow', async ({ page }) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    await mount(page, `<div id="box" style="width:800px"><tr-chart id="c" label="Visits"></tr-chart></div>`);
    await page.evaluate(
      (months) =>
        ((document.querySelector('#c') as any).data = months.map((m, i) => ({
          x: m,
          y: 100 + i * 10,
        }))),
      months,
    );
    await expect.poll(() => page.locator('#c text.xlabel').count()).toBe(12);
    await page.locator('#box').evaluate((el) => (el.style.width = '300px'));
    await expect.poll(() => page.locator('#c text.xlabel').count()).toBeLessThan(8);
    expect((await page.locator('#c').boundingBox())!.width).toBeCloseTo(300, 0);
    await page.setViewportSize({ width: 320, height: 600 });
    await page.locator('#box').evaluate((el) => (el.style.width = 'auto'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test('keyboard: arrows move the readout and announce the values', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="line" label="Money" currency="USD" style="width:600px"></tr-chart>`);
    await page.evaluate(() => {
      (document.querySelector('#c') as any).data = [
        { x: 'Jan', income: 4200, spend: 3100 },
        { x: 'Feb', income: 5100, spend: 2900 },
      ];
    });
    await expect.poll(() => marks(page, '#c', 'line')).toBe(2);
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#c').locator('[part=readout]')).toHaveClass(/on/);
    await expect(page.locator('#c').locator('[part=readout] .x')).toHaveText('Feb');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#c').locator('[part=readout] .x')).toHaveText('Jan');
    await expect(page.getByRole('status')).toHaveText('Jan: income $4,200, spend $3,100');
    await page.keyboard.press('Escape');
    await expect(page.locator('#c').locator('[part=readout]')).not.toHaveClass(/on/);
  });

  test('hover shows a crosshair readout without moving anything', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="bar" label="Steps" style="width:600px">${TABLE}</tr-chart><p id="after">After</p>`);
    await settle(page);
    const before = (await page.locator('#after').boundingBox())!;
    const box = (await page.locator('#c').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await expect(page.locator('#c').locator('[part=readout] .x')).toHaveText('Tue');
    expect(await page.locator('#after').boundingBox()).toEqual(before);
  });

  test('a data change morphs the marks (animated, same elements)', async ({ page }) => {
    await mount(page, `<tr-chart id="c" type="line" label="Visits" style="width:600px"></tr-chart>`);
    // a web font arriving lays the chart out again without animation; let that happen first
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        ((document.querySelector('#c') as any).data = [
          { x: 'a', y: 1 },
          { x: 'b', y: 3 },
          { x: 'c', y: 2 },
        ]),
    );
    await settle(page);
    const path = page.locator('#c').locator('path.line');
    const d0 = await path.getAttribute('d');
    const count = await page.evaluate(() => {
      const c = document.querySelector('#c') as any;
      c.data = [
        { x: 'a', y: 2 },
        { x: 'b', y: 1 },
        { x: 'c', y: 3 },
      ];
      return c.updateComplete.then(() => c.shadowRoot.querySelector('path.line').getAnimations().length);
    });
    expect(count).toBe(1);
    expect(await path.getAttribute('d')).not.toBe(d0);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-chart type="bar" label="Steps" style="width:500px">${TABLE}</tr-chart>
       <tr-chart id="l" type="line" label="Visits" style="width:500px"></tr-chart>
       <tr-chart type="sparkline" label="Trend" values="1,3,2"></tr-chart>`,
    );
    await page.evaluate(
      () =>
        ((document.querySelector('#l') as any).data = [
          { x: 'a', y: 1 },
          { x: 'b', y: 3 },
        ]),
    );
    await settle(page);
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});
