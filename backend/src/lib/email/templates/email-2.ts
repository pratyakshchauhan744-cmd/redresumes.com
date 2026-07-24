import { env } from "../../../config/env.js";
import type { MockInterviewState } from "../../inngest/client.js";

// ---------------------------------------------------------------------------
// Email 2 — Mock Interview Pitch (with branching variants)
// Sent 2 days after Email 1. Variant selection based on mock interview state:
//
//   not_started | started_trial → generic trial pitch
//   entered_room                → "improve clarity / pace / stress-mode" alt
//   completed_session           → advanced interview polish
//   paid_access                 → advanced polish (they've already paid)
// ---------------------------------------------------------------------------

export interface Email2Props {
  userName: string;
  userId: string;
  mockInterviewState: MockInterviewState;
}

export type Email2Variant = "generic_trial" | "started_clarity" | "completed_polish";

function resolveVariant(state: MockInterviewState): Email2Variant {
  switch (state) {
    case "not_started":
    case "started_trial":
      return "generic_trial";
    case "entered_room":
      return "started_clarity";
    case "completed_session":
    case "paid_access":
      return "completed_polish";
  }
}

function formatGreetingName(userName?: string | null): string {
  if (!userName || !userName.trim()) return "there";
  return userName.trim().split(" ")[0];
}

export function renderEmail2(props: Email2Props): {
  subject: string;
  html: string;
  templateKey: string;
  isUpgradeOriented: boolean;
  variant: Email2Variant;
} {
  const variant = resolveVariant(props.mockInterviewState);
  const appUrl = env.APP_URL || "http://localhost:4000";
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${props.userId}`;
  const interviewUrl = `${frontendUrl}/interview-practice`;
  const dashboardUrl = `${frontendUrl}/dashboard`;
  const greetingName = formatGreetingName(props.userName);

  const subjectMap: Record<Email2Variant, string> = {
    generic_trial: "Practice answering questions about your specific resume",
    started_clarity: "Improve your answer clarity, pace & stress-mode performance",
    completed_polish: "Polish your interview technique for even better results",
  };

  const bodyMap: Record<Email2Variant, string> = {
    generic_trial: `
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">Ready to practice, ${greetingName}?</h2>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        Your resume tells your story — but in an interview, you need to <strong>tell it out loud</strong>.
        Our AI mock interviewer generates questions tailored to <em>your specific resume</em>, so you
        practice exactly what a real recruiter would ask.
      </p>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        Try a free preview session. No credit card required — just pick a role and start practicing.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${interviewUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          Start a Practice Interview
        </a>
      </div>
    `,
    started_clarity: `
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">Nice start, ${greetingName}! Let's sharpen your answers.</h2>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        You've already jumped into the interview room — great first step. Now let's focus
        on the areas that make the biggest difference:
      </p>
      <ul style="color:#4a5568;line-height:1.8;margin:0 0 24px;padding-left:20px;">
        <li><strong>Answer clarity</strong> — structure your responses with the STAR method</li>
        <li><strong>Pacing</strong> — avoid rushing through complex technical questions</li>
        <li><strong>Stress mode</strong> — try our pressure-round to simulate tough panels</li>
      </ul>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${interviewUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          Continue Practicing
        </a>
      </div>
    `,
    completed_polish: `
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">You completed a session, ${greetingName}! Here's how to level up.</h2>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        Completing a mock interview puts you ahead of most candidates. Now it's about
        polishing the details that separate "good" from "hired":
      </p>
      <ul style="color:#4a5568;line-height:1.8;margin:0 0 16px;padding-left:20px;">
        <li>Review your <strong>detailed feedback report</strong> for each answer</li>
        <li>Practice answers that scored below 7/10</li>
        <li>Try a different interviewer persona (HR vs. Technical Lead)</li>
      </ul>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        Each round gets easier. Keep building confidence.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${interviewUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          Start Another Round
        </a>
      </div>
    `,
  };

  const subject = subjectMap[variant];
  const body = bodyMap[variant];

  return {
    subject,
    templateKey: `email-2-${variant}`,
    isUpgradeOriented: variant === "generic_trial",
    variant,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;">
    <div style="background:linear-gradient(135deg,#e53e3e,#c53030);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">RedResumes</h1>
    </div>
    <div style="padding:32px 24px;">
      ${body}
      <p style="color:#718096;line-height:1.6;margin:0;font-size:14px;">— Arvind, RedResumes</p>
    </div>
    <div style="padding:16px 24px;background:#f7f7f8;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${dashboardUrl}" style="color:#718096;font-size:12px;text-decoration:none;">Dashboard</a>
      <span style="color:#cbd5e0;margin:0 8px;">|</span>
      <a href="${unsubscribeUrl}" style="color:#718096;font-size:12px;text-decoration:none;">Unsubscribe</a>
      <p style="color:#a0aec0;font-size:11px;margin:8px 0 0;">
        RedResumes · You're receiving this because you created a resume on our platform.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
}
