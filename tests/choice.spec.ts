import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const PLANS = `<form id="f">
  <tr-choice-group id="g" label="Plan" name="plan" value="pro">
    <tr-choice-card value="free">Free<span slot="description">One project</span><span slot="end">$0</span></tr-choice-card>
    <tr-choice-card value="pro">Pro<span slot="description">Unlimited projects</span><span slot="end">$12/mo</span></tr-choice-card>
    <tr-choice-card value="old" disabled>Legacy</tr-choice-card>
    <tr-choice-card value="team">Team<span slot="description">Shared billing</span><span slot="end">$30/mo</span></tr-choice-card>
  </tr-choice-group>
</form>`;

const formValue = (page: import('@playwright/test').Page) =>
  page.locator('#f').evaluate((f: HTMLFormElement) => [...new FormData(f).entries()].map(([k, v]) => `${k}=${v}`));

test.describe('tr-choice-group', () => {
  test('single: radio semantics, one tab stop, arrows move and choose, skipping disabled', async ({ page }) => {
    await mount(page, `<tr-button id="before">Before</tr-button>${PLANS}`);
    await expect(page.getByRole('radiogroup', { name: 'Plan' })).toBeVisible();
    const pro = page.getByRole('radio', { name: /Pro/ });
    await expect(pro).toHaveAttribute('aria-checked', 'true');
    expect(await formValue(page)).toEqual(['plan=pro']);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(pro).toBeFocused();
    await page.evaluate(() => {
      (window as any).changes = 0;
      document.querySelector('#g')!.addEventListener('change', () => (window as any).changes++);
    });
    await page.keyboard.press('ArrowRight');
    const team = page.getByRole('radio', { name: /Team/ });
    await expect(team).toBeFocused();
    await expect(team).toHaveAttribute('aria-checked', 'true');
    await expect(pro).toHaveAttribute('aria-checked', 'false');
    expect(await page.locator('#g').evaluate((el: any) => el.value)).toBe('team');
    expect(await formValue(page)).toEqual(['plan=team']);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: /Free/ })).toBeFocused();
    expect(await page.evaluate(() => (window as any).changes)).toBe(2);
    // the disabled card cannot be chosen
    await page.locator('tr-choice-card[value=old]').click({ force: true });
    expect(await page.locator('#g').evaluate((el: any) => el.value)).toBe('free');
  });

  test('a click chooses; selecting does not move the layout', async ({ page }) => {
    await mount(page, PLANS);
    const boxes = () => page.locator('tr-choice-card').evaluateAll((els) => els.map((e) => JSON.stringify(e.getBoundingClientRect())));
    const before = await boxes();
    await page.getByRole('radio', { name: /Free/ }).click();
    await expect(page.getByRole('radio', { name: /Free/ })).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(400);
    expect(await boxes()).toEqual(before);
  });

  test('multiple: checkbox semantics, Space toggles, submits every value', async ({ page }) => {
    await mount(
      page,
      `<form id="f"><tr-choice-group id="g" label="Days" name="days" multiple value="mon,thu">
        <tr-choice-card value="mon">Monday</tr-choice-card><tr-choice-card value="tue">Tuesday</tr-choice-card><tr-choice-card value="thu">Thursday</tr-choice-card>
      </tr-choice-group></form>`,
    );
    await expect(page.getByRole('group', { name: 'Days' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Monday' })).toHaveAttribute('aria-checked', 'true');
    expect(await formValue(page)).toEqual(['days=mon', 'days=thu']);
    const tue = page.getByRole('checkbox', { name: 'Tuesday' });
    await tue.focus();
    await page.keyboard.press('Space');
    await expect(tue).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('checkbox', { name: 'Monday' }).click();
    expect(await page.locator('#g').evaluate((el: any) => el.values)).toEqual(['tue', 'thu']);
    expect(await formValue(page)).toEqual(['days=tue', 'days=thu']);
  });

  test('required, error and hint set validity and are read out; reset restores', async ({ page }) => {
    await mount(
      page,
      `<form id="f"><tr-choice-group id="g" label="Delivery" name="ship" required hint="Prices include tax.">
        <tr-choice-card value="std">Standard</tr-choice-card><tr-choice-card value="exp">Express</tr-choice-card>
      </tr-choice-group></form>`,
    );
    const g = page.locator('#g');
    const valid = () => page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity());
    expect(await valid()).toBe(false);
    await expect(g).toHaveAttribute('aria-required', 'true');
    await expect(g).toHaveAttribute('aria-description', 'Prices include tax.');
    await page.getByRole('radio', { name: 'Express' }).click();
    expect(await valid()).toBe(true);
    await g.evaluate((el) => el.setAttribute('error', 'Express is sold out.'));
    await expect(g.locator('[part=error]')).toBeVisible();
    await expect(g).toHaveAttribute('aria-invalid', 'true');
    expect(await valid()).toBe(false);
    await g.evaluate((el) => el.removeAttribute('error'));
    expect(await valid()).toBe(true);
    await page.locator('#f').evaluate((f: HTMLFormElement) => f.reset());
    expect(await g.evaluate((el: any) => el.value)).toBe('');
  });

  test('cards wrap into one column on a phone without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await mount(page, PLANS.replace('label="Plan"', 'label="Plan" columns="3"'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const xs = await page.locator('tr-choice-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(xs).size).toBe(1);
  });

  test('columns caps the cards per row', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    await mount(page, PLANS.replace('label="Plan"', 'label="Plan" columns="2"'));
    const ys = await page.locator('tr-choice-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(ys).size).toBe(2);
  });

  test('has no axe violations (single and multiple)', async ({ page }) => {
    await mount(
      page,
      `${PLANS}<tr-choice-group label="Days" multiple hint="Pick any."><tr-choice-card value="mon">Monday</tr-choice-card><tr-choice-card value="tue">Tuesday</tr-choice-card></tr-choice-group>`,
    );
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations).toEqual([]);
  });
});
