import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

/** The date of the day cell that has focus inside a calendar (also one inside a date picker). */
const focusedDate = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return (a as HTMLElement | null)?.dataset?.date ?? (a as HTMLElement | null)?.dataset?.month ?? null;
  });

const day = (page: Page, sel: string, iso: string) => page.locator(`${sel} .live [data-date="${iso}"]`);

test.describe('tr-calendar', () => {
  test('arrows, Home/End and PageUp/PageDown move the cursor; Enter chooses', async ({ page }) => {
    await mount(page, `<tr-calendar id="c" value="2026-11-14" first-day-of-week="1" locale="en-GB" label="Delivery"></tr-calendar>`);
    const c = page.locator('#c');
    await c.evaluate((el: HTMLElement) => el.focus());
    expect(await focusedDate(page)).toBe('2026-11-14');
    const steps: Array<[string, string]> = [
      ['ArrowRight', '2026-11-15'],
      ['ArrowDown', '2026-11-22'],
      ['Home', '2026-11-16'],
      ['End', '2026-11-22'],
      ['ArrowLeft', '2026-11-21'],
      ['ArrowUp', '2026-11-14'],
      ['PageDown', '2026-12-14'],
      ['Shift+PageDown', '2027-12-14'],
      ['Shift+PageUp', '2026-12-14'],
      ['PageUp', '2026-11-14'],
    ];
    for (const [key, date] of steps) {
      await page.keyboard.press(key);
      expect(await focusedDate(page), key).toBe(date);
    }
    await page.keyboard.press('PageDown');
    await expect(c.locator('[part=title]')).toContainText('December 2026');
    await c.evaluate((el) => el.addEventListener('change', () => ((window as any).changed = (el as any).value)));
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).changed)).toBe('2026-12-14');
    await expect(day(page, '#c', '2026-12-14')).toHaveAttribute('aria-selected', 'true');
    // one roving tab stop
    expect(await c.locator('.live [tabindex="0"]').count()).toBe(1);
  });

  test('range: two clicks choose a start and an end; the days between are selected', async ({ page }) => {
    await mount(page, `<tr-calendar id="c" range month="2026-11" locale="en-GB"></tr-calendar>`);
    const c = page.locator('#c');
    await c.evaluate((el) => {
      (window as any).events = [];
      el.addEventListener('input', () => (window as any).events.push(['input', (el as any).value]));
      el.addEventListener('change', () => (window as any).events.push(['change', (el as any).value]));
    });
    await day(page, '#c', '2026-11-09').click();
    await day(page, '#c', '2026-11-03').click();
    expect(await c.evaluate((el: any) => el.value)).toBe('2026-11-03/2026-11-09');
    expect(await c.evaluate((el: any) => [el.start, el.end])).toEqual(['2026-11-03', '2026-11-09']);
    expect(await page.evaluate(() => (window as any).events)).toEqual([
      ['input', '2026-11-09'],
      ['input', '2026-11-03/2026-11-09'],
      ['change', '2026-11-03/2026-11-09'],
    ]);
    await expect(day(page, '#c', '2026-11-05')).toHaveAttribute('aria-selected', 'true');
    await expect(day(page, '#c', '2026-11-05')).toHaveClass(/in-range/);
    await expect(day(page, '#c', '2026-11-10')).toHaveAttribute('aria-selected', 'false');
  });

  test('min, max and isDateDisabled block choosing; nav keys stop at the edge', async ({ page }) => {
    await mount(page, `<tr-calendar id="c" value="2026-11-12" min="2026-11-10" max="2026-12-20"></tr-calendar>`);
    const c = page.locator('#c');
    await c.evaluate((el: any) => (el.isDateDisabled = (d: Date) => d.getDay() === 0));
    await expect(day(page, '#c', '2026-11-05')).toHaveAttribute('aria-disabled', 'true');
    await expect(day(page, '#c', '2026-11-15')).toHaveAttribute('aria-disabled', 'true'); // a Sunday
    await day(page, '#c', '2026-11-05').click({ force: true });
    await day(page, '#c', '2026-11-15').click({ force: true });
    expect(await c.evaluate((el: any) => el.value)).toBe('2026-11-12');
    await expect(c.locator('[part=previous]')).toBeDisabled();
    await c.evaluate((el: HTMLElement) => el.focus());
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowLeft');
    expect(await focusedDate(page)).toBe('2026-11-10');
    await c.locator('[part=next]').click();
    await expect(c.locator('[part=next]')).toBeDisabled();
  });

  test('changing months never changes its height', async ({ page }) => {
    // February 2026 fits in four weeks, August 2026 needs six.
    await mount(page, `<tr-calendar id="c" month="2026-01" first-day-of-week="0"></tr-calendar>`);
    const c = page.locator('#c');
    const h0 = (await c.boundingBox())!.height;
    for (let i = 0; i < 7; i++) {
      await c.locator('[part=next]').click();
      expect((await c.boundingBox())!.height).toBe(h0);
    }
    await expect(c.locator('[part=title]')).toContainText('August 2026');
  });

  test('the title opens a month grid, then a year grid', async ({ page }) => {
    await mount(page, `<tr-calendar id="c" value="2026-11-14" locale="en-GB"></tr-calendar>`);
    const c = page.locator('#c');
    const h0 = (await c.boundingBox())!.height;
    await c.locator('[part=title]').click();
    await expect(c.locator('.live [role=grid]')).toHaveAttribute('aria-label', '2026');
    expect((await c.boundingBox())!.height).toBe(h0);
    await c.locator('[part=title]').click();
    await c.locator('.live [data-year="2029"]').click();
    await c.locator('.live [data-month="2029-03"]').click();
    await expect(c.locator('[part=title]')).toContainText('March 2029');
    expect(await focusedDate(page)).toMatch(/^2029-03-/);
  });

  test('form value and required', async ({ page }) => {
    await mount(page, `<form id="f"><tr-calendar id="c" name="day" required month="2026-11"></tr-calendar></form>`);
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
    await day(page, '#c', '2026-11-20').click();
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => [f.checkValidity(), new FormData(f).get('day')])).toEqual([true, '2026-11-20']);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-calendar value="2026-11-14" label="Delivery"></tr-calendar><tr-calendar range week-numbers value="2026-11-03/2026-11-09" min="2026-11-02"></tr-calendar>`);
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});

test.describe('tr-date-picker', () => {
  test('the calendar key opens the calendar; a click chooses, closes and returns focus', async ({ page }) => {
    await mount(page, `<form id="f"><tr-date-picker id="d" label="Check-in" name="in" required locale="en-GB" value=""></tr-date-picker></form>`);
    const d = page.locator('#d');
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
    const key = page.getByRole('button', { name: 'Choose date' });
    await key.click();
    await expect(d).toHaveAttribute('open', '');
    await expect(page.getByRole('dialog', { name: /Check-in/ })).toBeVisible();
    await d.evaluate((el: any) => el.shadowRoot.querySelector('tr-calendar').goTo('2026-11-01'));
    await day(page, '#d', '2026-11-20').click();
    await expect(d).not.toHaveAttribute('open', '');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await d.evaluate((el: any) => el.value)).toBe('2026-11-20');
    await expect(d.locator('input')).toHaveValue('20 Nov 2026');
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => [f.checkValidity(), new FormData(f).get('in')])).toEqual([true, '2026-11-20']);
    // focus is back on the key that opened it
    expect(await d.evaluate((el) => el.shadowRoot!.activeElement?.getAttribute('part'))).toBe('button');
  });

  test('keyboard: Alt+Down opens with focus on the date, Escape closes back to the field', async ({ page }) => {
    await mount(page, `<tr-date-picker id="d" label="Due" value="2026-11-14" locale="en-GB"></tr-date-picker>`);
    const d = page.locator('#d');
    await d.locator('input').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(d).toHaveAttribute('open', '');
    await expect.poll(() => focusedDate(page)).toBe('2026-11-14');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(d).not.toHaveAttribute('open', '');
    expect(await d.evaluate((el: any) => el.value)).toBe('2026-11-14');
    expect(await d.evaluate((el) => el.shadowRoot!.activeElement?.id)).toBe('input');
    await page.keyboard.press('ArrowDown');
    await expect(d).toHaveAttribute('open', '');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(d).not.toHaveAttribute('open', '');
    expect(await d.evaluate((el: any) => el.value)).toBe('2026-11-15');
  });

  test('a click outside closes it', async ({ page }) => {
    await mount(page, `<tr-date-picker id="d" label="Due" value="2026-11-14"></tr-date-picker><p id="away" style="margin-top:400px">Away</p>`);
    await page.locator('#d [part=button]').click();
    await expect(page.locator('#d')).toHaveAttribute('open', '');
    await page.locator('#away').click();
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
  });

  test('typed dates are read in the locale; nonsense is a bad input', async ({ page }) => {
    await mount(page, `<tr-date-picker id="gb" label="GB" locale="en-GB"></tr-date-picker><tr-date-picker id="us" label="US" locale="en-US"></tr-date-picker><tr-date-picker id="x" label="X" locale="en-GB"></tr-date-picker>`);
    const typeIn = async (sel: string, text: string) => {
      const input = page.locator(`${sel} input`);
      await input.fill(text);
      await input.press('Enter');
      return page.locator(sel).evaluate((el: any) => el.value);
    };
    expect(await typeIn('#gb', '3/11/2026')).toBe('2026-11-03');
    await expect(page.locator('#gb input')).toHaveValue('3 Nov 2026');
    expect(await typeIn('#gb', '2026-12-24')).toBe('2026-12-24');
    expect(await typeIn('#gb', '5 march 2027')).toBe('2027-03-05');
    expect(await typeIn('#us', '11/3/2026')).toBe('2026-11-03');
    expect(await typeIn('#us', 'Nov 4, 2026')).toBe('2026-11-04');
    await typeIn('#x', 'next tuesday-ish');
    expect(await page.locator('#x').evaluate((el: any) => [el.value, el.validity.badInput])).toEqual(['', true]);
    await expect(page.locator('#x [part=error]')).toBeVisible();
    await expect(page.locator('#x [part=error]')).toContainText('Enter a date like');
    expect(await typeIn('#x', '1/1/2027')).toBe('2027-01-01');
    expect(await page.locator('#x').evaluate((el: any) => el.validity.valid)).toBe(true);
  });

  test('min and max are range errors; range mode picks two dates', async ({ page }) => {
    await mount(page, `<tr-date-picker id="d" label="Day" min="2026-11-10" max="2026-11-30" locale="en-GB"></tr-date-picker><tr-date-picker id="r" range label="Stay" locale="en-GB"></tr-date-picker>`);
    const input = page.locator('#d input');
    await input.fill('1/11/2026');
    await input.press('Enter');
    expect(await page.locator('#d').evaluate((el: any) => el.validity.rangeUnderflow)).toBe(true);
    await expect(page.locator('#d [part=error]')).toContainText('10 Nov 2026 or later');

    const r = page.locator('#r');
    await r.locator('[part=button]').click();
    await r.evaluate((el: any) => el.shadowRoot.querySelector('tr-calendar').goTo('2026-11-01'));
    await day(page, '#r', '2026-11-03').click();
    await expect(r).toHaveAttribute('open', '');
    await day(page, '#r', '2026-11-09').click();
    await expect(r).not.toHaveAttribute('open', '');
    expect(await r.evaluate((el: any) => el.value)).toBe('2026-11-03/2026-11-09');
    await expect(r.locator('input')).toHaveValue('3 Nov 2026 – 9 Nov 2026');
    await r.locator('input').fill('1 Dec 2026 – 4 Dec 2026');
    await r.locator('input').press('Enter');
    expect(await r.evaluate((el: any) => el.value)).toBe('2026-12-01/2026-12-04');
  });

  test('lines up with tr-input and tr-select', async ({ page }) => {
    await mount(page, `<div style="display:flex;gap:8px;align-items:end"><tr-input id="i" label="Name"></tr-input><tr-date-picker id="d" label="Date"></tr-date-picker><tr-select id="s" label="Room"><tr-option value="a">A</tr-option></tr-select></div>`);
    const h = async (sel: string, part: string) => (await page.locator(`${sel} [part=${part}]`).boundingBox())!;
    const i = await h('#i', 'field');
    const d = await h('#d', 'field');
    const s = await h('#s', 'trigger');
    expect(d.height).toBeCloseTo(i.height, 0);
    expect(d.y).toBeCloseTo(i.y, 0);
    expect(s.height).toBeCloseTo(d.height, 0);
  });

  test('the sheet fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await mount(page, `<tr-date-picker id="d" label="Date" week-numbers value="2026-11-14" style="width:100%"></tr-date-picker>`);
    await page.locator('#d [part=button]').click();
    const sheet = (await page.locator('#d [part=popover]').boundingBox())!;
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });

  test('has no axe violations, closed and open', async ({ page }) => {
    await mount(page, `<tr-date-picker id="d" label="Check-in" value="2026-11-14" hint="After 3 pm." clearable></tr-date-picker><tr-date-picker range label="Stay"></tr-date-picker>`);
    let r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
    await page.locator('#d [part=button]').click();
    await expect(page.locator('#d [part=popover]')).toBeVisible();
    r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});
