import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginCreditSubmission } from "./creditIdempotency";
import { webcrypto } from "node:crypto";

const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  let clock = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => ++clock);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("navigator", {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("durable pending credit submissions", () => {
  it("recovers the same key after an ambiguous failure and refresh, including reordered properties", async () => {
    const initial = await beginCreditSubmission("actor", "tenant", "bulk", { amount: 2, reason: "test" });
    const retry = await beginCreditSubmission("actor", "tenant", "bulk", { reason: "test", amount: 2 });
    expect(retry.key).toBe(initial.key);
    expect(retry.key).toMatch(/^[0-9a-f-]{36}$/);
    await retry.complete();
    expect((await beginCreditSubmission("actor", "tenant", "bulk", { amount: 2, reason: "test" })).key).not.toBe(initial.key);
  });
  it("isolates tenants, actors, operations and accounting payloads", async () => {
    const keys = await Promise.all([
      beginCreditSubmission("a", "t", "bulk", { amount: 1 }),
      beginCreditSubmission("b", "t", "bulk", { amount: 1 }),
      beginCreditSubmission("a", "u", "bulk", { amount: 1 }),
      beginCreditSubmission("a", "t", "single", { amount: 1 }),
      beginCreditSubmission("a", "t", "bulk", { amount: 2 }),
    ]);
    expect(new Set(keys.map(k => k.key)).size).toBe(5);
  });
  it("coordinates tab claims through Web Locks", async () => {
    const request = vi.fn(async (_name, claim) => claim());
    vi.stubGlobal("navigator", { locks: { request } });
    const [a, b] = await Promise.all([beginCreditSubmission("a", "t", "bulk", {}), beginCreditSubmission("a", "t", "bulk", {})]);
    expect(a.key).toBe(b.key);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("replays a submission from a tab that started before another tab completed", async () => {
    const initial = await beginCreditSubmission("a", "t", "bulk", {});
    let waitingClaim: (() => string) | undefined;
    let release: ((key: string) => void) | undefined;
    vi.stubGlobal("navigator", { locks: { request: (_name: string, claim: () => string) => {
      if (waitingClaim) return claim();
      waitingClaim = claim;
      return new Promise<string>(resolve => { release = resolve; });
    } } });
    const delayedTab = beginCreditSubmission("a", "t", "bulk", {});
    await vi.waitFor(() => expect(waitingClaim).toBeDefined());
    await initial.complete();
    release!(waitingClaim!());
    expect((await delayedTab).key).toBe(initial.key);
  });
  it("fails before sending if pending state cannot be saved", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("storage blocked"); } });
    await expect(beginCreditSubmission("a", "t", "bulk", {})).rejects.toThrow("storage blocked");
  });
});
