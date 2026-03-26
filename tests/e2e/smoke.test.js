/**
 * smoke.test.js — E2E smoke tests
 *
 * "Login page" tests run without auth (no storageState needed).
 * "Authenticated" tests require running auth.setup.js first:
 *   npm run test:e2e:setup
 */

const { test, expect } = require('@playwright/test');
const { existsSync } = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '.auth', 'state.json');
const hasAuth = existsSync(AUTH_FILE);

// ── Login page (no auth required) ────────────────────────────────────────────

test.describe('Login page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('app loads and shows StockTake Pro branding', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    // No <title> in index.html — check visible logo text instead
    await expect(page.locator('.logo-t').filter({ hasText: /StockTake/i })).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test('email input and Send OTP button are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#otp-email, input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /send.*otp|get.*otp|send/i })).toBeVisible();
  });

  test('Send OTP button is enabled by default', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /send.*otp|get.*otp|send/i });
    await expect(btn).toBeEnabled();
  });

  test('no JavaScript errors on page load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});

// ── Authenticated session (requires auth.setup.js to have been run) ──────────

test.describe('Authenticated — item master', () => {
  test.use({
    storageState: hasAuth ? AUTH_FILE : { cookies: [], origins: [] },
  });

  test.beforeEach(async () => {
    if (!hasAuth) {
      test.skip(true, 'Run "npm run test:e2e:setup" first to save auth state');
    }
  });

  test('sessions page or detail is visible after login', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('#page-sessions, #page-detail, .mnav-btn, .stab')
    ).toBeVisible({ timeout: 10000 });
  });

  test('items tbody element exists in DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#items-tbody, #sess-tbody', { timeout: 10000 });
  });

  test('navigation buttons are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mnav-btn, .nav-btn').first()).toBeVisible({ timeout: 10000 });
  });

  test('item status filter dropdown exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#item-status-filter', { timeout: 10000 });
    await expect(page.locator('#item-status-filter')).toBeVisible();
  });
});
