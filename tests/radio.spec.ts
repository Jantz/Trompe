import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { importAlone, mount } from './helpers';

const group = (attrs = '') => `<form id="f"><tr-radio-group id="g" label="Plan" name="plan" ${attrs}>
  <tr-radio value="free">Free</tr-radio><tr-radio value="pro">Pro</tr-radio><tr-radio value="team" disabled>Team</tr-radio><tr-radio value="ent">Enterprise</tr-radio>
</tr-radio-group></form>`;

test.describe('tr-radio-group / tr-radio', () => {
  test('exposes radiogroup with name and radios with checked state', async ({ page }) => {
    await mount(page, group('value="pro"'));
    const g = page.getByRole('radiogroup', { name: 'Plan' });
    await expect(g).toBeVisible();
    await expect(g.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('radio', { name: 'Pro' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Free' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radio', { name: 'Team' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('roving tabindex: only the checked (or first) radio is tabbable', async ({ page }) => {
    await mount(page, `<button id="before">before</button>${group()}<button id="after">after</button>`);
    const tab = () => page.locator('tr-radio').evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')));
    expect(await tab()).toEqual(['0', '-1', '-1', '-1']);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Free' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await page.evaluate(() => ((document.getElementById('g') as any).value = 'ent'));
    await page.waitForTimeout(50);
    expect(await tab()).toEqual(['-1', '-1', '-1', '0']);
  });

  test('arrow keys move and select, wrap and skip disabled; fire input + change', async ({ page }) => {
    await mount(page, group('value="free"'));
    await page.evaluate(() => {
      const w = window as any;
      w.events = [];
      document.getElementById('g')!.addEventListener('change', (e: any) => w.events.push(e.target.value));
    });
    await page.getByRole('radio', { name: 'Free' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Pro' })).toBeFocused();
    await expect(page.getByRole('radio', { name: 'Pro' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Enterprise' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Free' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('radio', { name: 'Enterprise' })).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => (window as any).events)).toEqual(['pro', 'ent', 'free', 'ent']);
    await expect(page.getByRole('radio', { name: 'Free' })).toHaveAttribute('aria-checked', 'false');
  });

  test('Space selects the focused radio; click selects; disabled cannot be clicked', async ({ page }) => {
    await mount(page, group());
    await page.getByRole('radio', { name: 'Free' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Free' })).toHaveAttribute('aria-checked', 'true');
    await page.getByText('Pro').click();
    await expect(page.getByRole('radio', { name: 'Pro' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Team' }).click({ force: true });
    await expect(page.getByRole('radio', { name: 'Team' })).toHaveAttribute('aria-checked', 'false');
    expect(await page.locator('#g').evaluate((e: any) => e.value)).toBe('pro');
  });

  test('submits, validates (required) and resets with its form', async ({ page }) => {
    await mount(page, group('required'));
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    const valid = () => page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    await expect(page.locator('#g')).toHaveAttribute('aria-required', 'true');
    expect(await read()).toBe('');
    expect(await valid()).toBe(false);
    await page.getByText('Enterprise').click();
    expect(await read()).toBe('plan=ent');
    expect(await valid()).toBe(true);
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    expect(await read()).toBe('');
  });

  test('checked attribute on a radio sets the group value', async ({ page }) => {
    await mount(page, `<tr-radio-group id="g" aria-label="Size"><tr-radio value="s">S</tr-radio><tr-radio value="m" checked>M</tr-radio></tr-radio-group>`);
    expect(await page.locator('#g').evaluate((e: any) => e.value)).toBe('m');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `${group('value="pro"')}<tr-radio-group aria-label="Size" orientation="horizontal"><tr-radio value="s">S</tr-radio><tr-radio value="m">M</tr-radio></tr-radio-group>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: orientation, materials and themes', async ({ page }) => {
    const row = `<div style="display:flex;flex-wrap:wrap;gap:32px;padding:12px;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      ${group('value="pro"').replace('<form id="f">', '').replace('</form>', '').replace('id="g"', '')}
      <tr-radio-group aria-label="Size" orientation="horizontal" value="m" material="metal" size="lg"><tr-radio value="s">S</tr-radio><tr-radio value="m">M</tr-radio><tr-radio value="l">L</tr-radio></tr-radio-group>
      <tr-radio-group aria-label="Flat" realism="flat" value="a"><tr-radio value="a">Flat on</tr-radio><tr-radio value="b">Flat off</tr-radio></tr-radio-group></div>`;
    await mount(page, `${row}<div data-tr-theme="dark">${row}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('radio-matrix.png');
  });

  test('importing radio or radio-group alone defines both', async ({ page, context }) => {
    expect(await importAlone(page, '/src/components/radio/radio.ts', ['tr-radio', 'tr-radio-group'])).toEqual({ 'tr-radio': true, 'tr-radio-group': true });
    const other = await context.newPage();
    expect(await importAlone(other, '/src/components/radio/radio-group.ts', ['tr-radio', 'tr-radio-group'])).toEqual({ 'tr-radio': true, 'tr-radio-group': true });
  });

  test('a value property set before insertion wins over a checked radio', async ({ page }) => {
    await mount(page, '');
    const value = await page.evaluate(async () => {
      const g = document.createElement('tr-radio-group');
      g.innerHTML = '<tr-radio value="a" checked>A</tr-radio><tr-radio value="b">B</tr-radio>';
      g.value = 'b';
      document.getElementById('root')!.append(g);
      await g.updateComplete;
      return { value: g.value, checked: g.radios.filter((r) => r.checked).map((r) => r.value) };
    });
    expect(value).toEqual({ value: 'b', checked: ['b'] });
  });

  test('form reset restores the original value after the group is moved', async ({ page }) => {
    await mount(page, `<form id="f"><div id="a"><tr-radio-group id="g" name="g" label="G"><tr-radio value="a" checked>A</tr-radio><tr-radio value="b">B</tr-radio></tr-radio-group></div><div id="b"></div></form>`);
    await page.getByRole('radio', { name: 'B' }).click();
    const value = await page.evaluate(async () => {
      const g = document.getElementById('g') as any;
      document.getElementById('b')!.append(g);
      (document.getElementById('f') as HTMLFormElement).reset();
      await g.updateComplete;
      return g.value;
    });
    expect(value).toBe('a');
  });
});
