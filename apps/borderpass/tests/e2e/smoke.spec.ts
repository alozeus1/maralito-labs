import { test, expect } from '@playwright/test';

// Phase 0 smoke: welcome renders + brand attribution present.
test('welcome shows brand + powered-by', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'BorderPass' })).toBeVisible();
  await expect(page.getByText('Powered by Maralito Labs')).toBeVisible();
});
