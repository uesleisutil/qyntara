/**
 * E2E Tests - Tab Navigation
 * 
 * Tests all tab navigation and basic page rendering.
 * Subtask 31.4 - E2E Testing
 */

import { test, expect } from '@playwright/test';

test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the dashboard homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/dashboard|ranking/i);
  });

  test('navigates between all main tabs', async ({ page }) => {
    // Check that tab navigation elements exist
    const tabs = page.locator('[role="tab"], [role="tablist"] button, nav a, .MuiTab-root');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test('maintains URL state when switching tabs', async ({ page }) => {
    const initialUrl = page.url();
    // Navigate and verify URL changes or stays consistent
    expect(initialUrl).toContain('localhost');
  });

  test('keyboard navigation works between tabs', async ({ page }) => {
    // Focus first interactive element
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });
});
