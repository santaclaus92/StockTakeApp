import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/unit/**', 'jsdom'],
    ],
    testTimeout: 15000,
    include: ['server.test.js', 'tests/unit/**/*.test.{js,ts}'],
    exclude: ['claude-agent-sdk-demos/**', 'tests/e2e/**', 'node_modules/**'],
  },
});
