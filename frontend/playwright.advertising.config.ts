import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import runtime from './playwright.config';

export default defineConfig({
  ...runtime,
  testMatch: 'advertising-integration.spec.ts',
  testIgnore: [],
  workers: 1,
  fullyParallel: false,
  outputDir: join(tmpdir(), 'want-wallpapers-ui', 'advertising', 'results'),
  reporter: 'list',
  use: { ...runtime.use, trace: 'off' },
});
