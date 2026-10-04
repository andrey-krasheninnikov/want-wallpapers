import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const output = join(tmpdir(), 'want-wallpapers-ui');

export default defineConfig({
  testDir: './tests/ui',
  outputDir: join(output, 'results'),
  reporter: [['list'], ['html', { outputFolder: join(output, 'report'), open: 'never' }]],
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
