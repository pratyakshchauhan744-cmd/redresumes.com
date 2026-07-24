import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type SignInMethod } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";

const router = Router();
const REFRESH_COOKIE_NAME = "rr_refresh_token";
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const googleClientId = (env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || "").trim();
let productionPrisma: PrismaClient | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f8fafc; color: #18181b; }
    main { max-width: 1100px; margin: 0 auto; padding: 40px 20px 64px; }
    nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    a, button { border-radius: 999px; font-weight: 700; }
    a { color: #b91c1c; text-decoration: none; }
    nav a, button { border: 1px solid #fecaca; background: #fff; padding: 10px 16px; }
    h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.15; }
    p { color: #52525b; line-height: 1.6; }
    form, section { background: #fff; border: 1px solid #e4e4e7; border-radius: 18px; padding: 22px; box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06); }
    label { display: block; margin-top: 14px; font-size: 13px; font-weight: 800; color: #3f3f46; }
    input { box-sizing: border-box; width: 100%; margin-top: 7px; border: 1px solid #d4d4d8; border-radius: 12px; padding: 12px 14px; font: inherit; }
    button { margin-top: 18px; cursor: pointer; background: #dc2626; color: #fff; border-color: #dc2626; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 14px; background: #fff; }
    th, td { border-bottom: 1px solid #e4e4e7; padding: 11px 12px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #fef2f2; color: #7f1d1d; }
    code, pre { background: #18181b; color: #f4f4f5; border-radius: 14px; }
    code { padding: 2px 6px; }
    pre { overflow: auto; padding: 16px; }
    .ok { color: #166534; font-weight: 800; }
    .bad { color: #b91c1c; font-weight: 800; }
    .muted { color: #71717a; font-size: 14px; }
    .split { display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); align-items: start; }
    .grid { display: grid; gap: 22px; }
  </style>
</head>
<body>
  <main>
    <nav>
      <a href="/api/dev">Dev Home</a>
      <a href="/api/dev/live">Live Sign-ins</a>
      <a href="/api/dev/signins">Sign-ins</a>
      <a href="/api/dev/users">Users</a>
      <a href="/health">Health</a>
    </nav>
    ${body}
  </main>
</body>
</html>`;
}

function sendPage(res: Response, title: string, body: string): void {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com",
      "frame-src https://accounts.google.com",
      "connect-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.googleusercontent.com"
    ].join("; ")
  );
  res.type("html").send(page(title, body));
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function methodLabel(method: SignInMethod): string {
  return method === "google" ? "Google" : "Email / password";
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return values;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
      return values;
    }, {});
}

function getProductionDatabaseUrl(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "../.vercel/.env.production.local"),
    path.resolve(process.cwd(), ".vercel/.env.production.local")
  ];

  for (const candidate of candidates) {
    const values = parseEnvFile(candidate);
    const url = values.DATABASE_PUBLIC_URL || values.DATABASE_URL;
    if (url) return url;
  }

  return null;
}

function getProductionPrisma(): PrismaClient | null {
  const databaseUrl = getProductionDatabaseUrl();
  if (!databaseUrl) return null;

  productionPrisma ??= new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
  return productionPrisma;
}

async function renderSignIns(res: Response, options: { source: "local" | "production" }): Promise<void> {
  const client = options.source === "production" ? getProductionPrisma() : prisma;
  if (!client) {
    sendPage(res, "Live Sign-in Activity", `
      <h1>Live Sign-in Activity</h1>
      <p class="bad">Production database settings were not found.</p>
      <p class="muted">Run <code>vercel env pull .vercel/.env.production.local --environment=production</code> or open local Sign-ins.</p>
    `);
    return;
  }

  const [signIns, activeSessions] = await Promise.all([
    client.signInEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    }).catch((error) => {
      console.warn("Sign-in event query skipped:", error instanceof Error ? error.message : "unknown error");
      return [];
    }),
    client.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
  ]);

  const trackedUserIds = new Set(signIns.map((event) => event.userId));
  const seenSessionUserIds = new Set<string>();
  const untrackedSessions = activeSessions.filter((session) => {
    if (trackedUserIds.has(session.userId) || seenSessionUserIds.has(session.userId)) {
      return false;
    }
    seenSessionUserIds.add(session.userId);
    return true;
  });

  const trackedRows = signIns.map((event) => ({
    signedInAt: event.createdAt,
    name: event.user.name,
    email: event.user.email,
    role: event.user.role,
    method: methodLabel(event.method),
    userId: event.user.id
  }));

  const sessionRows = untrackedSessions.map((session) => ({
    signedInAt: session.createdAt,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    method: "Existing session",
    userId: session.user.id
  }));

  const activityRows = [...trackedRows, ...sessionRows]
    .sort((left, right) => right.signedInAt.getTime() - left.signedInAt.getTime());

  const rows = activityRows.map((event) => `
    <tr>
      <td>${escapeHtml(event.signedInAt.toLocaleString())}</td>
      <td>${escapeHtml(event.name)}</td>
      <td>${escapeHtml(event.email)}</td>
      <td>${escapeHtml(event.role)}</td>
      <td>${escapeHtml(event.method)}</td>
      <td>${escapeHtml(event.userId)}</td>
    </tr>
  `).join("");

  const isProduction = options.source === "production";
  sendPage(res, isProduction ? "Live Sign-in Activity" : "Local Sign-in Activity", `
    <h1>${isProduction ? "Live Production Sign-in Activity" : "Local Sign-in Activity"}</h1>
    <p>${isProduction ? "This reads the production database used by redresumes.com." : "This reads your local development database."} New logins show Google or email/password; older active sessions are shown as existing sessions.</p>
    <section>
      <table>
        <thead>
          <tr><th>Signed in at</th><th>Name</th><th>Email</th><th>Role</th><th>Method</th><th>User ID</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan=\"6\">No sign-ins recorded yet. New logins will appear here.</td></tr>"}</tbody>
      </table>
    </section>
  `);
}

router.get("/", (_req, res, next) => {
  renderSignIns(res, { source: getProductionDatabaseUrl() ? "production" : "local" }).catch(next);
});

router.get("/live", (_req, res, next) => {
  renderSignIns(res, { source: "production" }).catch(next);
});

router.get("/signins", (_req, res, next) => {
  renderSignIns(res, { source: "local" }).catch(next);
});

router.get("/login", (_req, res) => {
  const googlePanel = googleClientId && !googleClientId.includes("your_google_web_client_id")
    ? `
      <section>
        <h2>Google Sign-In</h2>
        <p class="muted">This uses <code>POST /api/auth/google</code>. After success, the user appears in Show DB.</p>
        <div id="google-button"></div>
        <div id="google-result" class="muted"></div>
      </section>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      <script>
        window.onload = function () {
          const result = document.getElementById("google-result");
          if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            result.textContent = "Google script did not load. Check the client ID and internet connection.";
            return;
          }
          window.google.accounts.id.initialize({
            client_id: ${JSON.stringify(googleClientId)},
            callback: async function (response) {
              result.textContent = "Checking Google credential...";
              try {
                const apiResponse = await fetch("/api/auth/google", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential: response.credential })
                });
                const payload = await apiResponse.json();
                if (!apiResponse.ok) {
                  throw new Error(payload.message || "Google sign-in failed.");
                }
                result.innerHTML =
                  '<p class="ok">Google sign-in success.</p>' +
                  '<pre>' + JSON.stringify(payload.user, null, 2).replace(/[&<>]/g, function (char) {
                    return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char];
                  }) + '</pre>' +
                  '<p><a href="/api/dev/db">Show DB rows</a></p>';
              } catch (error) {
                result.innerHTML = '<p class="bad">' + String(error.message || error) + '</p>';
              }
            }
          });
          window.google.accounts.id.renderButton(document.getElementById("google-button"), {
            theme: "outline",
            size: "large",
            shape: "pill",
            text: "signin_with",
            width: 320
          });
        };
      </script>
    `
    : `
      <section>
        <h2>Google Sign-In</h2>
        <p class="bad">Google login is not configured.</p>
        <p class="muted">Set <code>VITE_GOOGLE_CLIENT_ID</code> or <code>GOOGLE_CLIENT_ID</code> in <code>backend/.env</code>, then restart the backend.</p>
      </section>
    `;

  sendPage(res, "Login Test", `
    <h1>Login Test</h1>
    <p>Test email/password login or Google Sign-In directly in the browser.</p>
    <div class="split">
      <form method="post" action="/api/dev/login">
        <h2>Email Login</h2>
        <p class="muted">This submits the same check as <code>POST /api/auth/login</code>.</p>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value="candidate@example.com" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" value="Password@123" required>
        <button type="submit">Sign in</button>
      </form>
      ${googlePanel}
    </div>
  `);
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const user = await prisma.user.findUnique({ where: { email } });
    const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !isValid) {
      res.status(401);
      sendPage(res, "Login Failed", `
        <h1>Login Failed</h1>
        <p class="bad">Invalid email or password.</p>
        <p><a href="/api/dev/login">Try again</a></p>
      `);
      return;
    }

    const payload = { sub: user.id, role: user.role as any, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_MAX_AGE_MS)
      }
    });
    await prisma.signInEvent.create({
      data: {
        userId: user.id,
        method: "email_password"
      }
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: REFRESH_MAX_AGE_MS
    });

    sendPage(res, "Login Success", `
      <h1>Login Success</h1>
      <p class="ok">Signed in as ${escapeHtml(user.name)}.</p>
      <section>
        <h2>User</h2>
        <pre>${escapeHtml(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }, null, 2))}</pre>
        <h2>Access token</h2>
        <pre>${escapeHtml(accessToken)}</pre>
      </section>
      <p><a href="/api/dev/signins">Show sign-in activity</a></p>
    `);
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });

    const userRows = users.map((user) => `
      <tr>
        <td>${escapeHtml(user.id)}</td>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${escapeHtml(user.createdAt.toISOString())}</td>
      </tr>
    `).join("");

    sendPage(res, "Users", `
      <h1>Users</h1>
      <p>All users in the platform. Use Sign-ins to see who logged in and by which method.</p>
      <div class="grid">
        <section>
          <h2>Users</h2>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>${userRows || "<tr><td colspan=\"5\">No users found.</td></tr>"}</tbody>
          </table>
        </section>
      </div>
    `);
  } catch (error) {
    next(error);
  }
});

router.get("/db", (_req, res) => {
  res.redirect("/api/dev/signins");
});

export default router;
