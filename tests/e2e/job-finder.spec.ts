import { expect, test } from '@playwright/test';

const apiJobResponse = {
  total: 1,
  page: 1,
  limit: 6,
  items: [
    {
      id: 'api-job-1',
      title: 'API QA Engineer',
      description: 'Test job returned by the jobs API.',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      remoteType: 'hybrid',
      employmentType: 'full_time',
      experienceLevel: 'mid',
      salaryMin: 1200000,
      salaryMax: 1800000,
      currency: 'INR',
      applyUrl: 'https://example.com/apply',
      originalJobUrl: 'https://example.com/apply',
      source: 'test',
      isNew: true,
      postedAt: new Date().toISOString(),
      company: {
        id: 'company-api',
        name: 'API Company',
        website: 'https://example.com',
      },
    },
  ],
};

test('job finder renders jobs returned by the backend API', async ({ page }) => {
  await page.route('http://localhost:4000/api/jobs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiJobResponse),
    });
  });

  await page.goto('/job-finder');

  await expect(page.getByRole('heading', { name: 'API QA Engineer' })).toBeVisible();
  await expect(page.getByText('API Company')).toBeVisible();
  await expect(page.getByText('1 jobs found')).toBeVisible();
  await expect(page.getByText('Cloud Sales Executive')).toBeHidden();
});

test('job finder shows a visible notice when the backend API cannot be reached', async ({ page }) => {
  await page.route('http://localhost:4000/api/jobs**', async (route) => {
    await route.abort('connectionrefused');
  });

  await page.goto('/job-finder');

  await expect(page.getByText('Showing sample jobs instead.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cloud Sales Executive' })).toBeVisible();
});

test('job finder does not show an API warning for a successful empty search', async ({ page }) => {
  await page.route('http://localhost:4000/api/jobs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, page: 1, limit: 6, items: [] }),
    });
  });

  await page.goto('/job-finder');

  await expect(page.getByText('No matching jobs found')).toBeVisible();
  await expect(page.getByText('Live job API returned no jobs')).toBeHidden();
  await expect(page.getByText('Showing sample jobs instead.')).toBeHidden();
});

test('job finder sends internship and remote filters to the jobs API', async ({ page }) => {
  const requestedUrls: string[] = [];
  await page.route('http://localhost:4000/api/jobs**', async (route) => {
    requestedUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        page: 1,
        limit: 6,
        items: [
          {
            ...apiJobResponse.items[0],
            id: 'api-remote-internship',
            title: 'Remote Marketing Intern',
            remoteType: 'remote',
            employmentType: 'internship',
            experienceLevel: 'entry',
          },
        ],
      }),
    });
  });

  await page.goto('/job-finder');
  await page.getByRole('button', { name: 'Internship' }).click();
  await page.getByRole('button', { name: 'Remote' }).click();

  await expect(page.getByRole('heading', { name: 'Remote Marketing Intern' })).toBeVisible();
  expect(requestedUrls.some((url) => url.includes('employmentType=internship') && url.includes('remoteType=remote'))).toBe(true);
});
