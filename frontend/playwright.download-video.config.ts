import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import preview from './playwright.ui-kit.config';

export default defineConfig({
  ...preview,
  testMatch: 'download-video.spec.ts',
  outputDir: join(tmpdir(), 'want-wallpapers-ui', 'download-video', 'results'),
  use: { ...preview.use, baseURL: 'http://127.0.0.1:4386', trace: 'off' },
  webServer: { command: 'bun run dev --host 127.0.0.1 --port 4386', url: 'http://127.0.0.1:4386/ui-kit/download-video/', reuseExistingServer: false, timeout: 60000 },
});
