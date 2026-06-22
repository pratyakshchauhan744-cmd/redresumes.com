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

const makeDraftSnapshot = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Draft Candidate',
  jobTitle: 'Draft Role',
  email: 'draft@example.com',
  phone: '+1 555 000 1111',
  location: 'Draft City',
  profileLink: 'linkedin.com/in/draft',
  importantDate: '',
  importantPlace: '',
  summary: 'Saved draft summary',
  experiences: [],
  skillsInput: 'Planning, Reporting',
  educationItems: [],
  educationDegree: '',
  educationSchool: '',
  educationYear: '',
  projectsInput: '',
  certificationsInput: '',
  languagesInput: '',
  hobbiesInput: '',
  achievementsInput: '',
  volunteerInput: '',
  customColumns: [],
  selectedTemplateId: 'finance',
  selectedTemplateName: 'Finance',
  listStyle: 'bullet',
  ...overrides,
});

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
  const jobDescription = page.getByPlaceholder('Paste a target job description here...');
  const templateSelect = page.locator('#builder-template-select');
  const targetJobDescription = 'Target posting requires Kubernetes budget ownership and healthcare analytics delivery.';

  await fullName.fill('Riley Persistent');
  await jobTitle.fill('Draft Retention Lead');
  await email.fill('riley.persistence@example.com');
  await summary.fill('This resume draft should survive a full browser refresh without requiring the user to sign in.');
  await jobDescription.fill(targetJobDescription);
  await templateSelect.selectOption('finance');

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('redresumes_resume_draft_v1:guest');
    return raw?.includes('Riley Persistent') && raw.includes('finance') && raw.includes('Kubernetes budget ownership');
  });

  await page.reload();

  await expect(fullName).toHaveValue('Riley Persistent');
  await expect(jobTitle).toHaveValue('Draft Retention Lead');
  await expect(email).toHaveValue('riley.persistence@example.com');
  await expect(summary).toHaveValue(/survive a full browser refresh/);
  await expect(jobDescription).toHaveValue(targetJobDescription);
  await expect(templateSelect).toHaveValue('finance');
  await expect(page.getByTestId('builder-template-preview')).toContainText('Riley Persistent');
  await expect(page.getByTestId('builder-template-preview')).not.toContainText('Kubernetes budget ownership');
});

test('template query overrides old saved draft template', async ({ page }) => {
  await page.addInitScript((draft) => {
    window.localStorage.setItem('redresumes_resume_draft_v1:guest', JSON.stringify(draft));
  }, makeDraftSnapshot({
    selectedTemplateId: 'finance',
    selectedTemplateName: 'Finance',
  }));

  await page.goto('/builder?template=operations');

  await expect(page.locator('#builder-template-select')).toHaveValue('operations');
  await expect(page.getByText('Layout: Two-column')).toBeVisible();
});

test('live preview layout stays stable while builder is idle', async ({ page }) => {
  await page.goto('/builder?template=modern');
  await page.evaluate(() => document.fonts.ready);
  await page.getByTestId('builder-template-preview').scrollIntoViewIfNeeded();
  await expect(page.getByText('Live Preview')).toBeVisible();
  await page.waitForTimeout(1000);

  const samples = [];
  for (let index = 0; index < 6; index += 1) {
    samples.push(await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.template-preview-scale-stage');
      const previewPage = document.querySelector<HTMLElement>('.template-preview-scale-page');
      const visualPreview = document.querySelector<HTMLElement>('.template-visual-preview');

      return {
        stageWidth: Math.round(stage?.getBoundingClientRect().width ?? 0),
        stageHeight: Math.round(stage?.getBoundingClientRect().height ?? 0),
        previewHeight: Math.round(visualPreview?.getBoundingClientRect().height ?? 0),
        transform: previewPage ? getComputedStyle(previewPage).transform : '',
      };
    }));
    await page.waitForTimeout(600);
  }

  expect(new Set(samples.map((sample) => JSON.stringify(sample))).size).toBe(1);
});

test('manual save stores the latest selected template immediately', async ({ page }) => {
  await signInForDownloadTests(page);
  await page.goto('/builder?template=professional');

  await page.locator('#builder-template-select').selectOption('finance');
  await page.getByRole('button', { name: 'Save version' }).click();

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('redresumes_resume_history_v1:e2e-user');
    if (!raw) return false;
    const history = JSON.parse(raw) as Array<{ snapshot?: { selectedTemplateId?: string } }>;
    return history[0]?.snapshot?.selectedTemplateId === 'finance';
  });
});

test('section order updates live preview and downloaded resume', async ({ page }) => {
  await signInForDownloadTests(page);
  let exportedHtml = '';
  await page.route('**/api/resume/pdf', async (route) => {
    const body = route.request().postDataJSON() as { html?: string };
    exportedHtml = body.html ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n%%EOF',
    });
  });

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

  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByText('Resume PDF downloaded.')).toBeVisible();

  const exportedText = exportedHtml.replace(/<[^>]+>/g, ' ');
  const downloadedOrder = {
    experienceIndex: exportedText.indexOf('Experience'),
    summaryIndex: exportedText.indexOf('Summary'),
  };

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

test('builder phone field accepts only 10 digits', async ({ page }) => {
  await page.goto('/builder');

  const phoneInput = page.getByLabel('Phone number');
  await expect(phoneInput).toHaveValue('5551234567');

  await phoneInput.fill('abc9876543210123xyz');

  await expect(phoneInput).toHaveValue('9876543210');
  await expect(page.getByTestId('builder-template-preview')).toContainText('9876543210');
  await expect(page.getByTestId('builder-template-preview')).not.toContainText('abc');
});

test('builder can remove added experience entries', async ({ page }) => {
  await page.goto('/builder');

  await page.getByRole('button', { name: '+ Add another experience' }).click();
  await page.locator('#builder-section-experience').getByPlaceholder('Company and role').nth(1).fill('Temporary Role');
  await expect(page.getByText('Experience 2')).toBeVisible();

  await page.getByRole('button', { name: 'Remove experience 2' }).click();

  await expect(page.getByText('Experience 2')).toHaveCount(0);
  await expect(page.locator('#builder-section-experience').getByPlaceholder('Company and role')).toHaveCount(1);
  await expect(page.getByTestId('builder-template-preview')).not.toContainText('Temporary Role');
});

test('ATS fixes add clean skill keywords from job description', async ({ page }) => {
  await page.goto('/builder');

  await page.getByPlaceholder('Paste a target job description here...').fill(
    'Looking for a Senior Product Manager with experience in product analytics, SQL, roadmap ownership, stakeholder management, and experimentation.'
  );

  await page.getByRole('button', { name: 'Run ATS check' }).click();
  await expect(page.getByRole('button', { name: 'Apply all ATS fixes' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply all ATS fixes' }).click();
  await expect(page.getByText(/Applied all ATS fixes/)).toBeVisible();

  const skillsInput = page.locator('#builder-section-skills').getByPlaceholder('Comma-separated skills');
  await expect(skillsInput).toHaveValue(/Roadmap Ownership/);
  await expect(skillsInput).toHaveValue(/Experimentation/);
  await expect(skillsInput).not.toHaveValue(/\blook\b/i);
  await expect(skillsInput).not.toHaveValue(/\blooking\b/i);
  await expect(skillsInput).not.toHaveValue(/experimentation\./i);
  await expect(skillsInput).not.toHaveValue(/\bownership\b(?!\s*,|\s*$)/i);
});
