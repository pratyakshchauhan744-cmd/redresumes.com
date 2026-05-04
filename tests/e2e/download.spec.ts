import { expect, test } from '@playwright/test';

test('builder download actions are available and clickable', async ({ page }) => {
  await page.goto('/builder?template=modern');

  const pdfButton = page.getByRole('button', { name: 'Download PDF' });
  const docxButton = page.getByRole('button', { name: 'Download DOCX' });

  await expect(pdfButton).toBeVisible();
  await expect(docxButton).toBeVisible();

  await pdfButton.click();
  await docxButton.click();

  await expect(page.getByText('Live Preview')).toBeVisible();
});
