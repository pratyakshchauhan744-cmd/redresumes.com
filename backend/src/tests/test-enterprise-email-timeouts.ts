import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// All providers are mocked; no email is sent and no configured secret is used.
const originalEnv = { ...env };
Object.assign(env, {
  EMAIL_FROM: "sender@gmail.com", RESEND_FROM: "Campus <campus@example.test>",
  RESEND_API_KEY: "test-only", SMTP_USER: "test-only", SMTP_PASS: "test-only",
  SMTP_HOST: "smtp.gmail.com", SMTP_PORT: 465, SMTP_SECURE: true,
});
const originalFetch = globalThis.fetch;
const originalTransport = nodemailer.createTransport;
let smtpCalls = 0;
let smtpError: Error | undefined;
const configurations: any[] = [];
nodemailer.createTransport = ((options: unknown) => {
  configurations.push(options);
  return { sendMail: async () => {
    smtpCalls++;
    if (smtpError) throw smtpError;
    return { messageId: "mock-smtp-id" };
  } };
}) as unknown as typeof nodemailer.createTransport;
const { EmailService } = await import("../services/email.service.js");
const send = () => EmailService.sendFacultyInvitation({
  to: "recipient@example.test", recipientName: "Faculty", collegeName: "Test College",
  isMainFaculty: false, activationLink: "https://example.test/activate",
});
try {
  assert.equal(configurations.length, 1, "Do not try Gmail twice as primary and generic SMTP");
  for (const key of ["connectionTimeout", "greetingTimeout", "socketTimeout", "dnsTimeout"]) {
    assert.equal(configurations[0][key], 3000);
  }
  globalThis.fetch = (async (_url, options) => {
    assert.equal(JSON.parse(options!.body as string).from, "Campus <campus@example.test>");
    assert(options?.signal, "HTTPS delivery must have a cancellable deadline");
    return new Response(JSON.stringify({ id: "mock-https-id" }), { status: 200 });
  }) as typeof fetch;
  assert.equal((await send()).messageId, "mock-https-id");
  assert.equal(smtpCalls, 0);
  console.log("PASS configured HTTPS provider is first and SMTP stages have short deadlines");

  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Provider rejected request" }), { status: 503 });
  assert.equal((await send()).messageId, "mock-smtp-id");
  assert.equal(smtpCalls, 1);
  smtpError = new Error("Provider unavailable");
  const failure = await send();
  assert.equal(failure.success, false);
  assert.equal(failure.simulated, undefined);
  console.log("PASS explicit HTTPS rejection can fall back; failed providers never report simulated success");

  // Resend rejection is logged (status + sanitized message) and survives an SMTP failure.
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      message: "The recipient@example.test domain is not verified. Bearer re_abcdef123456",
    }), { status: 403 });
    for (const smtpFailure of [new Error("SMTP unavailable"), Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })]) {
      smtpError = smtpFailure;
      logged.length = 0;
      const rejected = await send();
      assert.equal(rejected.success, false);
      assert.match(rejected.error!, /Resend rejected request \(HTTP 403\): The \[redacted-email\] domain is not verified/);
      const output = logged.join("\n");
      assert.match(output, /HTTP 403/);
      assert.match(output, /SMTP fallback failed/);
      for (const secret of ["recipient@example.test", "re_abcdef123456", "test-only"]) {
        assert(!output.includes(secret) && !rejected.error!.includes(secret), `must not expose ${secret}`);
      }
    }
  } finally { console.error = originalError; smtpError = undefined; }
  console.log("PASS Resend rejection is logged sanitized and preserved when SMTP fallback fails");

  const callsBeforeTimeout = smtpCalls;
  let aborted = false;
  globalThis.fetch = ((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener("abort", () => {
      aborted = true; reject(options!.signal!.reason);
    }, { once: true });
  })) as typeof fetch;
  // AbortSignal.timeout uses an unref'ed timer; keep this mocked request alive.
  const keepAlive = setInterval(() => {}, 1000);
  const started = performance.now();
  try {
    const timeout = await send();
    assert.equal(timeout.success, false);
    assert.match(timeout.error!, /timed out/);
    assert(aborted);
    assert(performance.now() - started < 4500);
    assert.equal(smtpCalls, callsBeforeTimeout, "Ambiguous timeout must not send a duplicate through fallback");
  } finally { clearInterval(keepAlive); }
  console.log("PASS stalled HTTPS send is cancelled in three seconds without a duplicate fallback");
} finally {
  globalThis.fetch = originalFetch;
  nodemailer.createTransport = originalTransport;
  Object.assign(env, originalEnv);
}
