import { expect, test } from '@playwright/test';

test('selecting a template opens builder with template query', async ({ page }) => {
  await page.goto('/templates');

  const useTemplate = page.getByRole('button', { name: 'Use template' }).first();
  await expect(useTemplate).toBeVisible();
  await useTemplate.click();

  await expect(page).toHaveURL(/\/builder\?template=/);
  await expect(page.getByText('Live Preview')).toBeVisible();
});

test('filled resume draft survives page refresh', async ({ page }) => {
  await page.goto('/builder');

  const fullName = page.getByPlaceholder('Full name');
  const jobTitle = page.getByPlaceholder('Job title');
  const email = page.getByPlaceholder('Email');
  const summary = page.getByPlaceholder('Write a short summary about your experience and impact.');
  const templateSelect = page.locator('#builder-live-preview select');

  await fullName.fill('Riley Persistent');
  await jobTitle.fill('Draft Retention Lead');
  await email.fill('riley.persistence@example.com');
  await summary.fill('This resume draft should survive a full browser refresh without requiring the user to sign in.');
  await templateSelect.selectOption('finance');

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('redresumes_resume_draft_v1:guest');
    return raw?.includes('Riley Persistent') && raw.includes('finance');
  });

  await page.reload();

  await expect(fullName).toHaveValue('Riley Persistent');
  await expect(jobTitle).toHaveValue('Draft Retention Lead');
  await expect(email).toHaveValue('riley.persistence@example.com');
  await expect(summary).toHaveValue(/survive a full browser refresh/);
  await expect(templateSelect).toHaveValue('finance');
  await expect(page.getByTestId('builder-template-preview')).toContainText('Riley Persistent');
});

test('section order updates live preview and downloaded resume', async ({ page }) => {
  // Log in first to satisfy the isLoggedIn check for resume downloads
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill('candidate@example.com');
  await page.getByPlaceholder('Enter your password').fill('Password@123');
  await page.locator('button.w-full', { hasText: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/builder');

  await page.getByTestId('section-order-summary-down').click();
  await page.locator('#builder-live-preview').scrollIntoViewIfNeeded();

  const liveOrder = await page.getByTestId('builder-template-preview').evaluate((element) => {
    const text = element.textContent || '';
    return {
      experienceIndex: text.indexOf('Experience'),
      summaryIndex: text.indexOf('Summary'),
    };
  });

  expect(liveOrder.experienceIndex).toBeGreaterThanOrEqual(0);
  expect(liveOrder.summaryIndex).toBeGreaterThanOrEqual(0);
  expect(liveOrder.experienceIndex).toBeLessThan(liveOrder.summaryIndex);

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');

  const downloadedOrder = await popup.locator('body').evaluate((element) => {
    const text = element.textContent || '';
    return {
      experienceIndex: text.indexOf('Experience'),
      summaryIndex: text.indexOf('Summary'),
    };
  });

  expect(downloadedOrder.experienceIndex).toBeGreaterThanOrEqual(0);
  expect(downloadedOrder.summaryIndex).toBeGreaterThanOrEqual(0);
  expect(downloadedOrder.experienceIndex).toBeLessThan(downloadedOrder.summaryIndex);
});

test('builder supports multiple education entries', async ({ page }) => {
  await page.goto('/builder');

  await page.getByRole('button', { name: '+ Add another education' }).click();
  await page.locator('#builder-section-education').getByPlaceholder('Degree').nth(1).fill('M.Tech in Artificial Intelligence');
  await page.locator('#builder-section-education').getByPlaceholder('School / University').nth(1).fill('Indian Institute of Science');
  await page.locator('#builder-section-education').getByPlaceholder('Years').nth(1).fill('2022 - 2024');

  await expect(page.getByTestId('builder-template-preview')).toContainText('M.Tech in Artificial Intelligence');
  await expect(page.getByTestId('builder-template-preview')).toContainText('Indian Institute of Science');
});
