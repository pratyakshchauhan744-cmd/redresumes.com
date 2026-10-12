export function interviewReportPath(sessionId: string): string {
  return `/interview/report/${encodeURIComponent(sessionId)}`;
}
