import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const bar = (attrs = '') => `<button id="before">Before</button>
<tr-toolbar id="tb" label="Formatting" ${attrs}>
  <tr-button toggle aria-label="Bold">B</tr-button>
  <tr-button toggle aria-label="Italic">I</tr-button>
  <tr-button disabled>Off</tr-button>
  <hr>
  <button>Native</button>
  <tr-input aria-label="Find"></tr-input>
</tr-toolbar>
<button id="after">After</button>`;

test.describe('tr-toolbar', () => {
  test('exposes role, name and orientation', async ({ page }) => {
    await mount(page, bar('orientation="vertical"'));
    const tb = page.getByRole('toolbar', { name: 'Formatting' });
    await expect(tb).toBeVisible();
    await expect(tb).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('is one Tab stop and remembers the last control', async ({ page }) => {
    await mount(page, bar());
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Bold' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Bold' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Italic' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Italic' })).toBeFocused();
  });

  test('arrows skip disabled controls and separators; Home/End; text fields keep their arrows', async ({ page }) => {
    await mount(page, bar());
    await page.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: 'Native' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', { name: 'Italic' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('textbox', { name: 'Find' })).toBeFocused();
    await page.keyboard.type('abc');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('textbox', { name: 'Find' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('textbox', { name: 'Find' })).toBeFocused();
    await page.getByRole('button', { name: 'Italic' }).click();
    await page.keyboard.press('Home');
    await expect(page.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('controls still work with Space and pointer', async ({ page }) => {
    await mount(page, bar());
    await page.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Italic' }).click();
    await expect(page.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Italic' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('tabindex', '-1');
  });

  test('vertical uses Up/Down', async ({ page }) => {
    await mount(page, bar('orientation="vertical"'));
    await page.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Italic' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, bar() + `<tr-toolbar variant="bar" label="Actions"><tr-button>Reply</tr-button><tr-button tone="danger">Delete</tr-button></tr-toolbar>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: tray and bar', async ({ page }) => {
    await mount(
      page,
      `<div style="display:grid;gap:16px;width:520px">
        <tr-toolbar label="Format"><tr-button toggle pressed size="sm" aria-label="Bold"><b>B</b></tr-button><tr-button toggle size="sm" aria-label="Italic"><i>I</i></tr-button><hr><tr-button size="sm">Insert</tr-button><tr-input size="sm" aria-label="Search" placeholder="Search"></tr-input></tr-toolbar>
        <tr-toolbar variant="bar" label="Mail"><tr-button size="sm">Reply</tr-button><tr-button size="sm">Forward</tr-button><hr><tr-button size="sm" tone="danger">Delete</tr-button></tr-toolbar>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('toolbar-matrix.png');
  });
  test('a segmented control inside adds no extra tab stop of its own', async ({ page }) => {
    await mount(page, `<tr-toolbar label="Tools"><tr-button>Bold</tr-button><tr-segmented label="View"><tr-option>List</tr-option><tr-option>Grid</tr-option></tr-segmented></tr-toolbar>`);
    expect(await page.locator('tr-segmented').getAttribute('tabindex')).toBeNull();
    await page.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'List' })).toBeFocused();
  });
});
