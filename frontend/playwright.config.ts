import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  outputDir: '/tmp/want-wallpapers-ui/results',
  reporter: [['list'], ['html', { outputFolder: '/tmp/want-wallpapers-ui/report', open: 'never' }]],
  workers: 2,
  fullyParallel: true,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:4322',
    browserName: 'chromium',
    launchOptions: { chromiumSandbox: true },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'python3 ../scripts/ui-server.py',
    url: 'http://127.0.0.1:4322/health/ready',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
