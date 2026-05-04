import { expect, test } from '@playwright/test';

test('selecting a template opens builder with template query', async ({ page }) => {
  await page.goto('/templates');

  const useTemplate = page.getByRole('button', { name: 'Use template' }).first();
  await expect(useTemplate).toBeVisible();
  await useTemplate.click();

  await expect(page).toHaveURL(/\/builder\?template=/);
  await expect(page.getByText('Live Preview')).toBeVisible();
});
