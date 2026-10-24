import assert from "node:assert/strict";
import { createInterviewPdfRenderer } from "../dist/src/modules/enterprise/interview-report-pdf.js";

// Exercise the real browser and report renderer without a database or credentials.
// Run after compilation, in the same image/environment that serves downloads.
const student = {
  name: "PDF Runtime Check", email: "pdf@example.test", enrollmentNumber: "TEST-001",
  program: "Test program", course: "Test course", section: "A", batch: "2026",
};
const report = {
  id: "pdf-runtime-check", createdAt: new Date("2026-01-01T00:00:00Z"),
  overallScore: 67, scoreScale: 100, categoryScores: { communication: 70 },
  speakingPace: null, fillerWords: 0, voiceConfidence: null,
  strengths: ["Clear explanation"], weaknesses: ["Add examples"],
  recommendations: ["Practice explaining tradeoffs"],
  session: {
    id: "pdf-runtime-session", targetRole: "Product Manager", difficulty: "Intermediate",
    durationMins: 20, questions: [{
      questionText: "How do you prioritize features?",
      answer: { answerText: "Compare user impact and effort.", score: 7, scoreScale: 10,
        durationSecs: 30, feedback: { reasoning: "Include a concrete example." } },
    }],
  },
};

let renderer;
try {
  renderer = await createInterviewPdfRenderer();
  // Exports reuse a browser for multiple reports; verify a second page also works.
  for (const number of [1, 2]) {
    const bytes = await renderer.render(student, report, number);
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", "Expected an actual PDF");
    assert(bytes.length > 1_000, "Expected a nonempty report");
  }
  console.log("PASS PDF runtime: Chromium launched and rendered two interview reports.");
} finally {
  await renderer?.close();
}
