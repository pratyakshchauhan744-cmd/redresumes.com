import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { creditPayloadHash, requireCreditIdempotencyKey, CreditIdempotencyError } from "../modules/enterprise/credit-idempotency.js";
const key = randomUUID();
assert.equal(requireCreditIdempotencyKey(key.toUpperCase()), key);
for (const invalid of [undefined, "", "abc", [key], `${key},${key}`, `${key} `, "a".repeat(1000)]) {
  assert.throws(() => requireCreditIdempotencyKey(invalid), e => e instanceof CreditIdempotencyError && e.statusCode === 400);
}
assert.equal(creditPayloadHash({ reason: "test", filters: { batch: "2026", program: "CS" }, amount: 1 }), creditPayloadHash({ amount: 1, filters: { program: "CS", batch: "2026", ignored: undefined }, reason: "test" }));
assert.notEqual(creditPayloadHash({ amount: 1 }), creditPayloadHash({ amount: 2 }));
assert.notEqual(creditPayloadHash({ studentIds: ["a"] }), creditPayloadHash({ studentIds: ["b"] }));
console.log("PASS UUID validation, canonical request hashing and accounting payload changes");
