import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer is a fallback for CI/local when not using the Docker runner.
  // For proper isolation, use: npm run test:e2e
  webServer: {
    command: 'node dist/src/webui/test-server.js',
    port: 8080,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
