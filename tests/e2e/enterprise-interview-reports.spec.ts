import { expect, test, type Page } from '@playwright/test';

const student = { id: 'student-five', userId: 'user-five', name: 'Aditya Joshi', email: 'aditya@example.test', enrollmentNumber: 'FAC2026005', program: 'B.Tech', course: 'CS', section: 'A', batch: '2026' };
const summary = { ...student, completedInterviewsCount: 20, latestScore: 82, latestInterviewDate: '2026-10-11T12:00:00Z' };
const faculty = { id: 'faculty-a', name: 'Faculty Test', email: 'faculty@example.test', role: 'college_faculty', collegeId: 'college-a', permissions: ['REPORT_VIEW', 'REPORT_EXPORT'] };
const interview = (number: number) => ({ sessionId: `session-${number}`, reportId: `report-${number}`, interviewNumber: number, targetRole: `Engineer ${number}`, difficulty: 'medium', durationMins: 20, overallScore: number === 8 ? 8 : 82, completedAt: '2026-10-11T12:00:00Z' });

async function setup(page: Page, total = 20, canExport = true) {
  const requests: { path: string; body: any }[] = [];
  const user = { ...faculty, permissions: canExport ? faculty.permissions : ['REPORT_VIEW'] };
  await page.addInitScript(user => {
    localStorage.setItem('redresumes_user', JSON.stringify(user));
    localStorage.setItem('redresumes_access_token', 'live-test-token');
    sessionStorage.setItem('redresumes_access_token', 'live-test-token');
  }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({ path, body: request.method() === 'POST' ? request.postDataJSON() : null });
    const fulfill = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me') return fulfill({ user });
    if (path.endsWith('/filter-options')) return fulfill({ programs: ['B.Tech'], courses: ['CS'], sections: ['A'], batches: ['2026'], departments: [], cohorts: [] });
    if (path === '/api/enterprise/reports') return fulfill({ reports: [{ ...summary, completedInterviewsCount: total }], total: 1 });
    if (path.endsWith('/reports/summary')) return fulfill({ totalReports: total, averageOverallScore: 76, scoreDistribution: [{ label: 'High (80-100)', count: total }] });
    if (path === `/api/enterprise/students/${student.id}/interviews`) {
      const currentPage = Number(url.searchParams.get('page') || 1), offset = (currentPage - 1) * 10;
      return fulfill({ student, total, maxReportsPerZip: 50, pagination: { page: currentPage, limit: 10, total, totalPages: Math.ceil(total / 10) }, interviews: Array.from({ length: Math.max(0, Math.min(10, total - offset)) }, (_, index) => interview(total - offset - index)) });
    }
    const report = path.match(/\/interviews\/session-(\d+)\/report$/);
    if (report) return fulfill({ id: `report-${report[1]}`, sessionId: `session-${report[1]}`, student, overallScore: 8, scoreScale: 100,
      categoryScores: { technical: 8, communication: 0 }, strengths: ['Clear reasoning'], weaknesses: ['Add detail'], recommendations: ['Practice edge cases'], speakingPace: null, fillerWords: 0, voiceConfidence: null, createdAt: '2026-10-11T12:00:00Z',
      session: { id: `session-${report[1]}`, targetRole: `Engineer ${report[1]}`, difficulty: 'medium', companyType: 'product', durationMins: 20,
        questions: [{ id: 'q1', orderIndex: 0, questionText: `Selected question ${report[1]}`, answer: { answerText: `Only answer ${report[1]}`, score: 8, scoreScale: 100, feedback: { feedback: 'Use examples' } } }] } });
    if (path.endsWith('/pdf')) return route.fulfill({ contentType: 'application/pdf', headers: { 'Access-Control-Expose-Headers': 'Content-Disposition', 'Content-Disposition': 'attachment; filename="Aditya_Interview.pdf"' }, body: '%PDF-1.4\nselected-interview' });
    if (path.endsWith(`/${student.id}/reports/export`)) return route.fulfill({ contentType: 'application/zip', headers: { 'Access-Control-Expose-Headers': 'Content-Disposition', 'Content-Disposition': 'attachment; filename="Aditya_Reports.zip"' }, body: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]) });
    return fulfill({});
  });
  return requests;
}

