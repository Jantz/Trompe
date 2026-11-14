import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const DIALOG = `
  <tr-button id="opener">Open</tr-button>
  <tr-dialog id="d">
    <h2 slot="heading">Rename file</h2>
    <p>Choose a new name.</p>
    <input id="name" aria-label="Name" value="report">
    <tr-button slot="footer" id="cancel">Cancel</tr-button>
    <tr-button slot="footer" id="ok" tone="accent">Rename</tr-button>
  </tr-dialog>
  <button id="outside">Outside</button>`;

async function openFrom(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as any).events = [];
    const d = document.getElementById('d')!;
    for (const t of ['open', 'close', 'cancel']) d.addEventListener(t, () => (window as any).events.push(t));
    document.getElementById('opener')!.addEventListener('click', () => (d as any).show());
  });
  await page.locator('#opener').click();
}

test.describe('tr-dialog', () => {
  test('opens modally in the top layer, named by its heading', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    const dlg = page.getByRole('dialog', { name: 'Rename file' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(await page.locator('#d').evaluate((d) => d.shadowRoot!.querySelector('dialog')!.matches(':modal'))).toBe(true);
    await expect(page.locator('#d')).toHaveAttribute('open', '');
    // Focus moves to the first tabbable control in the body.
    await expect(page.locator('#name')).toBeFocused();
    expect(await page.evaluate(() => (window as any).events)).toEqual(['open']);
  });

  test('the page behind is inert', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    await page.locator('#outside').click({ force: true, timeout: 1000 }).catch(() => {});
    await expect(page.locator('#outside')).not.toBeFocused();
    // Tab stays inside the dialog.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const d = document.getElementById('d')!;
        const a = document.activeElement;
        return !a || a === document.body || d.contains(a) || d.shadowRoot!.contains(d.shadowRoot!.activeElement);
      });
      expect(inside).toBe(true);
    }
  });

  test('Escape fires cancel, closes, and returns focus to the opener', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
    await expect(page.locator('#opener')).toBeFocused();
    await expect.poll(() => page.evaluate(() => (window as any).events)).toEqual(['open', 'cancel', 'close']);
  });

  test('cancel can be prevented', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    await page.locator('#d').evaluate((d) => d.addEventListener('cancel', (e) => e.preventDefault()));
    await page.locator('#name').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#d')).toHaveAttribute('open', '');
  });

  test('close(returnValue), close button and the open property', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    await page.locator('#d').evaluate((d: any) => d.close('renamed'));
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
    expect(await page.locator('#d').evaluate((d: any) => d.returnValue)).toBe('renamed');
    await page.locator('#d').evaluate((d: any) => (d.open = true));
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
  });

  test('light-dismiss closes on a backdrop click only', async ({ page }) => {
    await mount(page, DIALOG.replace('<tr-dialog id="d">', '<tr-dialog id="d" light-dismiss>'));
    await openFrom(page);
    await page.locator('#name').click();
    await expect(page.locator('#d')).toHaveAttribute('open', '');
    await page.mouse.click(5, 5);
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => (window as any).events)).toEqual(['open', 'cancel', 'close']);
  });

  test('without light-dismiss a backdrop click does nothing', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    await page.mouse.click(5, 5);
    await expect(page.locator('#d')).toHaveAttribute('open', '');
  });

  test('label, alert role, and form method=dialog', async ({ page }) => {
    await mount(
      page,
      `<tr-dialog id="d" label="Confirm" alert no-close-button>
        <form method="dialog"><p>Sure?</p><button value="no">No</button><button value="yes">Yes</button></form>
      </tr-dialog>`,
    );
    await page.locator('#d').evaluate((d: any) => d.show());
    await expect(page.getByRole('alertdialog', { name: 'Confirm' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
    expect(await page.locator('#d').evaluate((d: any) => d.returnValue)).toBe('yes');
  });

  test('non-modal leaves the page interactive and closes on Escape', async ({ page }) => {
    await mount(page, DIALOG.replace('<tr-dialog id="d">', '<tr-dialog id="d" non-modal>'));
    await openFrom(page);
    await expect(page.locator('#d')).toHaveAttribute('open', '');
    await page.locator('#outside').click();
    await expect(page.locator('#outside')).toBeFocused();
    await page.locator('#name').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#d')).not.toHaveAttribute('open', '');
  });

  test('has no axe violations when open', async ({ page }) => {
    await mount(page, DIALOG);
    await openFrom(page);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: open dialog over the page', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await mount(page, DIALOG);
    await openFrom(page);
    await page.locator('#name').evaluate((el) => (el as HTMLElement).blur());
    await expect(page).toHaveScreenshot('dialog-open.png');
  });

  test('a method="dialog" form submitted by tr-button closes with its value', async ({ page }) => {
    await mount(page, `<tr-dialog id="d" open><h2 slot="heading">Delete?</h2><form method="dialog"><tr-button type="submit" id="ok" value="confirm">OK</tr-button></form></tr-dialog>`);
    await page.evaluate(() => {
      const d = document.getElementById('d') as any;
      d.addEventListener('close', () => ((window as any).rv = d.returnValue));
    });
    await page.click('#ok');
    // The close event follows the native dialog's close task.
    await expect.poll(() => page.evaluate(() => (window as any).rv)).toBe('confirm');
    await expect(page.locator('#d')).not.toHaveAttribute('open');
  });

  test('initial focus lands on a tr-input (delegated focus) before the footer', async ({ page }) => {
    const markup = (attrs: string) =>
      `<tr-dialog id="d"><h2 slot="heading">Name</h2><tr-input id="i" label="Name" ${attrs}></tr-input><tr-textarea id="t" label="Notes"></tr-textarea><tr-button slot="footer" id="ok">OK</tr-button></tr-dialog>`;
    await mount(page, markup(''));
    await page.evaluate(() => (document.getElementById('d') as any).show());
    await expect(page.locator('#i input')).toBeFocused();
    // A disabled delegating host is skipped: the next one (tr-textarea) gets focus.
    await mount(page, markup('disabled'));
    await page.evaluate(() => (document.getElementById('d') as any).show());
    await expect(page.locator('#t textarea')).toBeFocused();
  });
});
