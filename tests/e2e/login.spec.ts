import { expect, test } from '@playwright/test';

test('login page renders and validates email input', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.locator('button.w-full', { hasText: 'Sign in' }).click();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
});
