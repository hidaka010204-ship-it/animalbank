import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/nav.spec.ts',
  timeout: 600000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:8081',
    screenshot: 'on',
    video: 'off',
    headless: true,
    launchOptions: {
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--renderer-process-limit=1',
        '--memory-pressure-off',
        '--js-flags=--max-old-space-size=384',
      ],
    },
  },
  outputDir: 'tests/screenshots',
  projects: [
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'] },
    },
  ],
});
