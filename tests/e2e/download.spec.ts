import { expect, test } from '@playwright/test';

test('builder download actions are available and clickable', async ({ page }) => {
  // Log in first to satisfy the isLoggedIn check for resume downloads
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill('candidate@example.com');
  await page.getByPlaceholder('Enter your password').fill('Password@123');
  await page.locator('button.w-full', { hasText: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/builder?template=modern');

  const pdfButton = page.getByRole('button', { name: 'Download PDF' });
  const docxButton = page.getByRole('button', { name: 'Download DOCX' });

  await expect(pdfButton).toBeVisible();
  await expect(docxButton).toBeVisible();

  await pdfButton.click();
  await docxButton.click();

  await expect(page.getByText('Live Preview')).toBeVisible();
});
