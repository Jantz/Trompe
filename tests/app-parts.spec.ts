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

test('tr-select: hint and error show under the field, are read out and set validity', async ({ page }) => {
  await mount(page, `<form id="f"><tr-select id="s" name="payee" label="Payee" hint="Saved payees only."><tr-option value="a">Ada</tr-option></tr-select></form>`);
  const sel = page.locator('#s');
  await expect(sel.locator('[part=hint]')).toHaveText('Saved payees only.');
  await expect(sel).toHaveAttribute('aria-description', 'Saved payees only.');
  await sel.evaluate((el) => el.setAttribute('error', 'Choose who to pay.'));
  await expect(sel.locator('[part=error]')).toBeVisible();
  await expect(sel).toHaveAttribute('aria-invalid', 'true');
  expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
  await sel.evaluate((el) => el.removeAttribute('error'));
  await expect(sel).not.toHaveAttribute('aria-invalid', 'true');
  expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(true);
});

test('tr-table: stacked rows keep sorting through the Sort by keys', async ({ page }) => {
  await mount(
    page,
    `<tr-table id="t" autosort style="width:320px"><table>
      <thead><tr><th data-sort="name">Name</th><th data-sort="qty" data-numeric>Qty</th></tr></thead>
      <tbody><tr><td>Beans</td><td>12</td></tr><tr><td>Apples</td><td>3</td></tr><tr><td>Cherries</td><td>40</td></tr></tbody>
    </table></tr-table>`,
  );
  const key = page.getByRole('button', { name: 'Sort by Qty' });
  await expect(key).toBeVisible();
  await key.click();
  await expect(page.getByRole('button', { name: 'Sort by Qty, ascending' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#t tbody td:first-child').allTextContents()).toEqual(['Apples', 'Beans', 'Cherries']);
  // an app that sorts for itself sets aria-sort, and the keys follow
  await page.locator('th[data-sort=name]').evaluate((th) => th.setAttribute('aria-sort', 'descending'));
  await expect(page.getByRole('button', { name: 'Sort by Name, descending' })).toBeVisible();
  // wide tables keep the header and hide the keys
  await page.locator('#t').evaluate((el) => (el.style.width = '700px'));
  await expect(page.getByRole('group', { name: 'Sort by' })).toBeHidden();
  const r = await new AxeBuilder({ page }).include('#root').analyze();
  expect(r.violations).toEqual([]);
});

test('tr-progress: the ring cap takes your own centre content', async ({ page }) => {
  await mount(page, `<tr-progress id="p" variant="ring" size="lg" value="6240" max="8000" label="Steps"><span slot="center"><strong>6,240</strong><small>steps</small></span></tr-progress>`);
  const cap = (await page.locator('#p').locator('[part=cap]').boundingBox())!;
  const text = (await page.getByText('6,240').boundingBox())!;
  expect(text.x).toBeGreaterThan(cap.x);
  expect(text.x + text.width).toBeLessThan(cap.x + cap.width);
  expect(Math.abs(text.y + text.height / 2 - (cap.y + cap.height / 2))).toBeLessThan(cap.height * 0.3);
});

test('tr-dialog: label shows as the title when there is no heading, unless hide-label', async ({ page }) => {
  await mount(page, `<tr-dialog id="a" label="Add habit"><p>Body</p></tr-dialog><tr-dialog id="b" label="Quiet" hide-label><p>Body</p></tr-dialog>`);
  await page.locator('#a').evaluate((d: any) => d.show());
  await expect(page.locator('#a').locator('[part=title]')).toHaveText('Add habit');
  await expect(page.getByRole('dialog', { name: 'Add habit' })).toBeVisible();
  await page.locator('#a').evaluate((d: any) => d.close());
  await page.locator('#b').evaluate((d: any) => d.show());
  await expect(page.locator('#b').locator('[part=title]')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Quiet' })).toBeVisible();
});

test('tr-input type="time" takes a time of day and submits it', async ({ page }) => {
  await mount(page, `<form id="f"><tr-input id="t" type="time" name="reminder" label="Reminder" value="07:30"></tr-input></form>`);
  await expect(page.locator('#t').locator('input')).toHaveAttribute('type', 'time');
  expect(await page.locator('#f').evaluate((f: HTMLFormElement) => new FormData(f).get('reminder'))).toBe('07:30');
  const r = await new AxeBuilder({ page }).include('#root').analyze();
  expect(r.violations).toEqual([]);
});

test('tr-segmented: the chosen key lights its lamp', async ({ page }) => {
  await mount(page, `<tr-segmented label="Range" value="1w"><tr-option value="1d">1D</tr-option><tr-option id="w" value="1w">1W</tr-option></tr-segmented>`);
  const bg = await page.locator('#w').evaluate((el) => {
    const ind = el.shadowRoot!.querySelector('[part~=indicator]') as HTMLElement;
    return getComputedStyle(ind).backgroundColor;
  });
  expect(bg).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test('tr-number-field: error shows, is read out and blocks the form', async ({ page }) => {
  await mount(page, `<form id="f"><tr-number-field id="n" name="qty" label="Shares" value="0" hint="Whole shares only."></tr-number-field></form>`);
  const n = page.locator('#n');
  await n.evaluate((el) => el.setAttribute('error', 'Enter at least 1 share.'));
  await expect(n.locator('[part=error]')).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Shares' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('spinbutton', { name: 'Shares' })).toHaveAccessibleDescription(/Enter at least 1 share/);
  expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
  await n.evaluate((el) => el.removeAttribute('error'));
  expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(true);
});

test('tr-number-field does not take focus when the page loads', async ({ page }) => {
  await page.route('**/tests/nf-autofocus.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><body><tr-number-field label="Guests" value="2"></tr-number-field><script type="module">import '/src/index.ts';</script></body></html>` }),
  );
  await page.goto('/tests/nf-autofocus.html');
  await page.waitForFunction(() => !!customElements.get('tr-number-field'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
});

test('tr-number-field: a press on the frame puts the caret in the number', async ({ page }) => {
  await mount(page, `<tr-number-field id="n" label="Guests" value="2" style="width:16em"></tr-number-field>`);
  const field = (await page.locator('#n [part=field]').boundingBox())!;
  const input = (await page.locator('#n input').boundingBox())!;
  // a point on the frame, right of the number and left of the + key
  await page.mouse.click(input.x + input.width + 6, field.y + 3);
  expect(await page.locator('#n').evaluate((el) => el.shadowRoot!.activeElement?.tagName)).toBe('INPUT');
});

test('tr-segmented: keys keep their labels when they fit at their own widths', async ({ page }) => {
  await mount(page, `<div style="width:330px"><tr-segmented id="s" label="Priority" value="low">
    <tr-option value="low">Low</tr-option><tr-option value="medium">Medium</tr-option><tr-option value="high">High</tr-option><tr-option value="urgent">Urgent</tr-option>
  </tr-segmented></div>`);
  const cut = () => page.locator('#s tr-option').evaluateAll((els) => els.filter((el) => { const l = el.shadowRoot!.querySelector('.label') as HTMLElement; return l.scrollWidth > l.clientWidth + 0.5; }).length);
  await expect.poll(cut).toBe(0);
  expect((await page.locator('#s').boundingBox())!.width).toBeLessThanOrEqual(330.5);
  // wide: equal keys again
  await page.locator('#s').evaluate((el) => (el.parentElement!.style.width = '700px'));
  await expect(page.locator('#s')).not.toHaveAttribute('data-fit', 'content');
});

test('tr-dialog opens in view on a scrolled page and does not scroll it', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await mount(page, `<div style="height:3000px"></div><tr-dialog id="d" label="Missing"><p>Fill in the date.</p></tr-dialog><div style="height:3000px"></div>`);
  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.locator('#d').evaluate((d: any) => d.show());
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(2500);
  const box = (await page.locator('#d [part=dialog]').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(600);
  expect(await page.locator('#d [part=dialog]').evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
});
