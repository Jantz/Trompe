import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const fruit = (attrs = '') => `<form id="f"><tr-select id="s" label="Fruit" name="fruit" ${attrs}>
  <tr-option value="apple">Apple</tr-option><tr-option value="banana">Banana</tr-option><tr-option value="cherry" disabled>Cherry</tr-option>
  <tr-option value="date">Date</tr-option><tr-option value="blueberry">Blueberry</tr-option>
</tr-select></form><button id="after">after</button>`;

test.describe('tr-select / tr-option', () => {
  test('is a collapsed combobox with a name, and opens a listbox of options', async ({ page }) => {
    await mount(page, fruit());
    const cb = page.getByRole('combobox', { name: 'Fruit' });
    await expect(cb).toHaveAttribute('aria-expanded', 'false');
    await expect(cb).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(cb).toContainText('Apple');
    await expect(page.getByRole('listbox')).toBeHidden();
    await cb.click();
    await expect(cb).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(5);
    await expect(page.getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Cherry' })).toHaveAttribute('aria-disabled', 'true');
    await expect(cb).toHaveAttribute('aria-activedescendant', (await page.getByRole('option', { name: 'Apple' }).getAttribute('id'))!);
  });

  test('keyboard: arrows move (skipping disabled), Enter chooses, Escape cancels', async ({ page }) => {
    await mount(page, fruit());
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const s = document.getElementById('s')!;
      for (const t of ['input', 'change', 'open', 'close']) s.addEventListener(t, () => w.events.push(t));
    });
    const cb = page.getByRole('combobox', { name: 'Fruit' });
    await cb.focus();
    await page.keyboard.press('ArrowDown');
    await expect(cb).toHaveAttribute('aria-expanded', 'true');
    const active = async () => page.locator(`#${await cb.getAttribute('aria-activedescendant')}`).textContent();
    expect(await active()).toBe('Apple');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('Date');
    await page.keyboard.press('Enter');
    await expect(cb).toHaveAttribute('aria-expanded', 'false');
    await expect(cb).not.toHaveAttribute('aria-activedescendant');
    expect(await page.locator('#s').evaluate((e: any) => e.value)).toBe('date');
    await page.keyboard.press('Home');
    expect(await active()).toBe('Apple');
    await page.keyboard.press('End');
    expect(await active()).toBe('Blueberry');
    await page.keyboard.press('Escape');
    expect(await page.locator('#s').evaluate((e: any) => e.value)).toBe('date');
    await expect(cb).toBeFocused();
    expect(await page.evaluate(() => (window as any).events)).toEqual(['open', 'input', 'change', 'close', 'open', 'close']);
  });

  test('typeahead opens and jumps to matching options', async ({ page }) => {
    await mount(page, fruit());
    const cb = page.getByRole('combobox', { name: 'Fruit' });
    await cb.focus();
    const active = async () => page.locator(`#${await cb.getAttribute('aria-activedescendant')}`).textContent();
    await page.keyboard.press('b');
    await expect(cb).toHaveAttribute('aria-expanded', 'true');
    expect(await active()).toBe('Banana');
    await page.keyboard.press('b');
    expect(await active()).toBe('Blueberry');
    await page.waitForTimeout(600);
    await page.keyboard.type('da');
    expect(await active()).toBe('Date');
    await page.waitForTimeout(600);
    await page.keyboard.press(' ');
    expect(await page.locator('#s').evaluate((e: any) => e.value)).toBe('date');
  });

  test('pointer: click option chooses; click outside closes; disabled option ignored', async ({ page }) => {
    await mount(page, fruit());
    const cb = page.getByRole('combobox', { name: 'Fruit' });
    await cb.click();
    await page.getByRole('option', { name: 'Cherry' }).click({ force: true });
    await expect(cb).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('option', { name: 'Banana' }).click();
    await expect(cb).toHaveAttribute('aria-expanded', 'false');
    await expect(cb).toContainText('Banana');
    await cb.click();
    await page.mouse.click(5, 400);
    await expect(cb).toHaveAttribute('aria-expanded', 'false');
    await cb.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(cb).toHaveAttribute('aria-expanded', 'false');
    expect(await page.locator('#s').evaluate((e: any) => e.value)).toBe('date');
  });

  test('placeholder, required validity, submit and reset', async ({ page }) => {
    await mount(page, fruit('placeholder="Pick one" required'));
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    const cb = page.getByRole('combobox', { name: 'Fruit' });
    await expect(cb).toContainText('Pick one');
    expect(await read()).toBe('');
    expect(await valid()).toBe(false);
    await cb.click();
    await page.getByRole('option', { name: 'Date' }).click();
    expect(await read()).toBe('fruit=date');
    expect(await valid()).toBe(true);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('');
    await expect(cb).toContainText('Pick one');
  });

  test('disabled select does not open and is not focusable', async ({ page }) => {
    await mount(page, fruit('disabled'));
    await page.locator('#s').click({ force: true });
    await expect(page.locator('#s')).toHaveAttribute('aria-expanded', 'false');
    expect(await page.locator('#s').getAttribute('tabindex')).toBeNull();
  });

  test('has no axe violations, closed and open', async ({ page }) => {
    await mount(page, `${fruit()}<tr-select aria-label="Sort" value="b" material="metal"><tr-option value="a">A</tr-option><tr-option value="b">B</tr-option></tr-select>`);
    let results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('combobox', { name: 'Fruit' }).click();
    results = await new AxeBuilder({ page }).include('#root').analyze();
    // aria-controls cannot point into shadow DOM; the listbox is the combobox's own descendant instead.
    expect(results.violations.filter((v) => v.id !== 'aria-required-attr')).toEqual([]);
  });

  test('visual: closed in themes, and open', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:12px;align-items:flex-end;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-select label="Country" placeholder="Choose…"><tr-option>Japan</tr-option></tr-select>
      <tr-select label="Sort" material="metal"><tr-option>Top rated</tr-option></tr-select>
      <tr-select aria-label="Flat" realism="flat" size="sm"><tr-option>Flat</tr-option></tr-select></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div><div style="height:220px;padding:12px">${fruit('value="banana"')}</div>`);
    await page.getByRole('combobox', { name: 'Fruit' }).click();
    await page.getByRole('option', { name: 'Date' }).hover();
    await expect(page).toHaveScreenshot('select-matrix.png', { fullPage: true });
  });

  test('form reset restores the original state after the control is moved', async ({ page }) => {
    await mount(page, `<form id="f"><div id="a"><tr-select id="x" name="s" label="S"><tr-option>x</tr-option><tr-option>y</tr-option></tr-select></div><div id="b"></div></form>`);
    await page.evaluate(() => ((document.getElementById('x') as any).value = 'y'));
    const after = await page.evaluate(async () => {
      const el = document.getElementById('x') as any;
      document.getElementById('b')!.append(el);
      (document.getElementById('f') as HTMLFormElement).reset();
      await el.updateComplete;
      return el.value;
    });
    expect(after).toBe('x');
  });

  test('a value property set before insertion wins over a selected option', async ({ page }) => {
    await mount(page, '');
    const value = await page.evaluate(async () => {
      const s = document.createElement('tr-select');
      s.innerHTML = '<tr-option value="a" selected>A</tr-option><tr-option value="b">B</tr-option>';
      s.value = 'b';
      document.getElementById('root')!.append(s);
      await s.updateComplete;
      return s.value;
    });
    expect(value).toBe('b');
  });
});
