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

/**
 * Opens a blank page on the dev server and imports one source module, so only what that module
 * (and its imports) defines is registered. Resolves to the defined state of each tag in `tags`.
 */
export async function importAlone(page: Page, modulePath: string, tags: string[]): Promise<Record<string, boolean>> {
  await page.route('**/tests/blank.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body><main id="root"></main></body></html>' }),
  );
  await page.goto('/tests/blank.html');
  return page.evaluate(
    async ({ modulePath, tags }) => {
      await import(/* @vite-ignore */ modulePath);
      return Object.fromEntries(tags.map((t) => [t, !!customElements.get(t)]));
    },
    { modulePath, tags },
  );
}
