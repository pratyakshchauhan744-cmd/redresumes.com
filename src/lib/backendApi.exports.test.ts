import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let api: typeof import("./backendApi").backendApi;
let auth: typeof import("./auth");
const clicks = vi.fn();
const remove = vi.fn();
const createUrl = vi.fn();
const revoke = vi.fn();
const anchors: Array<{ href: string; download: string; click: typeof clicks; remove: typeof remove }> = [];
function storage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: key => { entries.delete(key); }, clear: () => entries.clear(), key: index => [...entries.keys()][index] ?? null };
}
const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const csv = (filename = 'attachment; filename="college reports.csv"') => new Response("name,score\nStudent,90\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": filename } });
beforeEach(async () => {
  vi.resetModules(); clicks.mockReset(); remove.mockReset(); createUrl.mockReset().mockReturnValue("blob:download"); revoke.mockReset(); anchors.length = 0;
  vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage(), location: { hostname: "localhost", pathname: "/enterprise", search: "?tab=reports", href: "/enterprise" }, URL: { createObjectURL: createUrl, revokeObjectURL: revoke } });
  vi.stubGlobal("document", { body: { appendChild: vi.fn() }, createElement: () => { const anchor = { href: "", download: "", click: clicks, remove }; anchors.push(anchor); return anchor; } });
  auth = await import("./auth"); api = (await import("./backendApi")).backendApi;
  auth.setStoredAuthTokens("old-token"); window.localStorage.setItem("redresumes_user", "{}");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("authenticated exports", () => {
  it("uses credentials and current token, preserves CSV content, MIME and filename", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(csv());
    await api.enterprise.downloadReports({ search: "A & B", program: "CS" });
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain("search=A+%26+B"); expect(String(url)).not.toContain("token");
    expect(options?.credentials).toBe("include"); expect(options?.method).toBe("GET");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer old-token");
    const blob: Blob = createUrl.mock.calls[0][0]; expect(blob.type).toBe("text/csv;charset=utf-8"); expect(await blob.text()).toBe("name,score\nStudent,90\n");
    expect(anchors[0].download).toBe("college reports.csv"); expect(clicks).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledWith("blob:download"); expect(remove).toHaveBeenCalledOnce();
  });
  it("renews through the cookie session when the access token is missing", async () => {
    auth.clearStoredAuthTokens();
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      expect(options?.credentials).toBe("include");
      if (String(url).endsWith("/auth/refresh")) return json(200, { accessToken: "new-token" });
      expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer new-token");
      return csv();
    });
    await api.enterprise.downloadReports(); expect(fetch).toHaveBeenCalledTimes(2); expect(clicks).toHaveBeenCalledTimes(1);
  });
  it("refreshes and retries exactly once with unchanged query/options, including a stale caller token", async () => {
    let exports = 0;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      expect(options?.credentials).toBe("include");
      if (String(url).endsWith("/auth/refresh")) return json(200, { accessToken: "new-token" });
      exports++; expect((options?.headers as Record<string, string>).Authorization).toBe(exports === 1 ? "Bearer old-token" : "Bearer new-token");
      return exports === 1 ? json(401, {}) : csv();
    });
    await api.enterprise.downloadReports({ section: "A", search: "student" }, "old-token");
    expect(fetch).toHaveBeenCalledTimes(3); expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[2][0]);
    expect(fetch.mock.calls[0][1]?.method).toBe(fetch.mock.calls[2][1]?.method); expect(clicks).toHaveBeenCalledTimes(1);
    await api.enterprise.downloadReports({}, "old-token"); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("shares renewal between simultaneous exports and a JSON request", async () => {
    let refreshes = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      if (String(url).endsWith("/auth/refresh")) { refreshes++; return json(200, { accessToken: "new-token" }); }
      if ((options?.headers as Record<string, string>).Authorization !== "Bearer new-token") return json(401, {});
      return String(url).includes("/reports/export") ? csv() : json(200, { success: true });
    });
    await Promise.all([api.enterprise.downloadReports(), api.enterprise.downloadReports(), api.enterprise.getStats("old-token")]);
    expect(refreshes).toBe(1); expect(clicks).toHaveBeenCalledTimes(2);
  });
  it("uses the standard logout/redirect flow after renewal rejection without downloading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(401, {}));
    await expect(api.enterprise.downloadReports()).rejects.toThrow("Session expired");
    expect(auth.getStoredAccessToken()).toBeNull(); expect(window.localStorage.getItem("redresumes_user")).toBeNull();
    expect(window.location.href).toContain("/login?redirect="); expect(clicks).not.toHaveBeenCalled();
  });
  it("does not renew indefinitely when the renewed token is rejected", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async url => String(url).endsWith("/auth/refresh") ? json(200, { accessToken: "new-token" }) : json(401, {}));
    await expect(api.enterprise.downloadReports()).rejects.toThrow("Unauthorized"); expect(fetch).toHaveBeenCalledTimes(3); expect(clicks).not.toHaveBeenCalled();
  });
  it.each([403, 404, 429, 500])("uses shared HTTP %s errors without token renewal or a file", async status => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(status, { message: "Expected export error" }));
    await expect(api.enterprise.downloadReports()).rejects.toThrow("Expected export error");
    expect(fetch).toHaveBeenCalledTimes(1); expect(createUrl).not.toHaveBeenCalled();
  });
  it("handles HTML server errors and network failures without corrupt downloads", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("<html>gateway</html>", { status: 502 })).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.enterprise.downloadReports()).rejects.toThrow("Service temporarily unavailable");
    await expect(api.enterprise.downloadReports()).rejects.toThrow("Cannot reach backend"); expect(fetch).toHaveBeenCalledTimes(2); expect(clicks).not.toHaveBeenCalled();
  });
});
describe("binary and browser download compatibility", () => {
  it("preserves XLSX bytes and MIME without JSON parsing", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x01]);
    const response = new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename*=UTF-8''Cohort%20%E2%9C%93.xlsx" } });
    const parse = vi.spyOn(response, "json"); vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    await api.enterprise.downloadReports({ format: "xlsx" });
    const blob: Blob = createUrl.mock.calls[0][0]; expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes); expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(parse).not.toHaveBeenCalled(); expect(anchors[0].download).toBe("Cohort ✓.xlsx");
  });
  it.each([new Response("{}", { headers: { "Content-Type": "application/json" } }), new Response('{"error":"unauthorized"}', { headers: { "Content-Type": "text/plain" } }), new Response("<html>login</html>", { headers: { "Content-Type": "text/csv" } }), new Response("", { headers: { "Content-Type": "text/csv" } })])("rejects invalid successful responses before creating a download", async response => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    await expect(api.enterprise.downloadReports()).rejects.toThrow(/export response/i); expect(createUrl).not.toHaveBeenCalled();
  });
  it("rejects invalid XLSX payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("login page", { headers: { "Content-Type": "application/octet-stream" } }));
    await expect(api.enterprise.downloadReports({ format: "xlsx" })).rejects.toThrow("Invalid Excel"); expect(clicks).not.toHaveBeenCalled();
  });
  it("cleans up URLs and anchors even when a browser click fails", async () => {
    clicks.mockImplementation(() => { throw new Error("browser download failed"); });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(csv());
    await expect(api.enterprise.downloadReports()).rejects.toThrow("browser download failed"); expect(remove).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith("blob:download");
  });
});

