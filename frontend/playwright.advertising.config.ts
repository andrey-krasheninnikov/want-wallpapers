import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import uiKit from './playwright.ui-kit.config';

export default defineConfig({
  ...uiKit,
  testDir: './tests/ui',
  testMatch: 'advertising-integration.spec.ts',
  expect: { timeout: 15000 },
  outputDir: join(tmpdir(), 'want-wallpapers-advertising', 'results'),
  use: { ...uiKit.use, baseURL: 'http://127.0.0.1:4346' },
  webServer: { command: 'bun run dev --host 127.0.0.1 --port 4346', url: 'http://127.0.0.1:4346/ui-kit/', reuseExistingServer: false, timeout: 60000 },
});
