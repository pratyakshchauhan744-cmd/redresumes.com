import assert from "node:assert/strict";
import { access } from "node:fs/promises";

// Inspect the compiled router that production actually imports. No database,
// authentication credentials, or listening server are needed for this check.
await access(new URL("../dist/src/main.js", import.meta.url));
const { default: enterpriseRoutes } = await import("../dist/src/modules/enterprise/routes.js");
const { default: interviewRoutes } = await import("../dist/src/modules/enterprise/student-interview-routes.js");

assert(
  enterpriseRoutes.stack.some(layer => layer.handle === interviewRoutes),
  "The production enterprise router must mount student interview routes.",
);

for (const [method, path] of [
  ["get", "/students/:studentId/interviews"],
  ["get", "/students/:studentId/interviews/:sessionId/report"],
  ["get", "/students/:studentId/interviews/:sessionId/report/pdf"],
  ["post", "/students/:studentId/reports/export"],
]) {
  assert(
    interviewRoutes.stack.some(layer => layer.route?.path === path && layer.route.methods[method]),
    `Missing production route: ${method.toUpperCase()} /api/enterprise${path}`,
  );
}

console.log("PASS compiled student interview history, report, PDF, and ZIP routes are mounted.");
