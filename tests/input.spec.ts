import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-input', () => {
  test('label names the inner textbox; the host has no role', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="Name" value="Ada"></tr-input>`);
    const box = page.getByRole('textbox', { name: 'Name' });
    await expect(box).toHaveValue('Ada');
    expect(await page.locator('#i').getAttribute('role')).toBeNull();
    expect(await page.locator('#i').getAttribute('tabindex')).toBeNull();
  });

  test('aria-label is forwarded to the inner input', async ({ page }) => {
    await mount(page, `<tr-input id="i" aria-label="Search" type="search"></tr-input>`);
    await expect(page.getByRole('searchbox', { name: 'Search' })).toBeVisible();
    await page.evaluate(() => document.getElementById('i')!.setAttribute('aria-label', 'Find'));
    await expect(page.getByRole('searchbox', { name: 'Find' })).toBeVisible();
  });

  test('delegates focus and fires input and change from the host', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="City"></tr-input><button>after</button>`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const i = document.getElementById('i')!;
      i.addEventListener('input', (e) => w.events.push(`input:${(e.target as any).value}`));
      i.addEventListener('change', (e) => w.events.push(`change:${(e.target as any).value}`));
      i.focus();
    });
    await page.keyboard.type('Oslo');
    await page.keyboard.press('Tab');
    const events: string[] = await page.evaluate(() => (window as any).events);
    expect(events[0]).toBe('input:O');
    expect(events.at(-1)).toBe('change:Oslo');
    await expect(page.locator('#i')).toHaveJSProperty('value', 'Oslo');
  });

  test('clicking the well focuses the field', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="Unit"><span slot="end">Hz</span></tr-input>`);
    await page.getByText('Hz').click();
    await expect(page.getByRole('textbox', { name: 'Unit' })).toBeFocused();
  });

  test('participates in forms: value, validity and reset', async ({ page }) => {
    await mount(
      page,
      `<form id="f"><tr-input name="user" label="User" value="ada" required minlength="3"></tr-input>
       <tr-input name="code" label="Code" pattern="[0-9]{4}"></tr-input></form>`,
    );
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    expect(await read()).toBe('user=ada&code=');
    expect(await valid()).toBe(true);

    const user = page.getByRole('textbox', { name: 'User' });
    await user.fill('');
    expect(await valid()).toBe(false);
    expect(await page.evaluate(() => (document.querySelector('tr-input') as any).validity.valueMissing)).toBe(true);

    await user.fill('grace');
    await page.getByRole('textbox', { name: 'Code' }).fill('12a');
    expect(await valid()).toBe(false);
    await page.getByRole('textbox', { name: 'Code' }).fill('1234');
    expect(await valid()).toBe(true);
    expect(await read()).toBe('user=grace&code=1234');

    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('user=ada&code=');
    await expect(user).toHaveValue('ada');
  });

  test('marks itself invalid when the form reports', async ({ page }) => {
    await mount(page, `<form id="f"><tr-input id="i" name="n" label="Needed" required></tr-input></form>`);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    await expect(page.locator('#i')).toHaveAttribute('data-user-invalid', '');
    await expect(page.getByRole('textbox', { name: 'Needed' })).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('textbox', { name: 'Needed' }).fill('ok');
    await expect(page.locator('#i')).not.toHaveAttribute('data-user-invalid', '');
  });

  test('disabled and readonly', async ({ page }) => {
    await mount(page, `<form id="f"><tr-input name="a" label="A" value="x" disabled></tr-input><tr-input name="b" label="B" value="y" readonly></tr-input></form>`);
    await expect(page.getByRole('textbox', { name: 'A' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'B' })).toHaveAttribute('readonly', '');
    const data = await page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    expect(data).toBe('b=y');
  });

  test('hint and error are linked with aria-describedby', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="Username" hint="Letters and digits only." value="ada"></tr-input>`);
    const box = page.getByRole('textbox', { name: 'Username' });
    await expect(box).toHaveAccessibleDescription('Letters and digits only.');
    await page.evaluate(() => document.getElementById('i')!.setAttribute('error', 'That name is taken.'));
    await expect(page.locator('#i')).toHaveAttribute('data-user-invalid', '');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(box).toHaveAccessibleDescription('Letters and digits only. That name is taken.');
    expect(await page.evaluate(() => (document.getElementById('i') as any).checkValidity())).toBe(false);
    await page.evaluate(() => document.getElementById('i')!.removeAttribute('error'));
    await expect(page.locator('#i')).not.toHaveAttribute('data-user-invalid', '');
    expect(await page.evaluate(() => (document.getElementById('i') as any).checkValidity())).toBe(true);
  });

  test('shows the browser message after the user leaves an invalid field', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="Email" type="email"></tr-input><button>next</button>`);
    const box = page.getByRole('textbox', { name: 'Email' });
    await box.fill('nope');
    await expect(page.locator('#i')).not.toHaveAttribute('data-user-invalid', '');
    await page.keyboard.press('Tab');
    await expect(page.locator('#i')).toHaveAttribute('data-user-invalid', '');
    await expect(page.locator('#i .error')).toBeVisible();
    await box.fill('a@b.co');
    await expect(page.locator('#i .error')).toBeHidden();
  });

  test('clearable empties the field and fires input + change', async ({ page }) => {
    await mount(page, `<tr-input id="i" label="Find" value="abc" clearable></tr-input>`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const i = document.getElementById('i')!;
      i.addEventListener('input', () => w.events.push('input'));
      i.addEventListener('change', () => w.events.push('change'));
    });
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('textbox', { name: 'Find' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Find' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).events)).toEqual(['input', 'change']);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-input label="Name"></tr-input><tr-input aria-label="Search" type="search" placeholder="Search"></tr-input>
       <tr-input label="Email" type="email" required value="x@y.z" hint="Work address" clearable></tr-input>
       <tr-input label="User" value="ada" error="That name is taken."></tr-input>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: states, sizes and themes', async ({ page }) => {
    const block = `<div style="display:flex;flex-wrap:wrap;gap:16px;padding:12px;align-items:flex-end;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-input label="Name" value="Ada Lovelace"></tr-input>
      <tr-input label="Email" placeholder="you@example.com" size="sm"></tr-input>
      <tr-input aria-label="Search" placeholder="Search" size="lg"><svg slot="start" viewBox="0 0 16 16" width="16" height="16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/></svg></tr-input>
      <tr-input label="Freq" value="440"><span slot="end">Hz</span></tr-input>
      <tr-input label="Disabled" value="locked" disabled></tr-input>
      <tr-input label="Username" value="ada" hint="Letters and digits." clearable></tr-input>
      <tr-input label="Handle" value="ada!" error="Only letters and digits."></tr-input></div>`;
    await mount(page, `${block}<div data-tr-theme="dark">${block}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('input-matrix.png');
  });
});
