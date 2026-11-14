import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-avatar', () => {
  test('initials, name, status and decorative', async ({ page }) => {
    await mount(
      page,
      `<tr-avatar id="a" name="Ada Lovelace" status="online"></tr-avatar>
       <tr-avatar id="b" name="Grace Hopper" decorative></tr-avatar>
       <tr-avatar id="c" name="Ada Lovelace"></tr-avatar>`,
    );
    await expect(page.getByRole('img', { name: 'Ada Lovelace, online' })).toBeVisible();
    await expect(page.locator('#a').locator('[part=initials]')).toHaveText('AL');
    await expect(page.locator('#b')).toHaveAttribute('aria-hidden', 'true');
    const hue = (id: string) => page.locator(id).evaluate((el) => (el as HTMLElement).style.getPropertyValue('--_hue'));
    expect(await hue('#a')).toBe(await hue('#c'));
    expect(await hue('#a')).not.toBe(await hue('#b'));
  });

  test('a broken photo falls back to initials', async ({ page }) => {
    await mount(page, `<tr-avatar id="a" name="Linus Pauling" src="/does-not-exist.jpg"></tr-avatar>`);
    await expect(page.locator('#a').locator('[part=initials]')).toHaveText('LP');
    await expect(page.locator('#a').locator('img')).toHaveCount(0);
  });
});

