import { defineConfig, devices } from '@playwright/test';

/**
 * Framework smoke tests: the built examples (examples/<name>/dist, consuming the built "trompe"
 * package) served statically. Run with `npm run test:frameworks`, which builds everything first.
 */
const port = Number(process.env.TROMPE_EXAMPLES_PORT ?? 5291);

export default defineConfig({
  testDir: 'tests',
  testMatch: 'frameworks.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report/frameworks' }]] : 'list',
  outputDir: 'test-results/frameworks',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'frameworks', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/serve-examples.mjs ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
