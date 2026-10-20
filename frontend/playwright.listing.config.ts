import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({ ...base, testMatch: '**/listing.spec.ts', testIgnore: [], workers: 1, fullyParallel: false,
  outputDir: join(tmpdir(), 'want-wallpapers-listing', 'results'), reporter: 'list',
  use: { ...base.use, trace: 'off' },
  webServer: { command: 'python3 ../scripts/ui-server.py', gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 }, url: 'http://127.0.0.1:4322/health/ready', reuseExistingServer: !!process.env.LISTING_REUSE_SERVER, timeout: 120000 },
});
