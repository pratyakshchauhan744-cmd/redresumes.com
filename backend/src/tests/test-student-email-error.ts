import assert from "node:assert/strict";
import { publicStudentEmailError } from "../utils/student-email-error.js";
assert.equal(publicStudentEmailError(undefined), null);
assert.equal(publicStudentEmailError({ password: "secret" }), null);
for (const value of ["SMTP_PASS=secret at mail.ts:12", "quota API_KEY=secret", "recipient rejected https://private.provider", "timeout Bearer secret"]) {
  const message = publicStudentEmailError(value);
  assert(message); assert.doesNotMatch(message, /secret|SMTP|API_KEY|Bearer|mail.ts|private.provider/);
}
assert.match(publicStudentEmailError("quota")!, /temporarily limited/);
assert.match(publicStudentEmailError("recipient rejected")!, /Verify/);
assert.match(publicStudentEmailError("timeout")!, /temporarily unavailable/);
console.log("PASS public invitation error redaction and safe actionable categories");
