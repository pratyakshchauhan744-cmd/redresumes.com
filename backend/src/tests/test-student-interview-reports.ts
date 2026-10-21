import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import express from "express";
import JSZip from "jszip";
import * as xlsx from "xlsx";

// Never use the developer's or production database for these fixtures.
const databaseUrl = process.env.REPORTS_TEST_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) || !new URL(databaseUrl).pathname.includes("reports_test")) {
  throw new Error("Set REPORTS_TEST_DATABASE_URL to an isolated local reports_test database.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_URL = databaseUrl;
const { env } = await import("../config/env.js");
env.DATABASE_URL = databaseUrl;
process.env.DATABASE_URL = databaseUrl;
const { prisma } = await import("../db/prisma.js");
const { default: routes } = await import("../modules/enterprise/routes.js");
const { interviewPdfService, MAX_REPORT_EXPORT_BYTES } = await import("../modules/enterprise/student-interview-routes.js");
const { errorHandler } = await import("../middleware/error-handler.js");
const { signAccessToken } = await import("../utils/jwt.js");
const { renderInterviewReportHtml } = await import("../modules/enterprise/interview-report-pdf.js");
const app = express(); app.use(express.json()); app.use("/api/enterprise", routes); app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address(); assert(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/api/enterprise`;
const suffix = `${Date.now()}`;
const userIds: string[] = [], collegeIds: string[] = [];
const originalRenderer = interviewPdfService.createRenderer;
let rendered: string[] = [];
let rendererMode: "normal" | "fail" | "oversized" = "normal";
let pauseRender: (() => Promise<void>) | undefined;
interviewPdfService.createRenderer = async () => ({ close: async () => {}, render: async (_student, report) => {
  rendered.push(report.sessionId);
  if (pauseRender) await pauseRender();
  if (rendererMode === "fail") throw new Error("Simulated PDF failure");
  return rendererMode === "oversized" ? Buffer.alloc(MAX_REPORT_EXPORT_BYTES + 1) : Buffer.from(`%PDF-1.4\n${report.sessionId}\n${report.id}`);
} });
const request = (path: string, token?: string, body?: unknown) => fetch(base + path, {
  method: body ? "POST" : "GET", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
async function json(path: string, token: string) { const response = await request(path, token); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<any>; }
async function college(label: string) { const result = await prisma.college.create({ data: { name: label, code: `${label}-${suffix}`, officialEmail: `${label}-${suffix}@example.test`, status: "active" } }); collegeIds.push(result.id); return result; }
async function faculty(collegeId: string, label: string, permissions: string[], sectionAccess: string[] = []) {
  const user = await prisma.user.create({ data: { name: label, email: `${label}-${suffix}@example.test`, passwordHash: "unused-test-hash", role: "college_faculty", collegeId, isActive: true,
    facultyProfile: { create: { collegeId, status: "active", permissions, scopeUnrestricted: !sectionAccess.length, sectionAccess, cohortAccess: sectionAccess.map(section => ({ program: "B.Tech", course: "CS", section, batch: "2026" })) } } } });
  userIds.push(user.id);
  return { user, token: signAccessToken({ sub: user.id, email: user.email, role: user.role, collegeId, permissions }) };
}
async function student(collegeId: string, name: string, count: number, section = "A") {
  const user = await prisma.user.create({ data: { name, email: `${name}-${suffix}@example.test`, passwordHash: "unused-test-hash", role: "student", collegeId, isActive: true,
    studentProfile: { create: { collegeId, enrollmentNumber: `${name}-${suffix}`, program: "B.Tech", course: "CS", section, batch: "2026" } } }, include: { studentProfile: true } });
  userIds.push(user.id);
  const resume = await prisma.resume.create({ data: { userId: user.id, collegeId, fileName: "fixture.pdf" } });
  const sessions = [];
  for (let index = 1; index <= count; index++) {
    const session = await prisma.interviewSession.create({ data: {
      userId: user.id, collegeId, resumeId: resume.id, targetRole: `${name} Role ${index}`, difficulty: "medium", companyType: "product", interviewStyle: "technical", durationMins: 20, status: "completed",
      createdAt: new Date(Date.UTC(2026, 8, 28 - index)),
      report: { create: { overallScore: index === count ? 8 : 60 + index, scoreScale: count === 5 && index === count ? 10 : 100,
        categoryScores: { technical: 8, communication: 7 }, strengths: ["Clear explanation"], weaknesses: ["Add examples"], recommendations: ["Practice edge cases"], speakingPace: null, fillerWords: 0, voiceConfidence: null,
        createdAt: new Date(Date.UTC(2026, 9, index)) } },
      questions: { create: { questionText: `Explain ${name} question ${index}`, questionType: "technical", orderIndex: 0,
        answer: { create: { answerText: `A detailed answer belonging to ${name} interview ${index}.`, score: 8, scoreScale: 100, feedback: { feedback: "Explain tradeoffs", reasoning: "Partial coverage", improvedAnswerExample: "Cover time and space complexity." } } } } },
    }, include: { report: true } });
    sessions.push(session);
  }
  return { user, profile: user.studentProfile!, resume, sessions };
}
try {
  const a = await college("ReportsA"), b = await college("ReportsB");
  const admin = await faculty(a.id, "Admin", ["REPORT_VIEW", "REPORT_EXPORT"]);
  const scoped = await faculty(a.id, "Scoped", ["REPORT_VIEW", "REPORT_EXPORT"], ["A"]);
  const viewer = await faculty(a.id, "Viewer", ["REPORT_VIEW"]);
  const denied = await faculty(a.id, "Denied", ["STUDENT_VIEW"]);
  const zero = await student(a.id, "Zero", 0), one = await student(a.id, "One", 1), five = await student(a.id, "Five", 5), twenty = await student(a.id, "Twenty", 20);
  const outside = await student(a.id, "Outside", 1, "B"), foreign = await student(b.id, "Foreign", 1);
  const path = (s: typeof one) => `/students/${s.profile.id}`;
  const individual = (s: typeof one, sessionId: string) => `${path(s)}/interviews/${sessionId}/report`;
  const sessionData = { userId: one.user.id, collegeId: a.id, resumeId: one.resume.id, targetRole: "Unfinished", difficulty: "easy", companyType: "product", interviewStyle: "technical", durationMins: 20 };
  await prisma.interviewSession.create({ data: { ...sessionData, status: "completed" } });
  await prisma.interviewSession.create({ data: { ...sessionData, status: "in_progress", report: { create: { overallScore: 99, categoryScores: {}, strengths: [], weaknesses: [], recommendations: [] } } } });
  await prisma.interviewSession.create({ data: { ...sessionData, collegeId: b.id, status: "completed", report: { create: { overallScore: 100, categoryScores: {}, strengths: [], weaknesses: [], recommendations: [] } } } });

  for (const [s, count] of [[zero, 0], [one, 1], [five, 5], [twenty, 20]] as const) {
    const first = await json(`${path(s)}/interviews?page=1&limit=10`, scoped.token);
    assert.equal(first.total, count); assert.equal(first.interviews.length, Math.min(10, count));
    if (count) { assert.equal(first.interviews[0].sessionId, s.sessions.at(-1)!.id); assert.equal(first.interviews[0].interviewNumber, count); }
    if (count === 20) { const second = await json(`${path(s)}/interviews?page=2&limit=10`, scoped.token); assert.equal(second.interviews.length, 10); assert.equal(new Set([...first.interviews, ...second.interviews].map(r => r.sessionId)).size, 20); }
  }
  console.log("PASS 0/1/5/20 interviews, complete-report eligibility, tenant ownership, completion ordering and pagination");

  const summary = await json("/reports?view=students&search=Five&limit=1", scoped.token);
  assert.equal(summary.total, 1); assert.equal(summary.reports[0].id, five.profile.id); assert.equal(summary.reports[0].completedInterviewsCount, 5); assert.equal(summary.reports[0].latestScore, 80);
  assert.equal(summary.reports[0].latestInterviewDate, five.sessions.at(-1)!.report!.createdAt.toISOString());
  assert.equal(summary.reports[0].averageScore, 66);
  const low = await json("/reports?view=students&search=Twenty", scoped.token); assert.equal(low.reports[0].latestScore, 8);
  const metrics = await json("/reports/summary?view=students&search=Five", scoped.token);
  assert.equal(metrics.totalReports, 5); assert.equal(metrics.averageOverallScore, 66); assert.deepEqual(metrics.scoreDistribution.map((r: any) => r.count), [1, 4, 0]);
  const allMetrics = await json("/reports/summary?view=students", scoped.token); assert.equal(allMetrics.totalReports, 26);
  const byRole = await json("/reports?view=students&search=Five%20Role%202&section=A", scoped.token); assert.equal(byRole.total, 1); assert.equal(byRole.reports[0].completedInterviewsCount, 5);
  for (const format of ["csv", "xlsx"]) {
    const response = await request(`/reports/export?view=students&search=Five%20Role%202&section=A&format=${format}`, scoped.token);
    assert.equal(response.status, 200);
    const workbook = xlsx.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    const rows = xlsx.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]]);
    assert.equal(rows.length, 1); assert.equal(rows[0]["Completed Interviews"], 5); assert.equal(rows[0]["Latest Score"], 80);
  }
  const paginated = await json("/reports?view=students&limit=2&page=1", scoped.token); assert.equal(paginated.total, 4);
  const allExport = await request("/reports/export?view=students&format=xlsx&limit=2&page=1", scoped.token);
  const workbook = xlsx.read(Buffer.from(await allExport.arrayBuffer()), { type: "buffer" });
  assert.equal(xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).length, 4);
  console.log("PASS student summaries, normalized 8/10 vs 8/100, session analytics, search/cohort and CSV/XLSX parity across pagination");

  rendered = [];
  const report = await json(individual(five, five.sessions[2].id), scoped.token);
  assert.equal(report.sessionId, five.sessions[2].id); assert.equal(report.student.id, five.profile.id); assert.equal(rendered.length, 0);
  const html = renderInterviewReportHtml({ ...five.profile, name: '<script>alert(1)</script>', email: five.user.email }, { ...report, createdAt: new Date(report.createdAt) } as any, 3);
  // JSON dates are converted for the HTML-only test.
  assert(!html.includes('<script>'));
  const pdf = await request(`${individual(five, five.sessions[2].id)}/pdf`, viewer.token);
  assert.equal(pdf.status, 200); assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition")!, /Five_Interview_3_2026-10-03.pdf/);
  assert.match(await pdf.text(), new RegExp(five.sessions[2].id)); assert.deepEqual(rendered, [five.sessions[2].id]);
  rendered = [];
  const chosen = [five.sessions[0].id, five.sessions[2].id, five.sessions[4].id];
  const selectedZip = await request(`${path(five)}/reports/export`, scoped.token, { mode: "selected", sessionIds: chosen });
  assert.equal(selectedZip.status, 200);
  const selectedArchive = await JSZip.loadAsync(await selectedZip.arrayBuffer());
  assert.equal(Object.keys(selectedArchive.files).length, 3); assert.deepEqual([...rendered].sort(), chosen.sort());
  for (const file of Object.values(selectedArchive.files)) { const text = await file.async("string"); assert(chosen.some(id => text.includes(id))); }
  rendered = [];
  const allZip = await request(`${path(twenty)}/reports/export`, scoped.token, { mode: "all" });
  assert.equal(allZip.status, 200); const allArchive = await JSZip.loadAsync(await allZip.arrayBuffer());
  assert.equal(Object.keys(allArchive.files).length, 20); assert.equal(new Set(rendered).size, 20);
  console.log("PASS view has no PDF side effect, individual PDF identity/filename, selected ZIP and all 20 reports");

  const beforeDenied = rendered.length;
  for (const target of [individual(five, one.sessions[0].id), individual(five, foreign.sessions[0].id), individual(outside, outside.sessions[0].id), individual(foreign, foreign.sessions[0].id)]) {
    for (const extension of ["", "/pdf"]) assert.equal((await request(target + extension, scoped.token)).status, 404);
  }
  assert.equal((await request(`${path(five)}/interviews`, denied.token)).status, 403);
  assert.equal((await request(individual(five, five.sessions[0].id), denied.token)).status, 403);
  assert.equal((await request(`${individual(five, five.sessions[0].id)}/pdf`, denied.token)).status, 403);
  assert.equal((await request(`${path(five)}/interviews`)).status, 401);
  for (const s of [outside, foreign]) {
    assert.equal((await request(`${path(s)}/interviews`, scoped.token)).status, 404);
    assert.equal((await request(`${path(s)}/reports/export`, scoped.token, { mode: "all" })).status, 404);
  }
  assert.equal((await request(`${path(five)}/reports/export`, viewer.token, { mode: "all" })).status, 403);
  assert.equal((await request(`${path(five)}/reports/export`, scoped.token, { mode: "selected", sessionIds: [one.sessions[0].id] })).status, 404);
  for (const body of [{ mode: "selected", sessionIds: [] }, { mode: "selected", sessionIds: Array(51).fill(five.sessions[0].id) }, { mode: "selected", sessionIds: [five.sessions[0].id, five.sessions[0].id] }, { mode: "all", sessionIds: chosen }]) {
    assert.equal((await request(`${path(five)}/reports/export`, scoped.token, body)).status, 400);
  }
  assert.equal((await request(`${path(five)}/interviews?page=-1`, scoped.token)).status, 400);
  assert.equal((await request("/students/invalid%20id/interviews", scoped.token)).status, 400);
  assert.equal(rendered.length, beforeDenied);
  console.log("PASS authentication, REPORT_VIEW/REPORT_EXPORT, altered IDs, cross-tenant and faculty scope, validation before rendering");

  const many = await student(a.id, "Many", 51);
  assert.equal((await request(`${path(many)}/reports/export`, admin.token, { mode: "all" })).status, 413);
  assert.equal((await request(`${path(zero)}/reports/export`, admin.token, { mode: "all" })).status, 404);
  rendererMode = "oversized";
  assert.equal((await request(`${path(one)}/reports/export`, admin.token, { mode: "all" })).status, 413);
  rendererMode = "fail";
  const failure = await request(`${path(one)}/reports/export`, admin.token, { mode: "all" });
  assert.equal(failure.status, 503); assert.equal(failure.headers.get("content-disposition"), null);
  rendererMode = "normal";
  let release!: () => void, started!: () => void;
  const startedPromise = new Promise<void>(resolve => { started = resolve; });
  const releasePromise = new Promise<void>(resolve => { release = resolve; });
  pauseRender = async () => { started(); await releasePromise; };
  const first = request(`${path(one)}/reports/export`, admin.token, { mode: "all" });
  await startedPromise;
  assert.equal((await request(`${path(one)}/reports/export`, admin.token, { mode: "all" })).status, 409);
  await prisma.collegeFaculty.update({ where: { userId: admin.user.id }, data: { permissions: [] } });
  release();
  const revoked = await first; assert.equal(revoked.status, 403); assert.equal(revoked.headers.get("content-disposition"), null);
  pauseRender = undefined;
  console.log("PASS 50-report and 25-MB limits, renderer failures, duplicate clicks and in-flight revocation without partial files");

  if (process.env.REPORT_PDF_SMOKE_PATH) {
    interviewPdfService.createRenderer = originalRenderer;
    for (let index = 1; index <= 4; index++) await prisma.interviewQuestion.create({ data: {
      sessionId: five.sessions[2].id, orderIndex: index, questionText: `Additional recorded question ${index}`, questionType: "technical",
      answer: { create: { answerText: "This long fixture answer explains algorithmic tradeoffs and validation with concrete examples. ".repeat(14),
        score: 72, scoreScale: 100, durationSecs: 90, feedback: { feedback: "Discuss complexity and boundary conditions. ".repeat(8) } } },
    } });
    const response = await request(`${individual(five, five.sessions[2].id)}/pdf`, viewer.token);
    assert.equal(response.status, 200, await response.clone().text());
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    await writeFile(process.env.REPORT_PDF_SMOKE_PATH, bytes);
    console.log("PASS real Chromium PDF generation; sample saved for visual QA");
  }
} finally {
  interviewPdfService.createRenderer = originalRenderer;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.college.deleteMany({ where: { id: { in: collegeIds } } });
  await prisma.$disconnect();
}
