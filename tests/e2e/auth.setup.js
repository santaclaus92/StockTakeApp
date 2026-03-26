/**
 * auth.setup.js — ONE-TIME MANUAL AUTH SETUP
 *
 * Run once to save your Supabase session so smoke tests don't need OTP:
 *
 *   npm run test:e2e:setup
 *
 * A real browser will open. Follow the prompts to log in with OTP.
 * Your session is saved to tests/e2e/.auth/state.json (gitignored).
 * Re-run this setup when your session expires (~1 week).
 */

const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const AUTH_FILE = path.join(__dirname, '.auth', 'state.json');

setup('authenticate via OTP', async ({ page }) => {
  await page.goto('/');

  // Wait for login form to appear
  await expect(page.locator('#otp-email, input[type="email"]')).toBeVisible({ timeout: 10000 });

  // ── MANUAL STEPS ─────────────────────────────────────────────────────────
  // 1. The browser pauses here — type your email and click "Send OTP"
  // 2. Check your email inbox for the 6-digit OTP code
  // 3. Enter the OTP in the app and click "Verify"
  // 4. Once the main app loads (you see sessions/nav), click Resume in Playwright
  // ─────────────────────────────────────────────────────────────────────────
  await page.pause();

  // Verify login succeeded — main app nav should be visible
  await expect(
    page.locator('.mnav-btn, .nav-btn, #nav-sessions')
  ).toBeVisible({ timeout: 15000 });

  // Save storage state (localStorage + sessionStorage + cookies)
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`\n✓ Auth state saved to ${AUTH_FILE}\n`);
});
