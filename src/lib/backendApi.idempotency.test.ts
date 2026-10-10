import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("preserves the idempotency key and payload through automatic authentication retries", async () => {
  vi.resetModules();
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) };
  vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage, location: { hostname: "localhost", pathname: "/enterprise", search: "" } });
  const { backendApi } = await import("./backendApi");
  const payload = { creditsPerStudent: 2, reason: "Credit test" };
  const requests: RequestInit[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    if (String(url).endsWith("/auth/refresh")) return new Response(JSON.stringify({ accessToken: "renewed" }), { status: 200 });
    requests.push(options!);
    return new Response(JSON.stringify({ success: true }), { status: requests.length === 1 ? 401 : 200 });
  });
  const key = "2790cdbf-6095-44fd-8b10-c4da1189c934";
  await backendApi.enterprise.distributeCredits(payload, "expired", key);
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect((request.headers as Record<string, string>)["Idempotency-Key"]).toBe(key);
    expect(JSON.parse(request.body as string)).toEqual(payload);
  }
});
