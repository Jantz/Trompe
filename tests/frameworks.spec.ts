import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke tests for the framework examples (examples/html, react, vue, svelte). Each renders the same
 * control panel from the built "trompe" package and mirrors control state into text through the
 * elements' native input/change/click events. Run via `npm run test:frameworks`.
 */
const FRAMEWORKS = [
  { name: 'html', title: 'plain HTML' },
  { name: 'react', title: 'React' },
  { name: 'vue', title: 'Vue' },
  { name: 'svelte', title: 'Svelte' },
] as const;

const TAGS = ['tr-panel', 'tr-slider', 'tr-knob', 'tr-switch', 'tr-button', 'tr-input'];

const state = (page: Page, key: string) => page.getByTestId(key);

for (const fw of FRAMEWORKS) {
  test.describe(fw.name, () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
      errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(`/${fw.name}/`);
      await expect(page.getByRole('heading', { name: `Trompe + ${fw.title}` })).toBeVisible();
    });

    test.afterEach(() => {
      expect(errors, 'no page errors').toEqual([]);
    });

    test('elements are defined and upgraded', async ({ page }) => {
      const report = await page.evaluate(async (tags) => {
        await Promise.all(tags.map((t) => customElements.whenDefined(t)));
        return tags.map((tag) => {
          const el = document.querySelector(tag) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
          return { tag, present: !!el, defined: !!customElements.get(tag), shadow: !!el?.shadowRoot };
        });
      }, TAGS);
      for (const r of report) expect(r, r.tag).toEqual({ tag: r.tag, present: true, defined: true, shadow: true });
      // The panel's controls carry their ARIA roles.
      await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Bypass' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tap' })).toBeVisible();
    });

    test('slider and knob update framework state', async ({ page }) => {
      await expect(state(page, 'volume')).toHaveText('60');
      const volume = page.getByRole('slider', { name: 'Volume' });
      await expect(volume).toHaveAttribute('aria-valuenow', '60');
      await volume.focus();
      await volume.press('ArrowRight');
      await expect(state(page, 'volume')).toHaveText('61');
      await volume.press('End');
      await expect(state(page, 'volume')).toHaveText('100');
      await expect(volume).toHaveAttribute('aria-valuenow', '100');

      // Pointer: clicking near the start of the groove moves the value down.
      const box = (await page.locator('tr-slider').locator('[part="groove"]').boundingBox())!;
      await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
      await expect.poll(async () => Number(await state(page, 'volume').textContent())).toBeLessThan(50);

      const gain = page.getByRole('slider', { name: 'Gain' });
      await expect(state(page, 'gain')).toHaveText('40');
      await gain.focus();
      await gain.press('ArrowUp');
      await expect(state(page, 'gain')).toHaveText('41');
    });

    test('switch and button update framework state', async ({ page }) => {
      const sw = page.getByRole('switch', { name: 'Bypass' });
      await expect(state(page, 'bypass')).toHaveText('off');
      await sw.click();
      await expect(state(page, 'bypass')).toHaveText('on');
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await sw.press('Space');
      await expect(state(page, 'bypass')).toHaveText('off');

      const tap = page.getByRole('button', { name: 'Tap' });
      await tap.click();
      await expect(state(page, 'taps')).toHaveText('1');
      await tap.press('Enter');
      await expect(state(page, 'taps')).toHaveText('2');
    });

    test('text input updates framework state (when tr-input is implemented)', async ({ page }) => {
      const field = page.locator('tr-input');
      const hasField = await field.evaluate((el) => !!el.shadowRoot?.querySelector('input, textarea'));
      test.skip(!hasField, 'tr-input is still a stub');
      await field.locator('input, textarea').first().fill('Warm pad');
      await expect(state(page, 'preset')).toHaveText('Warm pad');
    });
  });
}
