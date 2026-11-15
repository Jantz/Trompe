import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
// @ts-expect-error plain ESM module shared with the CLI
import { measureChange, motionProblems } from '../cli/check/motion.mjs';

/** Mounts markup after loading the chip module (works whether or not src/index.ts exports it). */
async function mount(page: Page, markup: string, opts: { theme?: 'light' | 'dark'; skin?: string } = {}): Promise<void> {
  await page.goto('/tests/fixture.html');
  await page.waitForFunction(() => (window as unknown as { trompeReady?: boolean }).trompeReady === true);
  await page.addScriptTag({ type: 'module', content: "import '/src/components/chip/chip.ts';" });
  await page.evaluate(() => Promise.all([customElements.whenDefined('tr-chip'), customElements.whenDefined('tr-chip-group')]));
  await page.evaluate(
    async ({ markup, theme, skin }) => {
      if (theme) document.documentElement.dataset.trTheme = theme;
      if (skin) document.documentElement.dataset.trSkin = skin;
      const root = document.getElementById('root')!;
      root.innerHTML = markup;
      const els = [...root.querySelectorAll('*')].filter((el) => el.tagName.startsWith('TR-')) as Array<HTMLElement & { updateComplete?: Promise<unknown> }>;
      await Promise.all(els.map((el) => el.updateComplete));
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    { markup, theme: opts.theme, skin: opts.skin },
  );
}

const SLOTS = `<form id="f">
  <tr-chip-group id="g" label="Time" name="slot" value="09:30">
    <tr-chip>09:00</tr-chip><tr-chip>09:30</tr-chip><tr-chip disabled>10:00</tr-chip><tr-chip>10:30</tr-chip>
  </tr-chip-group>
</form>`;

const formValue = (page: Page) => page.locator('#f').evaluate((f: HTMLFormElement) => [...new FormData(f).entries()].map(([k, v]) => `${k}=${v}`));

test.describe('tr-chip-group', () => {
  test('single: radio semantics, one tab stop, arrows move and choose, skipping disabled', async ({ page }) => {
    await mount(page, `<tr-button id="before">Before</tr-button>${SLOTS}`);
    await expect(page.getByRole('radiogroup', { name: 'Time' })).toBeVisible();
    const b = page.getByRole('radio', { name: '09:30' });
    await expect(b).toHaveAttribute('aria-checked', 'true');
    expect(await formValue(page)).toEqual(['slot=09:30']);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(b).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const d = page.getByRole('radio', { name: '10:30' });
    await expect(d).toBeFocused();
    await expect(d).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: '10:00' })).toHaveAttribute('aria-disabled', 'true');
    expect(await formValue(page)).toEqual(['slot=10:30']);
    await page.keyboard.press('Home');
    await expect(page.getByRole('radio', { name: '09:00' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: '10:00' }).click({ force: true });
    expect(await page.locator('#g').evaluate((el: any) => el.value)).toBe('09:00');
  });

  test('multiple: checkbox semantics, Space toggles, every value submits, reset restores', async ({ page }) => {
    await mount(
      page,
      `<form id="f"><tr-chip-group id="g" label="Cuisine" name="c" multiple value="thai,veg">
        <tr-chip value="thai" count="12">Thai</tr-chip><tr-chip value="it" count="8">Italian</tr-chip><tr-chip value="veg">Vegetarian</tr-chip>
      </tr-chip-group><button type="reset" id="r">Reset</button></form>`,
    );
    await expect(page.getByRole('group', { name: 'Cuisine' })).toBeVisible();
    const it = page.getByRole('checkbox', { name: /Italian/ });
    await expect(it).toHaveAttribute('aria-checked', 'false');
    await it.focus();
    await page.keyboard.press('Space');
    await expect(it).toHaveAttribute('aria-checked', 'true');
    expect(await formValue(page)).toEqual(['c=thai', 'c=it', 'c=veg']);
    await page.getByRole('checkbox', { name: /Thai/ }).click();
    expect(await page.locator('#g').evaluate((el: any) => el.values)).toEqual(['it', 'veg']);
    await page.locator('#r').click();
    expect(await page.locator('#g').evaluate((el: any) => el.value)).toBe('thai,veg');
  });

  test('required blocks the form until a chip is chosen', async ({ page }) => {
    await mount(page, `<form id="f"><tr-chip-group id="g" label="Size" name="s" required><tr-chip>S</tr-chip><tr-chip>M</tr-chip></tr-chip-group></form>`);
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(false);
    await page.getByRole('radio', { name: 'M' }).click();
    expect(await page.locator('#f').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(true);
  });

  test('choosing a chip never changes its size or moves its neighbours', async ({ page }) => {
    await mount(page, SLOTS);
    const boxes = () => page.locator('tr-chip').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10).join(','); }));
    const before = await boxes();
    await page.getByRole('radio', { name: '10:30' }).click();
    await page.waitForTimeout(450);
    expect(await boxes()).toEqual(before);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `${SLOTS}<tr-chip-group label="Labels"><tr-chip removable>Bug</tr-chip><tr-chip removable>Design</tr-chip></tr-chip-group><tr-chip id="t">Open now</tr-chip>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('tr-chip', () => {
  test('on its own it is a toggle button', async ({ page }) => {
    await mount(page, `<tr-chip id="t">Open now</tr-chip>`);
    const t = page.getByRole('button', { name: 'Open now' });
    await expect(t).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => document.getElementById('t')!.addEventListener('change', () => ((window as any).changed = ((window as any).changed ?? 0) + 1)));
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'true');
    await t.focus();
    await page.keyboard.press('Enter');
    await expect(t).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => (window as any).changed)).toBe(2);
  });

  test('removable: the × key removes it, neighbours glide, focus moves on, removed fires', async ({ page }) => {
    await mount(page, `<tr-chip-group id="g" label="Labels"><tr-chip removable id="a">Bug</tr-chip><tr-chip removable id="b">Design</tr-chip><tr-chip removable id="c">Docs</tr-chip></tr-chip-group>`);
    await expect(page.getByRole('list', { name: 'Labels' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(3);
    await page.evaluate(() => document.getElementById('g')!.addEventListener('removed', (e) => ((window as any).removed = (e.target as HTMLElement).id)));
    await page.getByRole('button', { name: 'Remove Design' }).click();
    await expect(page.locator('#b')).toBeHidden();
    expect(await page.evaluate(() => (window as any).removed)).toBe('b');
    await expect(page.getByRole('button', { name: 'Remove Docs' })).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(page.locator('#c')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Remove Bug' })).toBeFocused();
  });

  test('preventDefault on remove keeps the chip', async ({ page }) => {
    await mount(page, `<tr-chip removable id="a">Bug</tr-chip>`);
    await page.evaluate(() => document.getElementById('a')!.addEventListener('remove', (e) => e.preventDefault()));
    await page.getByRole('button', { name: 'Remove Bug' }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('#a')).toBeVisible();
  });

  test('count cross-fades and keeps the chip in place', async ({ page }) => {
    await mount(page, `<tr-chip id="a" count="9">Results</tr-chip>`);
    await page.locator('#a').evaluate((el: any) => (el.count = '10'));
    await expect(page.locator('#a').locator('[part=count]')).toHaveText('10');
  });
});

test.describe('tr-chip motion', () => {
  const cases: Array<[string, string, (p: Page) => Promise<unknown>]> = [
    ['select another chip', SLOTS, (p) => p.getByRole('radio', { name: '10:30' }).click()],
    [
      'toggle in a multiple group',
      `<tr-chip-group label="Cuisine" multiple><tr-chip>Thai</tr-chip><tr-chip id="t">Italian</tr-chip></tr-chip-group>`,
      (p) => p.click('#t'),
    ],
    ['standalone toggle', `<tr-chip id="t">Open now</tr-chip>`, (p) => p.click('#t')],
    ['hover', SLOTS, (p) => p.getByRole('radio', { name: '10:30' }).hover()],
    [
      'remove with neighbours following',
      `<div style="width:300px"><tr-chip-group label="Labels"><tr-chip removable>Bug</tr-chip><tr-chip removable>Design</tr-chip><tr-chip removable>Documentation</tr-chip><tr-chip removable>Performance</tr-chip><tr-chip removable>Release</tr-chip></tr-chip-group></div><p id="after">Below</p>`,
      (p) => p.getByRole('button', { name: 'Remove Design' }).click(),
    ],
    ['count changes', `<tr-chip id="t" count="9">Results</tr-chip>`, (p) => p.locator('#t').evaluate((el: any) => (el.count = '12'))],
    ['becomes disabled', SLOTS, (p) => p.locator('tr-chip').first().evaluate((el) => el.setAttribute('disabled', ''))],
  ];
  for (const [name, markup, trigger] of cases) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await mount(page, markup);
      const dir = process.env.TROMPE_MOTION_FRAMES;
      const m = await measureChange(page, trigger, {
        clip: { x: 0, y: 0, width: 800, height: 600 },
        saveFrames: dir ? (f: Record<string, string>) => { for (const [k, v] of Object.entries(f)) writeFileSync(`${dir}/chip-${name.replace(/\W+/g, '-')}.${k}.png`, Buffer.from(v, 'base64')); } : undefined,
      });
      expect(motionProblems(m), JSON.stringify(m, null, 1)).toEqual([]);
    });
  }
});
