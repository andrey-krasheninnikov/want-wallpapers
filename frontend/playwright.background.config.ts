import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import uiKit from './playwright.ui-kit.config';

export default defineConfig(uiKit, {
  testDir: './tests/ui',
  testMatch: 'background-motion.spec.ts',
  outputDir: join(tmpdir(), 'want-wallpapers-background', 'results'),
});
