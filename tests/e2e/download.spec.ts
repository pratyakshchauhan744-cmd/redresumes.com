import { expect, test, type Page } from '@playwright/test';

const signInForDownloadTests = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('redresumes_user', JSON.stringify({
      id: 'e2e-user',
      email: 'candidate@example.com',
      name: 'E2E Candidate',
      role: 'user',
    }));
    window.localStorage.setItem('redresumes_access_token', 'e2e-token');
    window.sessionStorage.setItem('redresumes_access_token', 'e2e-token');
  });
};

test('builder download actions are available and clickable', async ({ page }) => {
  await signInForDownloadTests(page);
  await page.route('**/api/resume/pdf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n%%EOF',
    });
  });

  await page.goto('/builder?template=modern');

  const pdfButton = page.getByRole('button', { name: 'Download PDF' });
  const docxButton = page.getByRole('button', { name: 'Download DOCX' });

  await expect(pdfButton).toBeVisible();
  await expect(docxButton).toBeVisible();

  await pdfButton.click();
  await docxButton.click();

  await expect(page.getByText('Live Preview')).toBeVisible();
});

test('all templates export selectable linked resume HTML for PDF rendering', async ({ page }) => {
  test.setTimeout(90_000);
  await signInForDownloadTests(page);
  const templateIds = [
    'professional',
    'modern',
    'minimal',
    'creative',
    'fresher',
    'executive',
    'technical',
    'two-column',
    'consulting',
    'startup',
    'corporate',
    'academic',
    'sales',
    'designer',
    'product',
    'operations',
    'finance',
  ];
  let latestExportedHtml = '';
  let latestFileName = '';

  await page.route('**/api/resume/pdf', async (route) => {
    const body = route.request().postDataJSON() as { fileName?: string; html?: string };
    latestExportedHtml = body.html ?? '';
    latestFileName = body.fileName ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n%%EOF',
    });
  });

  await page.goto('/builder?template=professional');
  await page.getByPlaceholder('Full name').fill('Candidate');
  await page.getByPlaceholder('Email').fill('candidate@example.com');
  await page.getByPlaceholder('LinkedIn / Portfolio').fill('linkedin.com/in/candidate');

  const templateSelect = page.locator('#builder-template-select');
  for (const templateId of templateIds) {
    latestExportedHtml = '';
    latestFileName = '';
    await templateSelect.selectOption(templateId);
    const responsePromise = page.waitForResponse('**/api/resume/pdf');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    await responsePromise;

    const exportedHtml = latestExportedHtml;
    expect(exportedHtml).toContain('Candidate');
    expect(exportedHtml).toContain('mailto:candidate@example.com');
    expect(exportedHtml).toContain('https://linkedin.com/in/candidate');
    expect(exportedHtml).toContain(`data-template-id="${templateId}"`);
    expect(latestFileName).toContain(`-${templateId}-resume.pdf`);
    expect(exportedHtml).not.toContain('<canvas');
  }
});

test('blank contact fields are omitted from exported resume HTML', async ({ page }) => {
  await signInForDownloadTests(page);
  let latestExportedHtml = '';

  await page.route('**/api/resume/pdf', async (route) => {
    const body = route.request().postDataJSON() as { html?: string };
    latestExportedHtml = body.html ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n%%EOF',
    });
  });

  await page.goto('/builder?template=modern');
  await page.getByPlaceholder('Location').fill('');
  await page.getByPlaceholder('Phone').fill('');

  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText('Resume PDF downloaded.')).toBeVisible();

  const exportedText = latestExportedHtml.replace(/<[^>]+>/g, ' ');
  expect(exportedText).not.toMatch(/\blocation\b/i);
  expect(exportedText).not.toMatch(/\bphone\b/i);
  expect(latestExportedHtml).not.toContain(' •  • ');
});
