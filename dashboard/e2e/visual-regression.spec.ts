/**
 * E2E Tests - Visual Regression
 * 
 * Screenshot-based visual regression tests.
 * Subtask 31.8 - Visual Regression Testing
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('dashboard homepage screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-home.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 15000,
    });
  });

  test('responsive layout - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 15000,
    });
  });

  test('responsive layout - tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 15000,
    });
  });

  test('responsive layout - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 15000,
    });
  });
});
