import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const MENU = `
  <tr-button id="trig">Edit</tr-button>
  <tr-menu id="m">
    <tr-menu-item value="cut" shortcut="Ctrl+X">Cut</tr-menu-item>
    <tr-menu-item value="copy">Copy</tr-menu-item>
    <tr-menu-item value="paste" disabled>Paste</tr-menu-item>
    <tr-menu-item separator></tr-menu-item>
    <tr-menu-item type="checkbox" value="wrap">Word wrap</tr-menu-item>
    <tr-menu-item type="radio" name="z" value="s" checked>Small</tr-menu-item>
    <tr-menu-item type="radio" name="z" value="l">Large</tr-menu-item>
    <tr-menu-item value="more">More
      <tr-menu slot="submenu">
        <tr-menu-item value="sub-a">Alpha</tr-menu-item>
        <tr-menu-item value="sub-b">Beta</tr-menu-item>
      </tr-menu>
    </tr-menu-item>
  </tr-menu>
  <button id="after">After</button>`;

async function recordSelects(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as any).selected = [];
    document.addEventListener('select', (e: any) => (window as any).selected.push(e.detail.value));
  });
}

test.describe('tr-menu', () => {
  test('wires APG roles and trigger attributes', async ({ page }) => {
    await mount(page, MENU);
    const trig = page.locator('#trig');
    await expect(trig).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trig).toHaveAttribute('aria-expanded', 'false');
    await expect(trig).toHaveAttribute('aria-controls', 'm');
    await expect(page.locator('#m')).toHaveAttribute('role', 'menu');
    await expect(page.locator('#m')).toHaveAttribute('aria-labelledby', 'trig');
    await expect(page.locator('tr-menu-item[separator]')).toHaveAttribute('role', 'separator');
    await expect(page.locator('tr-menu-item[type=checkbox]')).toHaveAttribute('role', 'menuitemcheckbox');
    await expect(page.locator('tr-menu-item[type=checkbox]')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('tr-menu-item[value=s]')).toHaveAttribute('role', 'menuitemradio');
    await expect(page.locator('tr-menu-item[value=paste]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('tr-menu-item[value=more]')).toHaveAttribute('aria-haspopup', 'menu');
  });

  test('opens with click into the top layer and focuses the first item', async ({ page }) => {
    await mount(page, MENU);
    await page.locator('#trig').click();
    await expect(page.locator('#m')).toHaveJSProperty('open', true);
    expect(await page.locator('#m').evaluate((m) => m.matches(':popover-open'))).toBe(true);
    await expect(page.locator('#trig')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeFocused();
    // It sits below the trigger.
    const t = await page.locator('#trig').boundingBox();
    const m = await page.locator('#m').boundingBox();
    expect(m!.y).toBeGreaterThanOrEqual(t!.y + t!.height);
    // Clicking the trigger again closes it.
    await page.locator('#trig').click();
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
  });

  test('keyboard: arrows, Home/End, typeahead, disabled items, Escape', async ({ page }) => {
    await mount(page, MENU);
    await page.locator('#trig').focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('tr-menu-item[value=more]')).toBeFocused();
    await page.keyboard.press('ArrowDown'); // wraps
    await expect(page.locator('tr-menu-item[value=cut]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('tr-menu-item[value=paste]')).toBeFocused(); // disabled stays focusable
    await page.keyboard.press('ArrowDown'); // skips the separator
    await expect(page.locator('tr-menu-item[value=wrap]')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('tr-menu-item[value=more]')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('tr-menu-item[value=cut]')).toBeFocused();
    await page.keyboard.press('l');
    await expect(page.locator('tr-menu-item[value=l]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
    await expect(page.locator('#trig')).toBeFocused();
    await expect(page.locator('#trig')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Enter activates, fires select and returns focus; disabled does nothing', async ({ page }) => {
    await mount(page, MENU);
    await recordSelects(page);
    await page.locator('#trig').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).selected)).toEqual(['copy']);
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
    await expect(page.locator('#trig')).toBeFocused();
    await page.locator('#m').evaluate((m: any) => m.show());
    await page.locator('tr-menu-item[value=paste]').click({ force: true });
    expect(await page.evaluate(() => (window as any).selected)).toEqual(['copy']);
    await expect(page.locator('#m')).toHaveJSProperty('open', true);
  });

  test('checkbox and radio items: Space toggles without closing', async ({ page }) => {
    await mount(page, MENU);
    await recordSelects(page);
    await page.locator('#m').evaluate((m: any) => m.show());
    await page.locator('tr-menu-item[value=wrap]').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('tr-menu-item[value=wrap]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#m')).toHaveJSProperty('open', true);
    await page.locator('tr-menu-item[value=l]').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('tr-menu-item[value=l]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('tr-menu-item[value=s]')).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => (window as any).selected)).toEqual(['wrap', 'l']);
  });

  test('pointer: hover highlights, click selects and closes', async ({ page }) => {
    await mount(page, MENU);
    await recordSelects(page);
    await page.locator('#trig').click();
    await page.locator('tr-menu-item[value=copy]').hover();
    await expect(page.locator('tr-menu-item[value=copy]')).toBeFocused();
    await page.locator('tr-menu-item[value=copy]').click();
    expect(await page.evaluate(() => (window as any).selected)).toEqual(['copy']);
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
  });

  test('light dismiss on outside click', async ({ page }) => {
    await mount(page, MENU);
    await page.locator('#trig').click();
    await page.mouse.click(600, 500);
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
    await expect(page.locator('#trig')).toHaveAttribute('aria-expanded', 'false');
  });

  test('submenu opens with ArrowRight and closes with ArrowLeft', async ({ page }) => {
    await mount(page, MENU);
    await recordSelects(page);
    await page.locator('#m').evaluate((m: any) => m.show());
    await page.locator('tr-menu-item[value=more]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('tr-menu-item[value=sub-a]')).toBeFocused();
    await expect(page.locator('tr-menu-item[value=more]')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('tr-menu-item[value=more]')).toBeFocused();
    await expect(page.locator('tr-menu-item[value=more]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#m')).toHaveJSProperty('open', true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).selected)).toEqual(['sub-b']);
    await expect(page.locator('#m')).toHaveJSProperty('open', false);
    await expect(page.locator('#trig')).toBeFocused();
  });

  test('anchor attribute and the JS placement fallback', async ({ page }) => {
    await mount(page, `<div style="padding:200px 0 0 300px"><button id="far">Options</button></div>
      <tr-menu anchor="far" placement="top-start"><tr-menu-item>One</tr-menu-item><tr-menu-item>Two</tr-menu-item></tr-menu>`);
    await page.evaluate(async () => {
      const mod = await import('/src/components/menu/position.ts' as string);
      mod.positioning.css = false;
    });
    await page.locator('#far').click();
    const b = await page.locator('#far').boundingBox();
    const m = await page.locator('tr-menu').boundingBox();
    expect(Math.abs(m!.x - b!.x)).toBeLessThan(3);
    expect(m!.y + m!.height).toBeLessThanOrEqual(b!.y + 2);
  });

  test('has no axe violations when open', async ({ page }) => {
    await mount(page, MENU);
    await page.locator('#trig').click();
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: open menu with highlighted key', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 440 });
    await mount(page, MENU);
    await page.locator('#m').evaluate((m: any) => m.show());
    await page.locator('tr-menu-item[value=copy]').focus();
    await page.locator('tr-menu-item[value=wrap]').evaluate((i: any) => (i.checked = true));
    await expect(page).toHaveScreenshot('menu-open.png');
  });
});
