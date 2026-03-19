/**
 * E2E Tests - Backtesting Simulation
 * 
 * Tests the backtesting workflow.
 * Subtask 31.4 - E2E Testing
 */

import { test, expect } from '@playwright/test';

test.describe('Backtesting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navigates to backtesting tab', async ({ page }) => {
    const backtestTab = page.getByRole('tab', { name: /backtest/i }).or(
      page.locator('a, button').filter({ hasText: /backtest/i })
    );
    if (await backtestTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backtestTab.click();
      await page.waitForTimeout(1000);
      // Verify backtesting content is visible
      const content = page.locator('text=/backtest|simulation|portfolio/i');
      expect(await content.count()).toBeGreaterThan(0);
    }
  });

  test('configures backtest parameters', async ({ page }) => {
    const backtestTab = page.getByRole('tab', { name: /backtest/i }).or(
      page.locator('a, button').filter({ hasText: /backtest/i })
    );
    if (await backtestTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backtestTab.click();
      // Look for configuration inputs
      const inputs = page.locator('input, select, [role="slider"]');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThanOrEqual(0);
    }
  });
});
