import { expect, test } from '@playwright/test';

test('unauthenticated user is blocked from dashboard and sees login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Sign in to access your resumes, cover letters, saved jobs, and application tracker.')).toBeVisible();
});

