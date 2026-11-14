import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the Vite dev server. Each test opens tests/fixture.html (which loads
 * every component from source) and injects the markup it needs; see tests/helpers.ts.
 * Visual snapshots live next to each spec in __screenshots__.
 */
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  // Framework smoke tests need built examples: run them with npm run test:frameworks.
  testIgnore: '**/frameworks.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  // Snapshots are rendered in the pinned Playwright container that CI uses (text rasterizes
  // differently on other machines). Compare them locally with TROMPE_SNAPSHOTS=1, inside
  // mcr.microsoft.com/playwright:v1.63.0-noble. See README, Development.
  ignoreSnapshots: !process.env.CI && !process.env.TROMPE_SNAPSHOTS,
  use: { baseURL: 'http://localhost:5179', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179/tests/fixture.html',
    reuseExistingServer: !process.env.CI,
  },
});
