import type { FullInterviewReport } from "./student-reports.js";
import { normalizeReportScore } from "../../utils/score.js";
import { launchPdfBrowser } from "../../utils/pdf-browser.js";

export type ReportStudent = {
  name: string; email: string; enrollmentNumber: string; program: string;
  course: string; section: string; batch: string;
};
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
const score = (value: number | null) => value === null ? "Not recorded" : `${value}%`;
export const reportFileStem = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70) || "Student";
export const reportFilename = (student: ReportStudent, report: FullInterviewReport, number: number) =>
  `${reportFileStem(student.name)}_Interview_${number}_${report.createdAt.toISOString().slice(0, 10)}.pdf`;

function feedbackHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return `<ul>${value.map(item => `<li>${feedbackHtml(item)}</li>`).join("")}</ul>`;
  if (typeof value === "object") return Object.entries(value).map(([key, item]) =>
    `<div><strong>${escape(label(key))}:</strong> ${feedbackHtml(item)}</div>`).join("");
  return escape(value);
}

export function renderInterviewReportHtml(student: ReportStudent, report: FullInterviewReport, number: number) {
  const session = report.session;
  const categories = Object.entries((report.categoryScores ?? {}) as Record<string, unknown>)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `<tr><td>${escape(label(key))}</td><td>${score(normalizeReportScore({ overallScore: value, scoreScale: report.scoreScale }))}</td></tr>`).join("");
  const list = (title: string, items: string[]) => items.length ? `<section><h2>${title}</h2><ul>${items.map(item => `<li>${escape(item)}</li>`).join("")}</ul></section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; } body { font: 11px/1.55 Arial, sans-serif; color: #1e293b; }
    h1 { color: #b11217; font-size: 25px; margin-bottom: 4px; } h2 { color: #b11217; font-size: 15px; margin: 22px 0 8px; }
    h3 { font-size: 12px; } header { border-bottom: 2px solid #b11217; padding-bottom: 14px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin: 18px 0; }
    .score { font-size: 22px; font-weight: bold; color: #b11217; }
    table { border-collapse: collapse; width: 100%; } td { padding: 7px; border-bottom: 1px solid #e2e8f0; }
    h2,h3 { break-after: avoid; } tr { break-inside: avoid; } p,li,div { overflow-wrap: anywhere; }
    .answer { white-space: pre-wrap; background: #f8fafc; padding: 10px; } .muted { color: #64748b; }
  </style></head><body>
  <header><div class="muted">REDRESUMES · INTERVIEW EVALUATION</div><h1>Interview ${number}</h1><div>${escape(session.targetRole)} · ${escape(session.difficulty)}</div></header>
  <div class="meta"><div><strong>Student:</strong> ${escape(student.name)}</div><div><strong>Enrollment:</strong> ${escape(student.enrollmentNumber)}</div>
  <div><strong>Program:</strong> ${escape(student.program)} / ${escape(student.course)}</div><div><strong>Cohort:</strong> ${escape(student.section)} / ${escape(student.batch)}</div>
  <div><strong>Evaluated:</strong> ${report.createdAt.toISOString().slice(0, 10)} (UTC)</div><div><strong>Scheduled duration:</strong> ${session.durationMins} minutes</div></div>
  <div class="score">Overall score: ${score(normalizeReportScore(report))}</div>
  ${categories ? `<h2>Skill evaluation</h2><table>${categories}</table>` : ""}
  <h2>Voice analysis</h2><table><tr><td>Speaking pace</td><td>${report.speakingPace === null ? "Not recorded" : `${report.speakingPace} WPM`}</td></tr>
  <tr><td>Filler words</td><td>${report.fillerWords ?? "Not recorded"}</td></tr><tr><td>Voice confidence</td><td>${report.voiceConfidence === null ? "Not recorded" : `${report.voiceConfidence}%`}</td></tr></table>
  ${list("Strengths", report.strengths)}${list("Areas for improvement", report.weaknesses)}${list("Recommendations", report.recommendations)}
  <h2>Answer-by-answer feedback</h2>${session.questions.map((question, index) => `<section><h3>Question ${index + 1}: ${escape(question.questionText)}</h3>
  ${question.answer ? `<p class="answer">${escape(question.answer.answerText)}</p><p>Score: ${score(normalizeReportScore({ overallScore: question.answer.score, scoreScale: question.answer.scoreScale }))}${question.answer.durationSecs === null ? "" : ` · Answer duration: ${question.answer.durationSecs} seconds`}</p>${feedbackHtml(question.answer.feedback)}` : '<p class="muted">No answer recorded.</p>'}</section>`).join("")}
  <p class="muted">Report ID: ${escape(report.id)} · Session ID: ${escape(session.id)}</p></body></html>`;
}

/** One browser per export, one page at a time; never fetch external resources. */
export async function createInterviewPdfRenderer() {
  const browser = await launchPdfBrowser();
  return {
    close: () => browser.close(),
    async render(student: ReportStudent, report: FullInterviewReport, number: number) {
      const html = renderInterviewReportHtml(student, report, number);
      if (Buffer.byteLength(html) > 2 * 1024 * 1024) throw new Error("This report is too large to render. Contact support.");
      const page = await browser.newPage();
      try {
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        page.on("request", request => void request.abort());
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15_000 });
        return Buffer.from(await page.pdf({ format: "A4", printBackground: true, timeout: 20_000,
          displayHeaderFooter: true, headerTemplate: "<span></span>",
          footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b">RedResumes · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
          margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" } }));
      } finally { await page.close(); }
    },
  };
}
