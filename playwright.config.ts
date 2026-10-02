import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  outputDir: '/private/tmp/want-wallpapers-ui/results',
  reporter: [['list'], ['html', { outputFolder: '/private/tmp/want-wallpapers-ui/report', open: 'never' }]],
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
    command: 'bunx --bun astro build --outDir /private/tmp/want-wallpapers-ui/site && bunx --bun astro preview --outDir /private/tmp/want-wallpapers-ui/site --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      PUBLIC_FIREBASE_PROJECT_ID: 'demo-want-wallpapers',
      PUBLIC_FIREBASE_API_KEY: 'demo-key',
      PUBLIC_FIREBASE_APP_ID: '1:123:web:test',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-want-wallpapers.firebaseapp.com',
      PUBLIC_FIREBASE_MEASUREMENT_ID: '',
      PUBLIC_RECAPTCHA_SITE_KEY: '',
    },
  },
});
