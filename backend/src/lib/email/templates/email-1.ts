import { env } from "../../../config/env.js";

// ---------------------------------------------------------------------------
// Email 1 — Welcome + ATS Scorecard
// Sent immediately after resume download.
// ---------------------------------------------------------------------------

export interface Email1Props {
  userName: string;
  resumeId: string;
  userId: string;
}

function formatGreetingName(userName?: string | null): string {
  if (!userName || !userName.trim()) return "there";
  return userName.trim().split(" ")[0];
}

export function renderEmail1(props: Email1Props): {
  subject: string;
  html: string;
  templateKey: string;
  isUpgradeOriented: boolean;
} {
  const appUrl = env.APP_URL || "http://localhost:4000";
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${props.userId}`;
  const scorecardUrl = `${frontendUrl}/resume/${props.resumeId}/scorecard`;
  const dashboardUrl = `${frontendUrl}/dashboard`;
  const greetingName = formatGreetingName(props.userName);

  return {
    subject: "Your resume is ready 🚀 (+ your ATS scorecard inside)",
    templateKey: "email-1-welcome",
    isUpgradeOriented: false,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#e53e3e,#c53030);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">RedResumes</h1>
    </div>
    
    <!-- Body -->
    <div style="padding:32px 24px;">
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">Hey ${greetingName} 👋</h2>
      
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        Your resume is looking great! We've run it through our ATS compatibility scanner
        to see how well it performs against applicant tracking systems used by top companies.
      </p>
      
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        Check out your personalized ATS scorecard — it breaks down formatting, keyword
        density, and section completeness so you know exactly where to improve.
      </p>
      
      <!-- CTA -->
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${scorecardUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          View Your ATS Scorecard
        </a>
      </div>
      
      <p style="color:#718096;line-height:1.6;margin:0 0 8px;font-size:14px;">
        Over the next week, we'll share a few tips to help you land more interviews.
        Nothing spammy — just practical advice from our team.
      </p>
      
      <p style="color:#718096;line-height:1.6;margin:0;font-size:14px;">
        — Arvind, RedResumes
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding:16px 24px;background:#f7f7f8;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${dashboardUrl}" style="color:#718096;font-size:12px;text-decoration:none;">Go to Dashboard</a>
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
