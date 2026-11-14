import type { Page } from '@playwright/test';

/**
 * Opens the fixture page, injects `markup` into <main id="root">, and waits for every Trompe
 * element in it to finish its first render.
 */
export async function mount(page: Page, markup: string, opts: { theme?: 'light' | 'dark' } = {}): Promise<void> {
  await page.goto('/tests/fixture.html');
  await page.waitForFunction(() => (window as unknown as { trompeReady?: boolean }).trompeReady === true);
  await page.evaluate(
    async ({ markup, theme }) => {
      if (theme) document.documentElement.dataset.trTheme = theme;
      const root = document.getElementById('root')!;
      root.innerHTML = markup;
      const els = [...root.querySelectorAll('*')].filter((el) => el.tagName.startsWith('TR-')) as Array<
        HTMLElement & { updateComplete?: Promise<unknown> }
      >;
      await Promise.all(els.map((el) => el.updateComplete));
    },
    { markup, theme: opts.theme },
  );
}
