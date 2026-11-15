import { test, expect, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';
// @ts-expect-error plain ESM module shared with the CLI
import { measureChange, motionProblems } from '../cli/check/motion.mjs';

/** Mounts markup after loading the file-drop module (it may not be in the main bundle yet). */
async function mountDrop(page: Page, markup: string, theme?: 'light' | 'dark') {
  await mount(page, '', theme ? { theme } : {});
  await page.evaluate(async (markup) => {
    await import(/* @vite-ignore */ '/src/components/file-drop/file-drop.ts');
    await customElements.whenDefined('tr-file-drop');
    const root = document.getElementById('root')!;
    root.innerHTML = markup;
    await Promise.all([...root.querySelectorAll('*')].filter((el) => el.tagName.startsWith('TR-')).map((el) => (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete));
  }, markup);
}

const file = (name: string, type: string, size: number) => ({ name, mimeType: type, buffer: Buffer.alloc(size, 1) });

/** Drops files on an element by dispatching drag events with a real DataTransfer. */
async function drop(page: Page, sel: string, files: Array<{ name: string; type: string; size: number }>, { only = false } = {}) {
  await page.evaluate(
    ({ sel, files, only }) => {
      const el = document.querySelector(sel)!;
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(new File([new Uint8Array(f.size)], f.name, { type: f.type }));
      const opts = { bubbles: true, composed: true, cancelable: true, dataTransfer: dt };
      el.dispatchEvent(new DragEvent('dragenter', opts));
      el.dispatchEvent(new DragEvent('dragover', opts));
      if (!only) el.dispatchEvent(new DragEvent('drop', opts));
    },
    { sel, files, only },
  );
}

const names = (page: Page, sel = '#d') => page.locator(sel).evaluate((el: HTMLElement & { files: File[] }) => el.files.map((f) => f.name));

test.describe('tr-file-drop', () => {
  test('the tray is a button named by the label, described by the hint', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Receipt" hint="A PDF or photo." accept=".pdf,image/*" max-size="10MB"></tr-file-drop>');
    const tray = page.getByRole('button', { name: /Receipt/ });
    await expect(tray).toBeVisible();
    await expect(tray).toHaveAccessibleName(/^Receipt Drop a file here or choose one/);
    await expect(tray).toHaveAccessibleDescription('A PDF or photo.');
    await expect(page.locator('#d')).toContainText('PDF or image, up to 10 MB');
  });

  test('Enter and Space open the file picker; a pick adds the file and fires change', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Receipt" name="receipt"></tr-file-drop>');
    await page.evaluate(() => document.querySelector('#d')!.addEventListener('change', (e) => ((window as unknown as { got: string[] }).got = (e as CustomEvent).detail.files.map((f: File) => f.name))));
    // Listen before the key press: Playwright turns on file chooser interception asynchronously.
    const first = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Receipt/ }).focus();
    await page.keyboard.press('Enter');
    const chooser = await first;
    expect(chooser.isMultiple()).toBe(false);
    await chooser.setFiles([file('taxi.pdf', 'application/pdf', 2048)]);
    await expect(page.getByRole('listitem')).toContainText('taxi.pdf');
    await expect(page.getByRole('listitem')).toContainText('2 KB');
    expect(await page.evaluate(() => (window as unknown as { got: string[] }).got)).toEqual(['taxi.pdf']);
    const second = page.waitForEvent('filechooser');
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.keyboard.press(' ');
    const again = await second;
    await again.setFiles([file('hotel.pdf', 'application/pdf', 10)]);
    // single: a new file replaces the old one
    expect(await names(page)).toEqual(['hotel.pdf']);
  });

  test('multiple: picks and drops add up; remove takes one out and keeps focus in the list', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Attachments" multiple></tr-file-drop>');
    await page.locator('#d input[type=file]').setInputFiles([file('a.png', 'image/png', 10), file('b.png', 'image/png', 10)]);
    await drop(page, '#d', [{ name: 'c.txt', type: 'text/plain', size: 5 }]);
    expect(await names(page)).toEqual(['a.png', 'b.png', 'c.txt']);
    let removed = '';
    await page.exposeFunction('onRemove', (n: string) => (removed = n));
    await page.evaluate(() => document.querySelector('#d')!.addEventListener('remove', (e) => (window as unknown as { onRemove(n: string): void }).onRemove((e as CustomEvent).detail.file.name)));
    await page.getByRole('button', { name: 'Remove b.png' }).click();
    await expect.poll(() => names(page)).toEqual(['a.png', 'c.txt']);
    expect(removed).toBe('b.png');
    await expect(page.getByRole('button', { name: 'Remove c.txt' })).toBeFocused();
  });

  test('drag over lights the tray and says "Drop to add"; a wrong type is refused while dragging', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Photo" accept="image/*"></tr-file-drop>');
    await drop(page, '#d', [{ name: 'p.jpg', type: 'image/jpeg', size: 1 }], { only: true });
    await expect(page.locator('#d')).toHaveAttribute('data-drag', 'over');
    await expect(page.locator('#d .over')).toHaveText('Drop to add');
    await page.locator('#d').evaluate((el) => el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, composed: true })));
    await expect(page.locator('#d')).not.toHaveAttribute('data-drag', /.*/);
    await drop(page, '#d', [{ name: 'x.zip', type: 'application/zip', size: 1 }], { only: true });
    await expect(page.locator('#d')).toHaveAttribute('data-drag', 'invalid');
  });

  test('refuses wrong types, files over max-size and more than max-files, and says why', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Receipts" multiple max-files="2" accept=".pdf,image/*" max-size="1KB"></tr-file-drop>');
    await drop(page, '#d', [{ name: 'notes.zip', type: 'application/zip', size: 10 }]);
    await expect(page.locator('#d [part=error]')).toContainText('“notes.zip” isn’t a PDF or image file.');
    expect(await names(page)).toEqual([]);
    await drop(page, '#d', [{ name: 'big.pdf', type: 'application/pdf', size: 4096 }]);
    await expect(page.locator('#d [part=error]')).toContainText('“big.pdf” is 4 KB; the limit is 1 KB.');
    await drop(page, '#d', [
      { name: '1.pdf', type: 'application/pdf', size: 10 },
      { name: '2.png', type: 'image/png', size: 10 },
      { name: '3.png', type: 'image/png', size: 10 },
    ]);
    expect(await names(page)).toEqual(['1.pdf', '2.png']);
    await expect(page.locator('#d [part=error]')).toContainText('You can add up to 2 files.');
    await expect(page.getByRole('button', { name: /Receipts/ })).toHaveAttribute('aria-invalid', 'true');
  });

  test('submits its files with the form, requires one when required, and resets', async ({ page }) => {
    await mountDrop(page, '<form id="f"><tr-file-drop id="d" label="Receipt" name="receipt" required></tr-file-drop><button>Send</button></form>');
    expect(await page.locator('#d').evaluate((el: HTMLElement & { checkValidity(): boolean }) => el.checkValidity())).toBe(false);
    await page.locator('#f').evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect(page.locator('#d')).toHaveAttribute('data-user-invalid', '');
    await expect(page.locator('#d [part=error]')).toContainText('Add a file.');
    await page.locator('#d input[type=file]').setInputFiles([file('taxi.pdf', 'application/pdf', 3)]);
    await expect(page.locator('#d')).not.toHaveAttribute('data-user-invalid', '');
    const entries = await page.locator('#f').evaluate((f: HTMLFormElement) => [...new FormData(f).entries()].map(([k, v]) => [k, (v as File).name, (v as File).size]));
    expect(entries).toEqual([['receipt', 'taxi.pdf', 3]]);
    await page.locator('#f').evaluate((f: HTMLFormElement) => f.reset());
    expect(await names(page)).toEqual([]);
  });

  test('error attribute marks it invalid; disabled ignores drops and clicks', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Receipt" error="Upload failed. Try again."></tr-file-drop><tr-file-drop id="off" label="Off" disabled></tr-file-drop>');
    await expect(page.locator('#d [part=error]')).toContainText('Upload failed. Try again.');
    expect(await page.locator('#d').evaluate((el: HTMLElement & { validity: ValidityState }) => el.validity.customError)).toBe(true);
    await expect(page.getByRole('button', { name: /Off/ })).toBeDisabled();
    await drop(page, '#off', [{ name: 'a.png', type: 'image/png', size: 1 }]);
    expect(await names(page, '#off')).toEqual([]);
  });

  test('files property sets and clears the list', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Files" multiple></tr-file-drop>');
    await page.locator('#d').evaluate((el: HTMLElement & { files: File[] }) => (el.files = [new File(['x'], 'one.txt'), new File(['y'], 'two.txt')]));
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await page.locator('#d').evaluate((el: HTMLElement & { files: File[] }) => (el.files = []));
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('has no axe violations, with files and an error', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" label="Receipts" multiple hint="PDF or photo." error="One file failed."></tr-file-drop><tr-file-drop compact aria-label="Receipt for line 1"></tr-file-drop>');
    await page.locator('#d input[type=file]').setInputFiles([file('a.pdf', 'application/pdf', 10)]);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('compact is one line at control height', async ({ page }) => {
    await mountDrop(page, '<tr-file-drop id="d" compact aria-label="Receipt" style="width:320px"></tr-file-drop>');
    const h = await page.locator('#d').evaluate((el) => el.shadowRoot!.querySelector('.tray')!.getBoundingClientRect().height);
    expect(h).toBeLessThan(48);
    await expect(page.getByRole('button', { name: 'Receipt' })).toBeVisible();
  });

  test.describe('motion', () => {
    const AFTER = '<p id="after" style="margin:16px 0 0">Content below</p>';
    const measure = async (page: Page, trigger: (p: Page) => Promise<unknown>, wait?: number) => {
      const dir = process.env.TROMPE_MOTION_FRAMES;
      const m = await measureChange(page, trigger, {
        clip: { x: 0, y: 0, width: 800, height: 600 },
        wait,
        saveFrames: dir ? (f: Record<string, string>) => { for (const [k, v] of Object.entries(f)) writeFileSync(`${dir}/fd-${test.info().title.replace(/\W+/g, '-')}.${k}.png`, Buffer.from(v, 'base64')); } : undefined,
      });
      return motionProblems(m);
    };
    test.beforeEach(async ({ page }) => page.setViewportSize({ width: 800, height: 600 }));

    test('a file is added', async ({ page }) => {
      await mountDrop(page, `<tr-file-drop id="d" label="Receipt" style="width:420px"></tr-file-drop>${AFTER}`);
      expect(await measure(page, (p) => p.locator('#d').evaluate((el: HTMLElement & { files: File[] }) => (el.files = [new File(['x'], 'taxi-receipt.pdf', { type: 'application/pdf' })])))).toEqual([]);
    });

    test('a file is removed', async ({ page }) => {
      await mountDrop(page, `<tr-file-drop id="d" label="Receipts" multiple style="width:420px"></tr-file-drop>${AFTER}`);
      await page.locator('#d').evaluate((el: HTMLElement & { files: File[] }) => (el.files = [new File(['x'], 'one.pdf'), new File(['y'], 'two.pdf')]));
      await page.waitForTimeout(400);
      expect(await measure(page, (p) => p.getByRole('button', { name: 'Remove one.pdf' }).click())).toEqual([]);
    });

    test('files are dragged over', async ({ page }) => {
      await mountDrop(page, `<tr-file-drop id="d" label="Receipt" style="width:420px"></tr-file-drop>${AFTER}`);
      expect(await measure(page, () => drop(page, '#d', [{ name: 'a.pdf', type: 'application/pdf', size: 1 }], { only: true }))).toEqual([]);
    });

    test('an error appears', async ({ page }) => {
      await mountDrop(page, `<tr-file-drop id="d" label="Receipt" accept="image/*" style="width:420px"></tr-file-drop>${AFTER}`);
      expect(await measure(page, () => drop(page, '#d', [{ name: 'a.zip', type: 'application/zip', size: 1 }]))).toEqual([]);
    });
  });
});
