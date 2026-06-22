import { expect, test } from '@playwright/test';

test('unauthenticated user is blocked from dashboard and sees login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Sign in to access your resumes, cover letters, saved jobs, and application tracker.')).toBeVisible();
});

test('demo/local sessions can open dashboard without backend token validation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('redresumes_user', JSON.stringify({
      id: 'local-demo-candidate',
      email: 'candidate@example.com',
      name: 'Demo Candidate',
      role: 'candidate',
    }));
    window.localStorage.setItem('redresumes_access_token', 'local-demo-token');
    window.sessionStorage.setItem('redresumes_access_token', 'local-demo-token');
  });

  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid or expired token' }),
    });
  });

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo Candidate' })).toBeVisible();
});

test('dashboard profile phone accepts only 10 digits', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('redresumes_user', JSON.stringify({
      id: 'local-demo-candidate',
      email: 'candidate@example.com',
      name: 'Demo Candidate',
      role: 'candidate',
      phone: '+1 (555) 123-4567',
    }));
    window.localStorage.setItem('redresumes_access_token', 'local-demo-token');
    window.sessionStorage.setItem('redresumes_access_token', 'local-demo-token');
  });

  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid or expired token' }),
    });
  });

  await page.goto('/dashboard');

  const phoneInput = page.getByLabel('Profile phone number');
  await expect(phoneInput).toHaveValue('1555123456');

  await phoneInput.fill('abc9876543210123xyz');

  await expect(phoneInput).toHaveValue('9876543210');
});
