import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, Loader2 } from "lucide-react";
import { backendApi, isAbortError } from "../lib/backendApi";
import type { StudentInterviewHistory } from "../types/enterpriseReports";
import { InterviewReportPage } from "../pages/InterviewReportPage";
import { formatScore } from "../utils/score";

const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700";
const primary = `${button} bg-primary !text-white hover:!bg-red-800`;

export const StudentInterviewHistoryView: React.FC<{ studentId: string; token: string; canExport: boolean }> = ({ studentId, token, canExport }) => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.floor(Number(params.get("historyPage")) || 1));
  const sessionId = params.get("reportSession");
  const [history, setHistory] = useState<StudentInterviewHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [download, setDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const downloadLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const navigate = (changes: Record<string, string | null>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(changes).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    return next;
  });
  const backToHistory = () => navigate({ reportSession: null });
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [sessionId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setHistory(null);
    backendApi.enterprise.getStudentInterviews(studentId, page, token, controller.signal)
      .then(data => { if (!controller.signal.aborted) setHistory(data); })
      .catch(error => { if (!controller.signal.aborted && !isAbortError(error)) setError(error.message || "Unable to load interview history."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [studentId, page, token, retry]);

  async function startDownload(kind: string, action: () => Promise<void>) {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownload(kind); setDownloadError("");
    try { await action(); } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed. Please retry.");
    } finally { downloadLock.current = false; setDownload(null); }
  }
  const downloadPdf = (id: string) => startDownload(id, () => backendApi.enterprise.downloadInterviewPdf(studentId, id, token));
  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const limit = history?.maxReportsPerZip ?? 50;

  return <section className="enterprise-tab-content space-y-5 text-slate-800">
    <nav aria-label="Report navigation" className="flex flex-wrap items-center gap-3 text-sm">
      <button className={button} onClick={() => navigate({ reportStudent: null, reportSession: null, historyPage: null })}><ArrowLeft className="w-4 h-4" /> Cohort Reports & Analytics</button>
      <span aria-hidden="true">/</span><span>Student Interview History</span>{sessionId && <><span aria-hidden="true">/</span><span>Individual Report</span></>}
    </nav>
    {downloadError && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">{downloadError} <button className="underline ml-2" onClick={() => setDownloadError("")}>Dismiss</button></div>}
    {download && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Preparing your download…</p>}
    {sessionId ? <InterviewReportPage key={sessionId} enterprise={{ studentId, sessionId, token, onBack: backToHistory, onDownload: () => void downloadPdf(sessionId), downloading: download !== null }} /> : <>
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold focus:outline-none">Student Interview History</h2>
        {history && <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <p><span className="block text-slate-500">Student</span><strong>{history.student.name}</strong></p>
          <p><span className="block text-slate-500">Enrollment</span>{history.student.enrollmentNumber}</p>
          <p><span className="block text-slate-500">Program / Cohort</span>{[history.student.program, history.student.course, history.student.section, history.student.batch].filter(Boolean).join(" · ")}</p>
          <p><span className="block text-slate-500">Total Interviews</span><strong>{history.total}</strong></p>
        </div>}
      </header>
      {loading ? <div role="status" aria-label="Loading interview history" className="rounded-2xl border bg-white p-6 space-y-4">{[1, 2, 3].map(row => <div key={row} className="h-10 rounded bg-slate-100 animate-pulse" />)}<span className="sr-only">Loading interview history…</span></div>
        : error ? <div role="alert" className="rounded-xl bg-red-50 p-5"><p>{error}</p><button className={`${button} mt-3`} onClick={() => setRetry(value => value + 1)}>Retry interview history</button></div>
        : history && <>
          {canExport && <div className="flex flex-wrap items-center gap-3">
            <button className={primary} disabled={download !== null || selected.size === 0 || selected.size > limit} onClick={() => void startDownload("selected", () => backendApi.enterprise.downloadInterviewZip(studentId, { mode: "selected", sessionIds: [...selected] }, token))}><Download className="w-4 h-4" /> Download Selected Reports ({selected.size})</button>
            <button className={button} disabled={download !== null || !history.total || history.total > limit} onClick={() => void startDownload("all", () => backendApi.enterprise.downloadInterviewZip(studentId, { mode: "all" }, token))}>Download All Reports</button>
            {selected.size > 0 && <button className={button} onClick={() => setSelected(new Set())}>Clear selection</button>}
            <p className="w-full text-xs text-slate-500">ZIP downloads contain separate PDFs. Maximum {limit} reports, 25 MB, and 90 seconds per export. Selections are kept across pages.{history.total > limit && " Select reports in smaller groups to download this history."}</p>
            {selected.size > limit && <p role="alert" className="text-sm text-red-700">Select no more than {limit} interviews per download.</p>}
          </div>}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600"><tr>
                {canExport && <th className="p-4"><input type="checkbox" aria-label="Select all interviews on this page" disabled={!history.interviews.length}
                  checked={history.interviews.length > 0 && history.interviews.every(interview => selected.has(interview.sessionId))}
                  onChange={event => { const checked = event.target.checked; setSelected(previous => { const next = new Set(previous); history.interviews.forEach(interview => checked ? next.add(interview.sessionId) : next.delete(interview.sessionId)); return next; }); }} /></th>}
                {["Interview", "Target Role", "Difficulty", "Score", "Date", "Actions"].map(title => <th key={title} scope="col" className="px-4 py-3">{title}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.interviews.map(interview => <tr key={interview.sessionId}>
                  {canExport && <td className="p-4"><input type="checkbox" aria-label={`Select Interview ${interview.interviewNumber}`} checked={selected.has(interview.sessionId)} onChange={() => toggle(interview.sessionId)} /></td>}
                  <td className="px-4 py-4 whitespace-nowrap font-semibold">Interview {interview.interviewNumber}</td>
                  <td className="px-4 py-4">{interview.targetRole}</td><td className="px-4 py-4 capitalize">{interview.difficulty}</td>
                  <td className="px-4 py-4"><span className={`rounded px-2 py-1 font-bold ${interview.overallScore === null ? "text-slate-500" : interview.overallScore >= 80 ? "bg-emerald-50 text-emerald-700" : interview.overallScore >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{formatScore(interview.overallScore)}</span></td>
                  <td className="px-4 py-4 whitespace-nowrap">{new Date(interview.completedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2">
                    <button className={primary} onClick={() => navigate({ reportSession: interview.sessionId })}><Eye className="w-4 h-4" /> View Report</button>
                    <button className={button} disabled={download !== null} onClick={() => void downloadPdf(interview.sessionId)}><Download className="w-4 h-4" />{download === interview.sessionId ? "Preparing PDF…" : "Download PDF"}</button>
                  </div></td>
                </tr>)}
                {!history.interviews.length && <tr><td colSpan={canExport ? 7 : 6} className="p-10 text-center text-slate-500">{history.total ? "No interviews on this page. Return to a previous page." : "This student has no completed, evaluated interview reports yet."}</td></tr>}
              </tbody>
            </table></div>
            <div className="p-4 border-t flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Page {page} of {Math.max(1, history.pagination.totalPages)} · {history.total} interviews</span>
              <div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => navigate({ historyPage: String(page - 1) })}>Previous interviews page</button><button className={button} disabled={page >= history.pagination.totalPages} onClick={() => navigate({ historyPage: String(page + 1) })}>Next interviews page</button></div>
            </div>
          </div>
        </>}
    </>}
  </section>;
}
