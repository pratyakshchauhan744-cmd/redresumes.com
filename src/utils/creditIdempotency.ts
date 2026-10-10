/** Pending submissions survive reloads and are shared across tabs. Keep receipts
 * after ambiguous failures; only a confirmed success ends the logical operation.
 * No automatic expiry: a late retry must still use its original server key.
 */
export async function beginCreditSubmission(actorId: string, collegeId: string | null | undefined, operation: string, payload: object) {
  const initiatedAt = Date.now();
  const canonicalPayload = JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalPayload));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const storageKey = `redresumes:pending-credit:${collegeId ?? ""}:${actorId}:${operation}:${hash}`;
  const claim = () => {
    const previous = localStorage.getItem(storageKey);
    if (previous) {
      const record = JSON.parse(previous) as { key: string; completedAt?: number };
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.key)) {
        throw new Error("Pending credit request is invalid. Please contact support before resubmitting.");
      }
      // A tab that started while the old operation was pending must still replay
      // it, even if the first tab completed before this tab acquired the lock.
      if (record.completedAt === undefined || record.completedAt >= initiatedAt) return record.key;
    }
    const key = crypto.randomUUID();
    // Fail before submitting if durable browser storage is unavailable.
    localStorage.setItem(storageKey, JSON.stringify({ key }));
    return key;
  };
  const key = navigator.locks
    ? await navigator.locks.request(storageKey, claim)
    : claim();
  return {
    key,
    async complete() {
      const finish = () => {
        const stored = localStorage.getItem(storageKey);
        if (stored && JSON.parse(stored).key === key) {
          localStorage.setItem(storageKey, JSON.stringify({ key, completedAt: Date.now() }));
        }
      };
      if (navigator.locks) await navigator.locks.request(storageKey, finish);
      else finish();
    },
  };
}
