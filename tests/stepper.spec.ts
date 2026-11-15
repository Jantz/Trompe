import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
// @ts-expect-error plain ESM module shared with the CLI
import { measureChange, motionProblems } from '../cli/check/motion.mjs';

/**
 * tr-stepper is not exported from src/index.ts yet, so this mount imports its module before
 * putting the markup in the fixture.
 */
async function mount(page: Page, markup: string): Promise<void> {
  await page.goto('/tests/fixture.html');
  await page.waitForFunction(() => (window as unknown as { trompeReady?: boolean }).trompeReady === true);
  await page.evaluate(async (markup) => {
    await import(/* @vite-ignore */ '/src/components/stepper/stepper.ts');
    const root = document.getElementById('root')!;
    root.innerHTML = markup;
    const els = [...root.querySelectorAll('*')].filter((el) => el.tagName.startsWith('TR-')) as Array<
      HTMLElement & { updateComplete?: Promise<unknown> }
    >;
    await Promise.all(els.map((el) => el.updateComplete));
    // first placement settles over two frames (snap in place, then mark the steps ready)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  }, markup);
}

const STEPS =
  '<tr-step value="svc">Service<span slot="description">What you need</span></tr-step>' +
  '<tr-step value="who">Clinician</tr-step>' +
  '<tr-step value="when">Date and time</tr-step>' +
  '<tr-step value="you">Your details</tr-step>' +
  '<tr-step value="ok">Review</tr-step>';

const wrap = (attrs: string, steps = STEPS, width = 760) => `<div style="width:${width}px;padding:16px"><tr-stepper id="s" ${attrs}>${steps}</tr-stepper></div>`;

type Stepper = HTMLElement & { current: number; value: string; updateComplete: Promise<unknown>; next(): void; previous(): void };

const states = (page: Page) => page.$$eval('#s tr-step', (els) => els.map((e) => e.getAttribute('data-state')));
const settle = (page: Page) => page.evaluate(() => (document.getElementById('s') as unknown as Stepper).updateComplete);

test.describe('tr-stepper', () => {
  test('is a list of steps; the current one has aria-current="step"', async ({ page }) => {
    await mount(page, wrap('current="2" label="Booking"'));
    await expect(page.getByRole('list', { name: 'Booking' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(5);
    expect(await states(page)).toEqual(['complete', 'complete', 'current', 'upcoming', 'upcoming']);
    await expect(page.locator('#s tr-step[aria-current="step"]')).toHaveText(/Date and time/);
    await expect(page.locator('#s tr-step[aria-current]')).toHaveCount(1);
    // completed and failing steps say so to screen readers
    await expect(page.locator('#s tr-step').nth(0).locator('.sr')).toHaveText(', completed');
    await page.evaluate(() => document.querySelector('#s tr-step[value="when"]')!.setAttribute('error', ''));
    await expect(page.locator('#s tr-step').nth(2).locator('.sr')).toHaveText(', needs attention');
    await expect(page.locator('#s tr-step').nth(2)).toHaveAttribute('error', '');
  });

  test('value and current stay in step', async ({ page }) => {
    await mount(page, wrap('value="you"'));
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(3);
    await page.evaluate(() => ((document.getElementById('s') as unknown as Stepper).current = 1));
    await settle(page);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).value)).toBe('who');
    await page.evaluate(() => ((document.getElementById('s') as unknown as Stepper).value = 'ok'));
    await settle(page);
    expect(await states(page)).toEqual(['complete', 'complete', 'complete', 'complete', 'current']);
    // next() past the last step completes them all
    await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).next());
    await settle(page);
    expect(await states(page)).toEqual(['complete', 'complete', 'complete', 'complete', 'complete']);
    await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).previous());
    await settle(page);
    expect(await states(page)).toEqual(['complete', 'complete', 'complete', 'complete', 'current']);
  });

  test('without clickable, steps are not buttons', async ({ page }) => {
    await mount(page, wrap('current="1"'));
    await expect(page.locator('#s').getByRole('button')).toHaveCount(0);
  });

  test('clickable steps fire a cancelable change', async ({ page }) => {
    await mount(page, wrap('current="1" clickable'));
    await page.evaluate(() => {
      const s = document.getElementById('s')!;
      (window as unknown as { log: unknown[] }).log = [];
      s.addEventListener('change', (e) => {
        const d = (e as CustomEvent).detail;
        (window as unknown as { log: unknown[] }).log.push(d);
        if (d.value === 'ok') e.preventDefault();
      });
    });
    await page.getByRole('button', { name: /Date and time/ }).click();
    await settle(page);
    expect(await page.evaluate(() => (window as unknown as { log: unknown[] }).log)).toEqual([{ index: 2, value: 'when', previous: 1 }]);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(2);
    // a cancelled change keeps the current step
    await page.getByRole('button', { name: /Review/ }).click();
    await settle(page);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(2);
    expect(await page.evaluate(() => (window as unknown as { log: unknown[] }).log.length)).toBe(2);
  });

  test('linear mode only lets you go back to steps already reached', async ({ page }) => {
    await mount(page, wrap('current="2" clickable linear'));
    const buttons = page.locator('#s').getByRole('button');
    await expect(buttons.nth(1)).toHaveAttribute('aria-disabled', 'false');
    await expect(buttons.nth(3)).toHaveAttribute('aria-disabled', 'true');
    await buttons.nth(3).click({ force: true });
    await settle(page);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(2);
    // going back keeps the furthest step reached open
    await buttons.nth(0).click();
    await settle(page);
    await expect(buttons.nth(2)).toHaveAttribute('aria-disabled', 'false');
  });

  test('disabled steps cannot be picked or focused by arrows', async ({ page }) => {
    await mount(page, wrap('current="0" clickable', STEPS.replace('<tr-step value="who">', '<tr-step value="who" disabled>')));
    await page.getByRole('button', { name: /Service/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: /Date and time/ })).toBeFocused();
  });

  test('keyboard: one Tab stop, arrows rove, Enter and Space pick', async ({ page }) => {
    await mount(page, `<button id="before">before</button>${wrap('current="1" clickable')}<button id="after">after</button>`);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Clinician/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: /Date and time/ })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('button', { name: /Review/ })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('button', { name: /Service/ })).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // stays at the first
    await expect(page.getByRole('button', { name: /Service/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await settle(page);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await settle(page);
    expect(await page.evaluate(() => (document.getElementById('s') as unknown as Stepper).current)).toBe(2);
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: /Date and time/ })).toBeFocused();
  });

  test('vertical: up and down arrows move between steps', async ({ page }) => {
    await mount(page, wrap('current="0" clickable orientation="vertical"'));
    await page.getByRole('button', { name: /Service/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: /Clinician/ })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: /Service/ })).toBeFocused();
  });

  test('a narrow container collapses to "Step N of M · Label" with a progress bar', async ({ page }) => {
    await mount(page, wrap('current="1"', STEPS, 320));
    const s = page.locator('#s');
    await expect(s).toHaveAttribute('data-compact', '');
    await expect(page.getByRole('status')).toHaveText('Step 2 of 5 · Clinician');
    const bar = page.getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '2');
    await expect(bar).toHaveAttribute('aria-valuemax', '5');
    // the full list leaves the accessibility tree, so it is not read twice
    await expect(page.getByRole('list')).toHaveCount(0);
    // widening brings the row back
    await page.evaluate(() => ((document.querySelector('#root > div') as HTMLElement).style.width = '760px'));
    await expect(s).not.toHaveAttribute('data-compact', '');
    await expect(page.getByRole('list')).toHaveCount(1);
  });

  test('compact status says when every step is done', async ({ page }) => {
    await mount(page, wrap('current="5" compact'));
    await expect(page.getByRole('status')).toHaveText('All 5 steps complete');
  });

  test('has no axe violations (row, clickable, vertical and compact)', async ({ page }) => {
    await mount(
      page,
      wrap('current="2" label="Booking"', STEPS.replace('<tr-step value="you">', '<tr-step value="you" error>')) +
        `<tr-stepper current="1" clickable label="Signup">${STEPS}</tr-stepper>` +
        `<tr-stepper orientation="vertical" current="1" label="Account">${STEPS}</tr-stepper>` +
        `<tr-stepper compact current="3" label="Checkout">${STEPS}</tr-stepper>`,
    );
    const r = await new AxeBuilder({ page }).include('#root').analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});

