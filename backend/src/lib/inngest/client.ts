import { Inngest } from "inngest";

// ---------------------------------------------------------------------------
// Event payload types — every event that flows through Inngest is defined here
// so the client, workflow functions, and event-sending helpers all share one
// strongly-typed contract.
// ---------------------------------------------------------------------------

/** Granular mock interview engagement states. Interviews are a paid feature,
 *  so we distinguish: free trial preview, entered interview room, completed
 *  a full session, and paid for ongoing interview access. */
export type MockInterviewState =
  | "not_started"
  | "started_trial"
  | "entered_room"
  | "completed_session"
  | "paid_access";

export type Events = {
  "user/resume.downloaded": {
    data: {
      userId: string;
      resumeId: string;
      userEmail: string;
      userName: string;
    };
  };
  "user/mock_interview.started": {
    data: {
      userId: string;
      sessionId: string;
      /** Which engagement level was reached */
      state: MockInterviewState;
    };
  };
  "user/mock_interview.completed": {
    data: {
      userId: string;
      sessionId: string;
    };
  };
  "user/portfolio.upgraded": {
    data: {
      userId: string;
    };
  };
  "user/paid_plan.upgraded": {
    data: {
      userId: string;
      planId: string;
    };
  };
  "user/unsubscribed": {
    data: {
      userId: string;
    };
  };
};

// ---------------------------------------------------------------------------
// Inngest client — typed with the Events map above (Inngest v4)
// ---------------------------------------------------------------------------

export const inngestClient = new Inngest({ id: "redresumes" });

// ---------------------------------------------------------------------------
// Typed event-sending helper — use this instead of calling inngest.send()
// directly so we get compile-time checks on event names and payloads.
// ---------------------------------------------------------------------------

export async function sendEvent<K extends keyof Events>(
  name: K,
  payload: Events[K]
): Promise<{ ids: string[] }> {
  return inngestClient.send({ name, data: (payload as any).data });
}
