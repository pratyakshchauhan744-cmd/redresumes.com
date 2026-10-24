import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import JSZip from "jszip";
import { Prisma } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { prisma } from "../../db/prisma.js";
import { requirePermission, resolveEnterpriseAuthorization, EnterpriseAuthorizationError } from "../../middleware/tenant.js";
import { buildFacultyStudentScopeConditions } from "./student-scope-authorization.js";
import { buildScopedStudentWhere } from "./report-filters.js";
import { fullReportInclude, reportOrder } from "./student-reports.js";
import { normalizeReportScore } from "../../utils/score.js";
import { createInterviewPdfRenderer, reportFilename, reportFileStem } from "./interview-report-pdf.js";

export const MAX_REPORTS_PER_ZIP = 50;
export const MAX_REPORT_EXPORT_BYTES = 25 * 1024 * 1024;
const MAX_EXPORT_MS = 90_000;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/, "Invalid student or interview ID");
const identifiers = z.object({ studentId: id, sessionId: id.optional() });
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
const exportSelection = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }).strict(),
  z.object({ mode: z.literal("selected"), sessionIds: z.array(id).min(1).max(MAX_REPORTS_PER_ZIP)
    .refine(ids => new Set(ids).size === ids.length, "Duplicate interview IDs are not allowed") }).strict(),
]);

class ReportRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (error) {
      if (error instanceof ReportRequestError) res.status(error.status).json({ message: error.message });
      else next(error);
    }
  };

async function authorizedStudent(req: Request) {
  const { studentId } = identifiers.parse(req.params);
  const auth = await resolveEnterpriseAuthorization(req);
  const student = await prisma.collegeStudent.findFirst({
    where: buildScopedStudentWhere(req.collegeId!, buildFacultyStudentScopeConditions(auth.studentScope), { id: studentId }),
    select: { id: true, userId: true, enrollmentNumber: true, program: true, course: true, section: true, batch: true,
      user: { select: { name: true, email: true } } },
  });
  if (!student) throw new ReportRequestError(404, "Student not found or outside your reporting scope.");
  const { user, ...identity } = student;
  return { ...identity, ...user };
}
const reportWhere = (req: Request, userId: string) => ({ session: { userId, collegeId: req.collegeId!, status: "completed" } });

async function selectedReport(req: Request, userId: string) {
  const { sessionId } = identifiers.parse(req.params);
  if (!sessionId) throw new ReportRequestError(400, "Interview ID is required.");
  const report = await prisma.interviewReport.findFirst({
    where: { ...reportWhere(req, userId), sessionId }, include: fullReportInclude,
  });
  if (!report) throw new ReportRequestError(404, "Completed interview report not found for this student.");
  return report;
}

async function interviewNumber(req: Request, userId: string, report: { id: string; createdAt: Date }) {
  return prisma.interviewReport.count({ where: { ...reportWhere(req, userId), OR: [
    { createdAt: { lt: report.createdAt } }, { createdAt: report.createdAt, id: { lte: report.id } },
  ] } });
}

// Injectable renderer allows route tests to verify exact archive membership without Chromium.
export const interviewPdfService = { createRenderer: createInterviewPdfRenderer };
const activeExports = new Set<string>();
async function withExport(req: Request, res: Response, work: (renderer: Awaited<ReturnType<typeof createInterviewPdfRenderer>>, check: () => void) => Promise<{ bytes: Buffer; filename: string; mime: string }>) {
  const key = `${req.collegeId}:${req.user!.id}`;
  if (activeExports.has(key)) throw new ReportRequestError(409, "A report download is already being prepared. Please wait.");
  if (activeExports.size >= 2) throw new ReportRequestError(429, "Report downloads are busy. Please retry shortly.");
  activeExports.add(key);
  const started = Date.now();
  let renderer: Awaited<ReturnType<typeof createInterviewPdfRenderer>> | undefined;
  let phase = "authorization";
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void renderer?.close().catch(() => {}); }, MAX_EXPORT_MS);
  const onClose = () => { if (!res.writableEnded) void renderer?.close().catch(() => {}); };
  res.once("close", onClose);
  try {
    const initial = await resolveEnterpriseAuthorization(req);
    phase = "browser-launch";
    renderer = await interviewPdfService.createRenderer();
    const check = () => {
      if (timedOut || Date.now() - started > MAX_EXPORT_MS) throw new ReportRequestError(413, "Report export exceeded 90 seconds. Select fewer interviews and retry.");
      if (res.destroyed) throw new ReportRequestError(499, "Download cancelled.");
    };
    check();
    phase = "render-report";
    const result = await work(renderer, check);
    check();
    // POST downloads need the same final live authorization check as GET reads.
    phase = "final-authorization";
    const current = await resolveEnterpriseAuthorization(req, true);
    if (current.fingerprint !== initial.fingerprint) throw new ReportRequestError(403, "Institutional access changed. Please retry.");
    await authorizedStudent(req);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", result.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.bytes);
  } catch (error) {
    if (error instanceof ReportRequestError || error instanceof EnterpriseAuthorizationError) throw error;
    if (timedOut) throw new ReportRequestError(413, "Report export exceeded 90 seconds. Select fewer interviews and retry.");
    console.error("Interview PDF export failed", { phase,
      message: error instanceof Error ? error.message : "Unknown error" });
    throw new ReportRequestError(503, "Unable to prepare the report download. Please retry shortly or select fewer interviews.");
  } finally {
    clearTimeout(timer);
    res.off("close", onClose);
    await renderer?.close().catch(() => {});
    activeExports.delete(key);
  }
}

const router = Router();
const downloadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,
  message: { message: "Too many report downloads. Please try again in 15 minutes." } });

