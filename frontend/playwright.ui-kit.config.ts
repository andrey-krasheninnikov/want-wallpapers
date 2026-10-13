import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './tests/dev',
  outputDir: join(tmpdir(), 'want-wallpapers-ui-kit', 'results'),
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4341', browserName: 'chromium', launchOptions: { chromiumSandbox: true }, reducedMotion: 'reduce', screenshot: 'only-on-failure' },
  webServer: { command: 'bun run dev --host 127.0.0.1 --port 4341', url: 'http://127.0.0.1:4341/ui-kit/', reuseExistingServer: false, timeout: 60000 },
});