describe("individual and bulk interview report downloads", () => {
  it("retrieves a selected report without creating a file", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { sessionId: "session-8", student: { id: "student-5" } }));
    const report = await api.enterprise.getStudentInterviewReport("student-5", "session-8", "old-token");
    expect(report.sessionId).toBe("session-8");
    expect(String(fetch.mock.calls[0][0])).toContain("/students/student-5/interviews/session-8/report");
    expect(clicks).not.toHaveBeenCalled();
  });
  it("preserves individual PDF bytes and filename", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("%PDF-1.4\nreport-8", { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Aditya_Interview_8.pdf"' } }));
    await api.enterprise.downloadInterviewPdf("student-5", "session-8", "old-token");
    expect(String(fetch.mock.calls[0][0])).toContain("/students/student-5/interviews/session-8/report/pdf");
    expect(anchors[0].download).toBe("Aditya_Interview_8.pdf");
    expect(await (createUrl.mock.calls[0][0] as Blob).text()).toBe("%PDF-1.4\nreport-8");
  });
  it.each([{ mode: "all" as const }, { mode: "selected" as const, sessionIds: ["session-1", "session-8"] }])("posts an explicit ZIP selection %j", async selection => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bytes, { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="Aditya_Reports.zip"' } }));
    await api.enterprise.downloadInterviewZip("student-5", selection, "old-token");
    expect(fetch.mock.calls[0][1]?.method).toBe("POST"); expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(selection);
    expect(anchors[0].download).toBe("Aditya_Reports.zip"); expect(clicks).toHaveBeenCalledTimes(1);
  });
  it.each(["application/pdf", "application/zip"])("rejects a corrupt %s without a success download", async contentType => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not a report", { headers: { "Content-Type": contentType } }));
    await expect(contentType === "application/pdf" ? api.enterprise.downloadInterviewPdf("s", "i", "old-token") : api.enterprise.downloadInterviewZip("s", { mode: "all" }, "old-token")).rejects.toThrow(/Invalid/);
    expect(clicks).not.toHaveBeenCalled();
  });
});