router.get("/students/:studentId/interviews", requirePermission("REPORT_VIEW"), handle(async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  const student = await authorizedStudent(req);
  const where = reportWhere(req, student.userId);
  const [total, reports] = await prisma.$transaction([
    prisma.interviewReport.count({ where }),
    prisma.interviewReport.findMany({ where, orderBy: reportOrder, skip: (page - 1) * limit, take: limit,
      select: { id: true, sessionId: true, overallScore: true, scoreScale: true, createdAt: true,
        session: { select: { targetRole: true, difficulty: true, durationMins: true, createdAt: true, completedAt: true } } } }),
  ], { isolationLevel: "RepeatableRead" });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ student, total, maxReportsPerZip: MAX_REPORTS_PER_ZIP,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    interviews: reports.map((report, index) => ({
      reportId: report.id, sessionId: report.sessionId, interviewNumber: total - (page - 1) * limit - index,
      targetRole: report.session.targetRole, difficulty: report.session.difficulty, durationMins: report.session.durationMins,
      overallScore: normalizeReportScore(report),
      // startedAt: when the student entered the interview room
      startedAt: report.session.createdAt,
      // completedAt: when the session was completed (null for legacy sessions that pre-date this field)
      completedAt: report.session.completedAt ?? report.createdAt,
      // evaluatedAt: when the AI evaluation report was generated
      evaluatedAt: report.createdAt,
    })) });
}));

router.get("/students/:studentId/interviews/:sessionId/report", requirePermission("REPORT_VIEW"), handle(async (req, res) => {
  const student = await authorizedStudent(req);
  const report = await selectedReport(req, student.userId);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ...report, student });
}));

router.get("/students/:studentId/interviews/:sessionId/report/pdf", requirePermission("REPORT_VIEW"), downloadLimiter, handle(async (req, res) => {
  const student = await authorizedStudent(req);
  const report = await selectedReport(req, student.userId);
  const number = await interviewNumber(req, student.userId, report);
  await withExport(req, res, async (renderer) => {
    const bytes = await renderer.render(student, report, number);
    if (bytes.length > MAX_REPORT_EXPORT_BYTES) throw new ReportRequestError(413, "The PDF exceeds the 25 MB download limit.");
    return { bytes, filename: reportFilename(student, report, number), mime: "application/pdf" };
  });
}));

router.post("/students/:studentId/reports/export", requirePermission("REPORT_VIEW"), requirePermission("REPORT_EXPORT"), downloadLimiter, handle(async (req, res) => {
  const selection = exportSelection.parse(req.body);
  const student = await authorizedStudent(req);
  const where = reportWhere(req, student.userId);
  const reports = await prisma.interviewReport.findMany({
    where: { ...where, ...(selection.mode === "selected" ? { sessionId: { in: selection.sessionIds } } : {}) },
    orderBy: reportOrder, take: MAX_REPORTS_PER_ZIP + 1,
    select: { id: true, sessionId: true, createdAt: true },
  });
  if (selection.mode === "selected" && reports.length !== selection.sessionIds.length) throw new ReportRequestError(404, "One or more selected interviews are unavailable for this student.");
  if (!reports.length) throw new ReportRequestError(404, "This student has no completed reports to download.");
  if (reports.length > MAX_REPORTS_PER_ZIP) throw new ReportRequestError(413, `Select up to ${MAX_REPORTS_PER_ZIP} interviews per ZIP. This student has more reports than the Download All limit.`);
  // Compute chronological labels once, including earlier interviews that were
  // not selected. Only the bounded selection leaves PostgreSQL.
  const ranked = await prisma.$queryRaw<Array<{ id: string; number: bigint }>>(Prisma.sql`
    SELECT id, number FROM (
      SELECT r.id, ROW_NUMBER() OVER (ORDER BY r."createdAt", r.id) AS number
      FROM "InterviewReport" r JOIN "InterviewSession" s ON s.id = r."sessionId"
      WHERE s."userId" = ${student.userId} AND s."collegeId" = ${req.collegeId!} AND s.status = 'completed'
    ) history WHERE id IN (${Prisma.join(reports.map(report => report.id))})
  `);
  const numbers = new Map(ranked.map(report => [report.id, Number(report.number)]));
  if (numbers.size !== reports.length) throw new ReportRequestError(409, "Interview history changed. Please retry.");
  await withExport(req, res, async (renderer, check) => {
    const zip = new JSZip();
    let size = 0;
    // Load bounded batches, avoiding two database queries per PDF while keeping
    // long answer transcripts out of memory once each batch is rendered.
    for (let offset = 0; offset < reports.length; offset += 5) {
      check();
      const batch = reports.slice(offset, offset + 5);
      const fullReports = await prisma.interviewReport.findMany({
        where: { ...where, id: { in: batch.map(report => report.id) } }, orderBy: reportOrder, include: fullReportInclude,
      });
      if (fullReports.length !== batch.length) throw new ReportRequestError(409, "An interview changed while preparing the export. Please retry.");
      for (const report of fullReports) {
        check();
        const number = numbers.get(report.id)!;
        const bytes = await renderer.render(student, report, number);
        size += bytes.length;
        if (size > MAX_REPORT_EXPORT_BYTES) throw new ReportRequestError(413, "Selected reports exceed the 25 MB ZIP limit. Select fewer interviews.");
        zip.file(reportFilename(student, report, number), bytes);
      }
    }
    check();
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
    if (bytes.length > MAX_REPORT_EXPORT_BYTES) throw new ReportRequestError(413, "The ZIP exceeds 25 MB. Select fewer interviews.");
    return { bytes, filename: `${reportFileStem(student.name)}_${reports.length}_Interview_Reports.zip`, mime: "application/zip" };
  });
}));

export default router;
