import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    // Step 1: one-time login — run manually to save auth state
    {
      name: 'setup',
      testMatch: 'auth.setup.js',
      use: { headless: false },   // headed so you can type OTP
    },
    // Step 2: smoke tests — run headless using saved auth state (if it exists)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // storageState is injected per-test in smoke.test.js when auth file exists
      },
      dependencies: [],
    },
  ],
  webServer: {
    command: 'npx vite',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