for (const total of [1, 5, 20]) test(`lists all ${total} completed interviews and paginates`, async ({ page }) => {
  await setup(page, total);
  await page.goto('/enterprise?tab=reports');
  await expect(page.getByText(`${total} Interviews`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View Interviews' }).click();
  await expect(page.getByRole('heading', { name: 'Student Interview History' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Report', exact: true })).toHaveCount(Math.min(total, 10));
  if (total === 5 && process.env.REPORT_UI_SCREENSHOTS) await page.screenshot({ path: '/private/tmp/redresumes-history-desktop.png', fullPage: true, animations: 'disabled' });
  if (total === 20) {
    await page.getByRole('button', { name: 'Next interviews page' }).click();
    await expect(page.getByText('Interview 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Report', exact: true })).toHaveCount(10);
    await page.goBack();
    await expect(page.getByText('Interview 20', { exact: true })).toBeVisible();
  }
});

test('view is read only, selected ID is exact, filters and page survive browser/dashboard back', async ({ page }) => {
  const requests = await setup(page);
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto('/enterprise?tab=reports&reportSearch=Aditya&reportProgram=B.Tech');
  await page.getByRole('button', { name: 'View Interviews' }).click();
  await page.getByRole('button', { name: 'Next interviews page' }).click();
  await page.getByRole('row').filter({ hasText: 'Engineer 8' }).getByRole('button', { name: 'View Report', exact: true }).click();
  await expect(page.getByText('Only answer 8', { exact: false })).toBeVisible();
  await expect(page.getByText('8%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('AI Recommendations')).toBeVisible();
  await expect(page.getByText('Not recorded', { exact: true }).first()).toBeVisible();
  expect([...new Set(requests.filter(request => request.path.endsWith('/report')).map(request => request.path))]).toEqual([`/api/enterprise/students/${student.id}/interviews/session-8/report`]);
  expect(downloads).toEqual([]); expect(requests.some(request => request.path.endsWith('/pdf'))).toBe(false);
  if (process.env.REPORT_UI_SCREENSHOTS) await page.screenshot({ path: '/private/tmp/redresumes-report-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Back to Interview History' }).click();
  await expect(page.getByText('Interview 8', { exact: true })).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'Engineer 7' }).getByRole('button', { name: 'View Report', exact: true }).click();
  await expect(page.getByText('Only answer 7', { exact: false })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Interview 8', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cohort Reports & Analytics', exact: true }).click();
  await expect(page).toHaveURL(/reportSearch=Aditya/);
  await expect(page.getByPlaceholder(/Search/).first()).toHaveValue('Aditya');
  await expect(page.getByRole('button', { name: 'View Interviews' })).toBeVisible();
});

test('PDF and selected/all ZIP are explicit and preserve cross-page selections', async ({ page }) => {
  const requests = await setup(page);
  await page.goto(`/enterprise?tab=reports&reportStudent=${student.id}`);
  await page.getByRole('checkbox', { name: 'Select Interview 20', exact: true }).check();
  const row = page.getByRole('row').filter({ hasText: 'Engineer 20' });
  const pdfEvent = page.waitForEvent('download'); await row.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await pdfEvent).suggestedFilename()).toBe('Aditya_Interview.pdf');
  expect(requests.filter(request => request.path.endsWith('/pdf')).map(request => request.path)).toEqual([`/api/enterprise/students/${student.id}/interviews/session-20/report/pdf`]);
  await page.getByRole('button', { name: 'Next interviews page' }).click();
  await page.getByRole('checkbox', { name: 'Select Interview 1', exact: true }).check();
  const zipEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Selected Reports (2)', exact: true }).click();
  await zipEvent;
  expect(requests.filter(request => request.body).at(-1)?.body).toEqual({ mode: 'selected', sessionIds: ['session-20', 'session-1'] });
  const allEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download All Reports', exact: true }).click(); await allEvent;
  expect(requests.filter(request => request.body).at(-1)?.body).toEqual({ mode: 'all' });
});

test('errors retry cleanly, empty history is useful, export permissions remain enforced in UI', async ({ page }) => {
  await setup(page, 0, false);
  let fail = true;
  await page.route(`**/api/enterprise/students/${student.id}/interviews?**`, route => fail
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'History unavailable' }) })
    : route.fallback());
  await page.goto(`/enterprise?tab=reports&reportStudent=${student.id}`);
  await expect(page.getByRole('alert')).toContainText('History unavailable');
  fail = false;
  await page.getByRole('button', { name: 'Retry interview history' }).click();
  await expect(page.getByText('This student has no completed, evaluated interview reports yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download All Reports' })).toHaveCount(0);
});

test('failed download shows error and repeated clicks cannot start duplicate requests', async ({ page }) => {
  await setup(page, 5);
  let calls = 0;
  await page.route('**/report/pdf', async route => { calls++; await new Promise(resolve => setTimeout(resolve, 400)); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unable to prepare PDF' }) }); });
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto(`/enterprise?tab=reports&reportStudent=${student.id}`);
  const download = page.getByRole('button', { name: 'Download PDF', exact: true }).first();
  await download.click();
  await expect(page.getByRole('button', { name: 'Preparing PDF…', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Unable to prepare PDF');
  expect(calls).toBe(1); expect(downloads).toEqual([]);
  await expect(download).toBeEnabled();
});


test('mobile history contains table overflow and supports keyboard report navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, 5);
  await page.goto(`/enterprise?tab=reports&reportStudent=${student.id}`);
  const view = page.getByRole('button', { name: 'View Report', exact: true }).first();
  await expect(view).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.REPORT_UI_SCREENSHOTS) await page.screenshot({ path: '/private/tmp/redresumes-history-mobile.png', fullPage: true, animations: 'disabled' });
  await view.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Interview Debrief & Analytics' })).toBeFocused();
  if (process.env.REPORT_UI_SCREENSHOTS) await page.screenshot({ path: '/private/tmp/redresumes-report-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Back to Interview History' }).click();
  await expect(page.getByRole('heading', { name: 'Student Interview History' })).toBeFocused();
});