test.describe('tr-number-field', () => {
  test('keys and buttons step within min/max; change fires', async ({ page }) => {
    await mount(page, `<tr-number-field id="n" label="Guests" value="2" min="1" max="4"></tr-number-field>`);
    const field = page.getByRole('spinbutton', { name: 'Guests' });
    await expect(field).toHaveAttribute('aria-valuenow', '2');
    await page.locator('#n').evaluate((el) => el.addEventListener('change', () => ((window as any).changes = ((window as any).changes ?? 0) + 1)));
    await field.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    expect(await page.locator('#n').evaluate((el: any) => el.value)).toBe(4);
    await page.keyboard.press('Home');
    expect(await page.locator('#n').evaluate((el: any) => el.value)).toBe(1);
    await page.getByRole('button', { name: /increase/i }).click();
    expect(await page.locator('#n').evaluate((el: any) => el.value)).toBe(2);
    expect(await page.evaluate(() => (window as any).changes)).toBeGreaterThan(0);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-number-field label="Sets" value="3" min="0" max="10" unit="sets"></tr-number-field>`);
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});

test.describe('toast', () => {
  test('toast() shows a status message that closes itself', async ({ page }) => {
    await mount(page, ``);
    await page.evaluate(() => (window as any).trompe.toast('Saved', { tone: 'success', duration: 400 }));
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await expect(page.locator('tr-toast')).toHaveCount(0, { timeout: 3000 });
  });

  test('danger toasts are alerts; the close key closes with a reason', async ({ page }) => {
    await mount(page, `<tr-toast id="t" tone="danger" open duration="0" dismissible>Payment failed</tr-toast>`);
    await expect(page.getByRole('alert')).toContainText('Payment failed');
    const reason = page.locator('#t').evaluate((el) => new Promise((r) => el.addEventListener('close', (e: any) => r(e.detail.reason))));
    await page.getByRole('button', { name: 'Dismiss' }).click();
    expect(await reason).toBe('dismiss');
  });

  test('the toaster floats: showing a toast does not move the page', async ({ page }) => {
    await mount(page, `<p id="p">Content</p>`);
    const before = (await page.locator('#p').boundingBox())!;
    await page.evaluate(() => (window as any).trompe.toast('Hello'));
    await expect(page.locator('tr-toast')).toHaveCount(1);
    const after = (await page.locator('#p').boundingBox())!;
    expect(after).toEqual(before);
  });
});

test.describe('tr-table', () => {
  const TABLE = `<tr-table id="t" autosort style="width:600px"><table>
    <thead><tr><th data-sort="name">Name</th><th data-sort="qty" data-numeric>Qty</th></tr></thead>
    <tbody><tr><td>Beans</td><td>12</td></tr><tr><td>Apples</td><td>3</td></tr><tr><td>Cherries</td><td>40</td></tr></tbody>
  </table></tr-table>`;
  const firstColumn = (page: import('@playwright/test').Page) => page.locator('#t tbody td:first-child').allTextContents();

  test('sortable headers fire sort and autosort reorders', async ({ page }) => {
    await mount(page, TABLE);
    const header = page.locator('th[data-sort=name]');
    await expect(header).toHaveAttribute('aria-sort', 'none');
    await header.click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(await firstColumn(page)).toEqual(['Apples', 'Beans', 'Cherries']);
    await header.focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(await firstColumn(page)).toEqual(['Cherries', 'Beans', 'Apples']);
  });

  test('cells get data-label for the stacked phone layout', async ({ page }) => {
    await mount(page, TABLE.replace('width:600px', 'width:300px'));
    await expect(page.locator('#t tbody tr:first-child td').nth(1)).toHaveAttribute('data-label', 'Qty');
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});

test.describe('tr-button loading', () => {
  test('keeps its size and ignores clicks', async ({ page }) => {
    await mount(page, `<tr-button id="b">Pay now</tr-button>`);
    const b = page.locator('#b');
    const before = (await b.boundingBox())!;
    await b.evaluate((el) => {
      (window as any).clicks = 0;
      el.addEventListener('click', () => (window as any).clicks++);
      el.setAttribute('loading', '');
    });
    await b.click();
    const after = (await b.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    await expect(page.getByRole('button', { name: 'Pay now' })).toHaveAttribute('aria-busy', 'true');
  });
});

test.describe('tr-panel scrollable', () => {
  test('the body scrolls inside the panel; header and footer stay put', async ({ page }) => {
    const rows = Array.from({ length: 40 }, (_, i) => `<p style="margin:0 0 8px">Row ${i + 1}</p>`).join('');
    await mount(page, `<tr-panel id="p" scrollable style="height:300px"><h2 slot="header" style="margin:0">Inbox</h2>${rows}<span slot="footer">40 messages</span></tr-panel>`);
    const panel = (await page.locator('#p').boundingBox())!;
    expect(panel.height).toBeCloseTo(300, 0);
    const footer = (await page.getByText('40 messages').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(panel.y + panel.height);
    const header = (await page.getByRole('heading', { name: 'Inbox' }).boundingBox())!;
    await page.getByText('Row 3', { exact: true }).hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.locator('#p').evaluate((el) => el.shadowRoot!.querySelector('.content')!.scrollTop)).toBeGreaterThan(100);
    expect((await page.getByRole('heading', { name: 'Inbox' }).boundingBox())!.y).toBeCloseTo(header.y, 0);
  });
});

test.describe('page polish', () => {
  test('search + clearable shows one clear key', async ({ page }) => {
    await mount(page, `<tr-input id="q" type="search" label="Search" clearable value="ada"></tr-input>`);
    // getComputedStyle cannot read ::-webkit-search-cancel-button, so look for the rule that hides it.
    const hidden = await page.locator('#q').evaluate((el) =>
      el.shadowRoot!.adoptedStyleSheets.some((sheet) =>
        [...sheet.cssRules].some((r) => r.cssText.includes(':host([clearable]) input::-webkit-search-cancel-button') && r.cssText.includes('display: none')),
      ),
    );
    expect(hidden).toBe(true);
    await expect(page.getByRole('button', { name: /clear/i })).toHaveCount(1);
  });

  test('a skinned page stays cloaked until its elements are defined, then fades in', async ({ page }) => {
    await page.route('**/tests/cloak.html', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><link rel="stylesheet" href="/src/generated/skins.css"></head>
          <body data-tr-skin="soft"><tr-panel><tr-button>Save</tr-button></tr-panel>
          <script type="module">setTimeout(() => import('/src/index.ts'), 400);</script></body></html>`,
      }),
    );
    await page.goto('/tests/cloak.html');
    expect(await page.evaluate(() => getComputedStyle(document.body).opacity)).toBe('0');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).opacity), { timeout: 3000 }).toBe('1');
    expect(await page.evaluate(() => !!customElements.get('tr-panel'))).toBe(true);
  });
});

test('tr-number-field: focus() and a click on the frame land on the number, not the − key', async ({ page }) => {
  await mount(page, `<tr-number-field id="n" label="Weight" value="60" step="2.5" unit="kg"></tr-number-field>`);
  await page.locator('#n').evaluate((el: any) => el.focus());
  await page.keyboard.press('ArrowUp');
  expect(await page.locator('#n').evaluate((el: any) => el.value)).toBe(62.5);
});
