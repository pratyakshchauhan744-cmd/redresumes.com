// ---------------------------------------------------------------------------
// Structured logging stub — wire to a real logger (PostHog, Segment, etc.)
// later. Every call-site uses this so we have a single seam to swap out.
// ---------------------------------------------------------------------------

export interface LogPayload {
  [key: string]: unknown;
}

export function logEvent(name: string, payload: LogPayload = {}): void {
  // Replace with structured logger / analytics SDK when ready
  console.log(JSON.stringify({ event: name, ts: new Date().toISOString(), ...payload }));
}
