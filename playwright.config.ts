import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/viewer', timeout: 90_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1152, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node scripts/serve-viewer.mjs --dev', port: 4173, reuseExistingServer: false },
    { command: 'node scripts/serve-viewer.mjs', port: 4174, env: { PORT: '4174' }, reuseExistingServer: false },
  ],
});
