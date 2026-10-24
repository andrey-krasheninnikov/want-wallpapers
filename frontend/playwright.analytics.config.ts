import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import preview from './playwright.ui-kit.config';

export default defineConfig({
  ...preview,
  testMatch: 'analytics.spec.ts',
  outputDir: join(tmpdir(), 'want-wallpapers-ui', 'analytics', 'results'),
  use: { ...preview.use, baseURL: 'http://127.0.0.1:4387', trace: 'off' },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 4387',
    env: { PUBLIC_FIREBASE_API_KEY: 'test-key', PUBLIC_FIREBASE_PROJECT_ID: 'test-project', PUBLIC_FIREBASE_APP_ID: '1:111:web:test', PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-TEST', PUBLIC_HILLTOP_VAST_ENABLED: 'false' },
    url: 'http://127.0.0.1:4387/search/', reuseExistingServer: false, timeout: 60000,
  },
});