test.describe('tr-stepper motion: every change is animated and shift-free', () => {
  const set = (fn: string) => (page: Page) => page.evaluate(fn);
  const scenarios: Array<{ name: string; markup: string; trigger: (p: Page) => Promise<unknown> }> = [
    { name: 'current advances', markup: wrap('current="1"'), trigger: set(`document.getElementById('s').current = 2`) },
    { name: 'current jumps several steps back', markup: wrap('current="4"'), trigger: set(`document.getElementById('s').current = 1`) },
    { name: 'a step becomes complete (last step finished)', markup: wrap('current="4"'), trigger: set(`document.getElementById('s').next()`) },
    { name: 'an error appears', markup: wrap('current="3"'), trigger: set(`document.querySelector('#s tr-step[value="you"]').error = true`) },
    { name: 'collapses to compact', markup: wrap('current="2"'), trigger: set(`document.getElementById('s').compact = true`) },
    { name: 'expands from compact', markup: wrap('current="2" compact'), trigger: set(`document.getElementById('s').compact = false`) },
    { name: 'compact: current advances', markup: wrap('current="1" compact'), trigger: set(`document.getElementById('s').current = 2`) },
    { name: 'vertical: current advances', markup: wrap('current="0" orientation="vertical"'), trigger: set(`document.getElementById('s').current = 1`) },
  ];
  for (const s of scenarios) {
    test(s.name, async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await mount(page, s.markup);
      const dir = process.env.TROMPE_MOTION_FRAMES;
      const m = await measureChange(page, s.trigger, {
        clip: { x: 0, y: 0, width: 800, height: 600 },
        saveFrames: dir
          ? (f: Record<string, string>) => {
              const slug = `stepper-${s.name.replace(/[^a-z0-9]+/gi, '-')}`;
              mkdirSync(dir, { recursive: true });
              for (const [k, v] of Object.entries(f)) writeFileSync(`${dir}/${slug}.${k}.png`, Buffer.from(v, 'base64'));
            }
          : undefined,
      });
      const problems: string[] = motionProblems(m);
      expect(problems, `${s.name}\n${JSON.stringify(m, null, 1)}`).toEqual([]);
    });
  }
});
