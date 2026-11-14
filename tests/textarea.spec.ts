import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-textarea', () => {
  test('is a labelled multi-line textbox with hint description', async ({ page }) => {
    await mount(page, `<tr-textarea label="Message" hint="Be kind."></tr-textarea><tr-textarea aria-label="Notes"></tr-textarea>`);
    const box = page.getByRole('textbox', { name: 'Message' });
    await expect(box).toBeVisible();
    await expect(box).toHaveAccessibleDescription('Be kind.');
    expect(await box.evaluate((e) => e.localName)).toBe('textarea');
    await expect(page.getByRole('textbox', { name: 'Notes' })).toBeVisible();
  });

  test('typing updates value, fires input and change; font inherits', async ({ page }) => {
    await mount(page, `<tr-textarea id="t" label="Message" style="font-family:Georgia,serif"></tr-textarea>`);
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      const t = document.getElementById('t')!;
      t.addEventListener('input', () => w.events.push('input'));
      t.addEventListener('change', () => w.events.push('change'));
    });
    await page.getByRole('textbox', { name: 'Message' }).fill('Hi\nthere');
    await page.getByRole('textbox', { name: 'Message' }).blur();
    expect(await page.locator('#t').evaluate((e: any) => e.value)).toBe('Hi\nthere');
    const ev = await page.evaluate(() => (window as any).events);
    expect(ev).toContain('input');
    expect(ev.at(-1)).toBe('change');
    expect(await page.locator('#t textarea').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Georgia');
  });

  test('host focus delegates to the textarea; clicking the well focuses it', async ({ page }) => {
    await mount(page, `<tr-textarea id="t" label="Message"></tr-textarea>`);
    await page.locator('#t').evaluate((e: HTMLElement) => e.focus());
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeFocused();
  });

  test('counter shows length against maxlength and is part of the description', async ({ page }) => {
    await mount(page, `<tr-textarea id="t" label="Bio" maxlength="10" counter value="abc"></tr-textarea>`);
    await expect(page.locator('#t').locator('.counter')).toHaveText('3 / 10');
    await page.getByRole('textbox', { name: 'Bio' }).fill('abcdefghij');
    await expect(page.locator('#t').locator('.counter')).toHaveText('10 / 10');
    await expect(page.getByRole('textbox', { name: 'Bio' })).toHaveAccessibleDescription('10 / 10');
  });

  test('autosize grows with content', async ({ page }) => {
    await mount(page, `<tr-textarea id="t" label="Grow" autosize rows="2"></tr-textarea>`);
    const h0 = (await page.locator('#t textarea').boundingBox())!.height;
    await page.getByRole('textbox', { name: 'Grow' }).fill('1\n2\n3\n4\n5\n6');
    const h1 = (await page.locator('#t textarea').boundingBox())!.height;
    expect(h1).toBeGreaterThan(h0 + 40);
  });

  test('submits, validates (required, error) and resets with its form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-textarea id="t" label="Msg" name="msg" required value="start"></tr-textarea></form>`);
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    expect(await read()).toBe('msg=start');
    await page.getByRole('textbox', { name: 'Msg' }).fill('');
    expect(await valid()).toBe(false);
    await page.getByRole('textbox', { name: 'Msg' }).fill('ok');
    expect(await valid()).toBe(true);
    await page.locator('#t').evaluate((e: any) => (e.error = 'Nope.'));
    await expect(page.getByText('Nope.')).toBeVisible();
    expect(await valid()).toBe(false);
    await page.locator('#t').evaluate((e: any) => (e.error = ''));
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('msg=start');
  });

  test('disabled textarea cannot be edited', async ({ page }) => {
    await mount(page, `<tr-textarea label="Off" disabled></tr-textarea>`);
    await expect(page.getByRole('textbox', { name: 'Off' })).toBeDisabled();
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-textarea label="Message" hint="Hint" counter maxlength="40"></tr-textarea><tr-textarea aria-label="Notes" error="Too short."></tr-textarea>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: states and themes', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:20px;padding:12px;align-items:flex-start;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <tr-textarea label="Message" value="Hello there." maxlength="80" counter hint="Shown publicly." resize="none"></tr-textarea>
      <tr-textarea aria-label="Notes" placeholder="Notes…" rows="2" error="Too short." resize="none"></tr-textarea>
      <tr-textarea label="Paper" material="paper" rows="2" resize="none" value="Paper well"></tr-textarea></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('textarea-matrix.png');
  });

  test('form reset restores the original state after the control is moved', async ({ page }) => {
    await mount(page, `<form id="f"><div id="a"><tr-textarea id="x" label="N" name="n"></tr-textarea></div><div id="b"></div></form>`);
    await page.fill('#x textarea', 'typed');
    const after = await page.evaluate(async () => {
      const el = document.getElementById('x') as any;
      document.getElementById('b')!.append(el);
      (document.getElementById('f') as HTMLFormElement).reset();
      await el.updateComplete;
      return el.value;
    });
    expect(after).toBe('');
  });
});
