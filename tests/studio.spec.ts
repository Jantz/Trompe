import { expect, test, type Page } from '@playwright/test';

/**
 * Trompe Studio: the live skin editor (studio/index.html). Checks the main flows work end to end
 * and that none of them shifts the layout (the editor must never jump while you work).
 */

declare global {
  interface Window {
    __cls: number;
    __shifts: string[];
  }
}

test.describe.configure({ timeout: 60_000 });

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    localStorage.clear();
    window.__cls = 0;
    window.__shifts = [];
    type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null }[] };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Shift[]) {
        if (e.hadRecentInput) continue;
        // The preview reflowing because the skin changed (new type, radii, device width) is the
        // point of the tool; what must never move is the editor around it.
        const frame = document.getElementById('frame');
        const known = (e.sources ?? []).filter((s) => s.node); // nodes inside shadow roots come back null
        const inPreview = !!frame && known.every((s) => s.node === frame || frame.contains(s.node!));
        if (inPreview && document.querySelector('#studio[data-ready]')) continue;
        window.__cls += e.value;
        const nodes = (e.sources ?? []).map((s) => (s.node instanceof Element ? `${s.node.localName}${s.node.id ? '#' + s.node.id : ''}.${s.node.className}` : s.node?.nodeName));
        window.__shifts.push(`${e.value.toFixed(4)} @${Math.round(e.startTime - ((window as any).__mark ?? 0))}ms after ${(window as any).__step ?? ''}: ${nodes.join(', ')}`);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/');
  await page.waitForSelector('#studio[data-ready]');
  return errors;
}

/** The code view cross-fades when its content changes; wait for the new text. */
const settled = async (page: Page) => {
  await page.waitForTimeout(50);
  await page.waitForFunction(() => !document.querySelector('#export-code')!.hasAttribute('data-swap'));
};

const exported = async (page: Page, format: 'json' | 'css' | 'agent') => {
  await page.click('#export');
  await expect(page.locator('#export-sheet')).toHaveJSProperty('open', true);
  await page.click(`#export-format tr-option[value=${format}]`);
  await settled(page);
  const text = (await page.locator('#export-code').textContent()) ?? '';
  await page.keyboard.press('Escape');
  await expect(page.locator('#export-sheet')).toHaveJSProperty('open', false);
  return text;
};

test('boots without errors or layout shift', async ({ page }) => {
  const errors = await open(page);
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.01);
  await expect(page.locator('#frame .screen[data-active]')).toHaveCount(1);
  await expect(page.locator('#check-pill')).toHaveAttribute('data-state', 'ok');
});

test('describe -> skin -> export, with undo, and no layout shift', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => ((window.__cls = 0), (window.__shifts = [])));

  await page.fill('#describe-text', 'walnut panels with brushed brass knobs, amber accent, low evening light');
  await page.click('#panel-describe tr-button[tone=accent]');
  await page.waitForTimeout(500);
  const skin = JSON.parse(await exported(page, 'json'));
  expect(skin.elements['tr-panel'].texture).toBeTruthy();
  expect(skin.elements['tr-knob'].material).toBe('metal');
  await expect(page.locator('#check-pill')).toHaveAttribute('data-state', 'ok');

  // The preview really uses the skin: panels carry the wood texture.
  const tex = await page.locator('#frame .screen[data-active] tr-panel').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--tr-m-texture'));
  expect(tex).toContain('data:image/svg+xml');

  const css = await exported(page, 'css');
  expect(css).toContain(`[data-tr-skin='${skin.name}']`);
  expect(await exported(page, 'agent')).toContain(skin.name);

  // Screens and devices switch with animation, never a jump.
  for (const s of ['dashboard', 'files', 'checkout', 'home', 'kit', 'settings']) {
    await page.click(`#screen-picker tr-option[value=${s}]`);
    await expect(page.locator(`#frame .screen[data-screen=${s}][data-active]`)).toHaveCount(1);
  }
  await page.click('#device tr-option[value=phone]');
  await expect(page.locator('#frame')).toHaveAttribute('data-device', 'phone');
  await page.click('#device tr-option[value=desktop]');
  await page.waitForTimeout(700);

  await page.click('#undo');
  await page.waitForTimeout(400);
  const before = JSON.parse(await exported(page, 'json'));
  expect(before.name).toBe('library'); // the starting example
  await page.click('#redo');
  await page.waitForTimeout(400);
  expect(JSON.parse(await exported(page, 'json'))).toEqual(skin);

  expect(await page.evaluate(() => window.__cls), (await page.evaluate(() => window.__shifts)).join('\n')).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('inspector edits the clicked control and share links round-trip', async ({ page }) => {
  await open(page);
  await page.click('#screen-picker tr-option[value=kit]');
  await page.click('#inspect');
  const target = page.locator('#frame .screen[data-active] tr-button[tone=accent]').first();
  await target.hover();
  await expect(page.locator('#inspect-box')).toHaveAttribute('data-on', '');
  await target.click();
  await expect(page.locator('#panel-materials')).toBeVisible();
  await page.locator('#panel-materials .swatch').nth(1).click();
  await page.waitForTimeout(800); // the share link updates shortly after the last edit
  const skin = JSON.parse(await exported(page, 'json'));
  expect(Object.keys(skin.elements).length).toBeGreaterThan(0);

  // The share URL carries the whole skin.
  const hash = await page.evaluate(() => location.hash);
  expect(hash).toMatch(/^#skin=/);
  const page2 = await page.context().newPage();
  await page2.goto(`/studio/${hash}`);
  await page2.waitForSelector('#studio[data-ready]');
  await page2.click('#export');
  await settled(page2);
  const again = JSON.parse((await page2.locator('#export-code').textContent()) ?? '');
  expect(again).toEqual(skin);
});
