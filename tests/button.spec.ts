import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-button', () => {
  test('exposes role, name and pressed state', async ({ page }) => {
    await mount(page, `<tr-button>Save</tr-button><tr-button toggle pressed>Mute</tr-button>`);
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mute' })).toHaveAttribute('pressed', '');
    const ariaPressed = await page.getByRole('button', { name: 'Mute', pressed: true }).count();
    expect(ariaPressed).toBe(1);
  });

  test('activates with click, Enter and Space', async ({ page }) => {
    await mount(page, `<tr-button id="b">Go</tr-button>`);
    await page.evaluate(() => {
      (window as any).clicks = 0;
      document.getElementById('b')!.addEventListener('click', () => (window as any).clicks++);
    });
    const b = page.getByRole('button', { name: 'Go' });
    await b.click();
    await b.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => (window as any).clicks)).toBe(3);
  });

  test('toggle flips pressed and fires change', async ({ page }) => {
    await mount(page, `<tr-button toggle id="t">Solo</tr-button>`);
    await page.evaluate(() => {
      (window as any).changes = 0;
      document.getElementById('t')!.addEventListener('change', () => (window as any).changes++);
    });
    await page.getByRole('button', { name: 'Solo' }).click();
    await expect(page.locator('#t')).toHaveAttribute('pressed', '');
    expect(await page.evaluate(() => (window as any).changes)).toBe(1);
  });

  test('disabled is not focusable and does not click', async ({ page }) => {
    await mount(page, `<tr-button disabled id="d">Nope</tr-button>`);
    await page.evaluate(() => {
      (window as any).clicks = 0;
      document.getElementById('d')!.addEventListener('click', () => (window as any).clicks++);
    });
    await page.locator('#d').click({ force: true });
    expect(await page.evaluate(() => (window as any).clicks)).toBe(0);
    expect(await page.locator('#d').getAttribute('tabindex')).toBeNull();
  });

  test('submits its form', async ({ page }) => {
    await mount(page, `<form id="f"><input name="q" value="x"><tr-button type="submit" name="action" value="save">Send</tr-button></form>`);
    const data = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const f = document.getElementById('f') as HTMLFormElement;
          f.addEventListener('submit', (e) => {
            e.preventDefault();
            resolve(new URLSearchParams(new FormData(f) as any).toString());
          });
          (document.querySelector('tr-button') as HTMLElement).click();
        }),
    );
    expect(data).toBe('q=x&action=save');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, `<tr-button>One</tr-button><tr-button tone="accent">Two</tr-button><tr-button shape="circle" aria-label="Play">▶</tr-button>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: materials, finishes and profiles', async ({ page }) => {
    await mount(
      page,
      `<div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px">
        <tr-button>Plastic</tr-button><tr-button tone="accent">Accent</tr-button>
        <tr-button material="metal">Metal</tr-button><tr-button material="chrome" profile="bevel">Chrome</tr-button>
        <tr-button material="rubber" finish="gloss" shape="pill">Gloss</tr-button>
        <tr-button shape="circle" profile="dome" finish="gloss" tone="accent" aria-label="Play">▶</tr-button>
        <tr-button toggle pressed>Latched</tr-button><tr-button realism="flat">Flat</tr-button>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('button-matrix.png');
  });
});
