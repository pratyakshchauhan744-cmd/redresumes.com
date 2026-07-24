import { env } from "../../../config/env.js";

// ---------------------------------------------------------------------------
// Email 3 — Portfolio Website (with branching variants)
// Sent 4 days after resume download (2 days after Email 2).
//
//   portfolioUpgraded = false → upsell: "Stand out with a personal portfolio site"
//   portfolioUpgraded = true  → activation: "Publish and share your portfolio"
// ---------------------------------------------------------------------------

export interface Email3Props {
  userName: string;
  userId: string;
  portfolioUpgraded: boolean;
}

export type Email3Variant = "upsell_portfolio" | "activate_portfolio";

function formatGreetingName(userName?: string | null): string {
  if (!userName || !userName.trim()) return "there";
  return userName.trim().split(" ")[0];
}

export function renderEmail3(props: Email3Props): {
  subject: string;
  html: string;
  templateKey: string;
  isUpgradeOriented: boolean;
  variant: Email3Variant;
} {
  const variant: Email3Variant = props.portfolioUpgraded
    ? "activate_portfolio"
    : "upsell_portfolio";

  const appUrl = env.APP_URL || "http://localhost:4000";
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
  const unsubscribeUrl = `${appUrl}/api/onboarding/unsubscribe?userId=${props.userId}`;
  const portfolioUrl = `${frontendUrl}/builder`;
  const dashboardUrl = `${frontendUrl}/dashboard`;
  const greetingName = formatGreetingName(props.userName);

  const subjectMap: Record<Email3Variant, string> = {
    upsell_portfolio:
      "Stand out from 200+ applicants with a personal portfolio site",
    activate_portfolio:
      "Your portfolio site is ready — publish and share it!",
  };

  const bodyMap: Record<Email3Variant, string> = {
    upsell_portfolio: `
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">Go beyond the resume, ${greetingName}</h2>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        When a recruiter receives 200+ applications for a single opening, a resume alone
        rarely stands out. A <strong>personal portfolio website</strong> lets you showcase
        projects, case studies, and testimonials — all in one professional link.
      </p>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        RedResumes can generate yours automatically from the resume you already built.
        Pick a template, customize the colors, and publish in under 2 minutes.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${portfolioUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          Create Your Portfolio Site
        </a>
      </div>
    `,
    activate_portfolio: `
      <h2 style="color:#1a202c;margin:0 0 16px;font-size:20px;">Your portfolio is ready, ${greetingName}! 🎉</h2>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 16px;">
        Great move — you've already set up your personal portfolio site. Now let's
        make sure the right people see it:
      </p>
      <ul style="color:#4a5568;line-height:1.8;margin:0 0 16px;padding-left:20px;">
        <li>Add your portfolio URL to your resume header and LinkedIn profile</li>
        <li>Include it in cover letter sign-offs</li>
        <li>Share it in job applications that accept "additional links"</li>
      </ul>
      <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
        The more places it appears, the more recruiters will click through.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${portfolioUrl}" style="display:inline-block;background:#e53e3e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">
          View & Share Your Portfolio
        </a>
      </div>
    `,
  };

  return {
    subject: subjectMap[variant],
    templateKey: `email-3-${variant}`,
    isUpgradeOriented: variant === "upsell_portfolio",
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
      ${bodyMap[variant]}
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
