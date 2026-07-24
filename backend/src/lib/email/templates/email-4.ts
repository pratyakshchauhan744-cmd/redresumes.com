import { env } from "../../../config/env.js";
import type { UsageStats } from "../../onboarding/rules.js";

// ---------------------------------------------------------------------------
// Email 4 — Social Proof / Dashboard Nudge
// Sent 7 days after resume download (3 days after Email 3).
//
// Uses real usage stats from getUsageStats() — we never hardcode an
// unverified percentage claim. If callbackImprovementClaim is null
// the email omits that stat line entirely.
// ---------------------------------------------------------------------------

export interface Email4Props {
  userName: string;
  userId: string;
  stats: UsageStats;
}

function formatGreetingName(userName?: string | null): string {
  if (!userName || !userName.trim()) return "there";
  return userName.trim().split(" ")[0];
}

export function renderEmail4(props: Email4Props): {
  subject: string;
  html: string;
  templateKey: string;
  isUpgradeOriented: boolean;
} {
  const appUrl = env.APP_URL || "http://localhost:4000";
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${props.userId}`;
  const dashboardUrl = `${frontendUrl}/dashboard`;
  const interviewUrl = `${frontendUrl}/interview-practice`;
  const greetingName = formatGreetingName(props.userName);

  const { stats } = props;

  const callbackLine = stats.callbackImprovementClaim
    ? `<p style="color:#4a5568;line-height:1.6;margin:0 0 16px;"><strong>${stats.callbackImprovementClaim}</strong></p>`
    : "";

  return {
    subject: "How job seekers are getting more callbacks",
    templateKey: "email-4-social-proof",
    isUpgradeOriented: true,
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
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">The numbers speak, ${greetingName}</h2>
      
      ${callbackLine}
      
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        Here's what the RedResumes community has been up to:
      </p>
      
      <div style="background:#f7f7f8;border-radius:8px;padding:20px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#4a5568;font-size:14px;">Resumes created</td>
            <td style="padding:8px 0;color:#1a202c;font-weight:700;text-align:right;font-size:18px;">
              ${stats.totalResumesCreated.toLocaleString()}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#4a5568;font-size:14px;border-top:1px solid #e2e8f0;">Mock interviews completed</td>
            <td style="padding:8px 0;color:#1a202c;font-weight:700;text-align:right;font-size:18px;border-top:1px solid #e2e8f0;">
              ${stats.totalMockInterviews.toLocaleString()}
            </td>
          </tr>
        </table>
      </div>
      
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        Job seekers who combine a polished resume with mock interview practice
        tend to feel significantly more confident walking into real interviews.
        Your resume is already done — why not try a quick practice round?
      </p>
      
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${interviewUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          Try a Mock Interview
        </a>
      </div>
      
      <p style="color:#718096;line-height:1.6;margin:0;font-size:14px;">
        This is the last email in our onboarding series. You can always
        find everything in your <a href="${dashboardUrl}" style="color:#e53e3e;">dashboard</a>.
      </p>
      <br/>
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
