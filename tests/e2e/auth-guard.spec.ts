import { expect, test } from '@playwright/test';

test('unauthenticated user is blocked from dashboard and sees login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard$/);
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

test('student can view every interview, renew expired access, and explicitly log out', async ({ page }) => {
  const student = { id: 'student-history', email: 'student@example.com', name: 'Test Student', role: 'student', credits: 5 };
  const interviews = Array.from({ length: 8 }, (_, index) => ({
    id: `interview-${index + 1}`,
    targetRole: `Practice Role ${index + 1}`,
    companyType: 'Product',
    createdAt: '2026-11-20T08:00:00.000Z',
    report: { overallScore: 80 },
  }));
  let refreshes = 0;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') {
      refreshes++;
      await route.fulfill({ json: { accessToken: 'renewed-student-access' } });
    } else if (path === '/api/auth/logout') {
      await route.fulfill({ status: 204 });
    } else if (route.request().headers().authorization !== 'Bearer renewed-student-access') {
      await route.fulfill({ status: 401, json: { message: 'Invalid or expired token' } });
    } else if (path === '/api/users/me') {
      await route.fulfill({ json: student });
    } else if (path === '/api/interview/history') {
      await route.fulfill({ json: interviews });
    } else if (path === '/api/credits/transactions') {
      await route.fulfill({ json: { balance: 5, transactions: [] } });
    } else {
      await route.fulfill({ status: 404, json: { message: 'Not found' } });
    }
  });
  await page.goto('/login');
  await page.evaluate(user => {
    window.localStorage.setItem('redresumes_user', JSON.stringify(user));
    window.localStorage.setItem('redresumes_access_token', 'expired-student-access');
    window.sessionStorage.setItem('redresumes_access_token', 'expired-student-access');
  }, student);
  await page.goto('/dashboard');
  await expect(page.getByText(/^Practice Role \d+$/)).toHaveCount(5);
  const viewAll = page.getByRole('button', { name: 'View all interviews (8)', exact: true });
  await expect(viewAll).toHaveAttribute('aria-expanded', 'false');
  await viewAll.click();
  await expect(page.getByText(/^Practice Role \d+$/)).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Show fewer interviews' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Show fewer interviews' }).click();
  await expect(page.getByText(/^Practice Role \d+$/)).toHaveCount(5);
  await viewAll.click();
  await page.getByText('Practice Role 8', { exact: true }).click();
  await expect(page).toHaveURL(/\/interview\/report\/interview-8$/);
  await page.goto('/dashboard');
  await expect(page.getByText(/^Practice Role \d+$/)).toHaveCount(5);
  expect(refreshes).toBe(1);
  expect(await page.evaluate(() => window.localStorage.getItem('redresumes_access_token'))).toBe('renewed-student-access');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => window.localStorage.getItem('redresumes_user'))).toBeNull();
  expect(await page.evaluate(() => window.localStorage.getItem('redresumes_access_token'))).toBeNull();
  expect(await page.evaluate(() => window.sessionStorage.getItem('redresumes_access_token'))).toBeNull();
});
