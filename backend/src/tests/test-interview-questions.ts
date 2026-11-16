import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { generateInterviewFollowUp, generateInterviewQuestion, InterviewAIUnavailableError } from "../modules/ai/service.js";
import { answerInterviewQuestion, createInterviewSession } from "../modules/interview/service.js";
import { answerQuestion, startInterview } from "../modules/interview/controller.js";

const originalKeys = { OPENAI_API_KEY: env.OPENAI_API_KEY, GEMINI_API_KEY: env.GEMINI_API_KEY };
const resumeData = { experiences: [{ title: "Sales Representative", company: "V-Mart / Tanishq" }] };
const salesAnswer = "I worked for V-Mart as a sales representative and then sold jewellery at Tanishq.";
const correction = "I haven't worked on software projects. I was a sales representative, not an IT professional.";
const nextQuestion = "Thinking about your jewellery sales experience, how did you handle a customer's price objection?";
const evaluation = {
  clarity: 7, confidence: 7, relevance: 7, technicalAccuracy: 7,
  communicationQuality: 7, problemSolving: 7, completeness: 7, domainKnowledge: 7,
  reasoning: "Relevant sales experience.", feedback: "Add an outcome.", improvedAnswerExample: "Example sales answer."
};

let requests: Array<{ url: string; prompt: string }>;
let failure: "http" | "network" | "empty" | "malformed" | undefined;
let dialogue: string;
const restorePrisma: Array<() => void> = [];

beforeEach(() => {
  requests = [];
  failure = undefined;
  dialogue = nextQuestion;
  // No real provider or database is used, regardless of local configuration.
  env.OPENAI_API_KEY = "test-only";
  env.GEMINI_API_KEY = undefined;
  mock.method(console, "warn", () => {});
  mock.method(globalThis, "fetch", async (input: string | URL | globalThis.Request, options?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(options!.body as string);
    const isOpenAI = url.startsWith("https://api.openai.com/");
    const prompt = isOpenAI ? body.messages[0].content : body.contents[0].parts[0].text;
    requests.push({ url, prompt });
    const isEvaluation = body.response_format?.type === "json_object" || body.generationConfig?.responseMimeType === "application/json";
    if (!isEvaluation) {
      if (failure === "network") throw new Error("Provider offline");
      if (failure === "http") return new globalThis.Response("Unavailable", { status: 503 });
      if (failure === "malformed") return new globalThis.Response("invalid JSON");
    }
    const text = isEvaluation ? JSON.stringify(evaluation) : failure === "empty" ? "" : dialogue;
    return new globalThis.Response(JSON.stringify(isOpenAI
      ? { choices: [{ message: { content: text } }] }
      : { candidates: [{ content: { parts: [{ text }] } }] }));
  });
});

afterEach(() => {
  while (restorePrisma.length) restorePrisma.pop()!();
  mock.restoreAll();
  Object.assign(env, originalKeys);
});

// Prisma delegates use proxy getters rather than ordinary method descriptors.
function stubPrismaMethod(delegate: any, method: string, implementation: (...args: any[]) => any) {
  const original = delegate[method];
  const stub = mock.fn(implementation);
  delegate[method] = stub;
  restorePrisma.push(() => { delegate[method] = original; });
  return stub;
}

function assertRoleContext(prompt: string, targetRole = "Sales Representative") {
  const context = prompt.match(/^Interview context: (.+)$/m);
  assert(context, "Every AI question request must retain the interview settings");
  assert.deepEqual(JSON.parse(context[1]), {
    targetRole, companyType: "Google", difficulty: "Medium", style: "Technical"
  });
  assert.match(prompt, /"Technical" means practical skills/);
  assert.doesNotMatch(prompt, /You focus on algorithms|Focus on: Technical depth/);
}

function mockSession() {
  return {
    id: "session-1", userId: "user-1", targetRole: "Sales Representative", companyType: "Google",
    difficulty: "Medium", interviewStyle: "Technical", interviewerPersona: "Technical Interviewer",
    stressMode: false, durationMins: 15, jobDescription: "Retail sales, product knowledge and closing sales.",
    resume: { parsedData: resumeData },
    // Deliberately unsorted, including an unanswered question that is not part of the conversation.
    questions: [
      { id: "current", orderIndex: 2, questionText: "Explain the architecture of your project.", questionType: "followup", answer: null },
      { id: "unused", orderIndex: 3, questionText: "Unused question", questionType: "followup", answer: null },
      { id: "first", orderIndex: 1, questionText: "Tell me about your experience.", questionType: "base", answer: { answerText: salesAnswer } }
    ]
  };
}

function mockAnswerPersistence() {
  const savedAnswers: any[] = [];
  const savedQuestions: any[] = [];
  stubPrismaMethod(prisma.interviewSession, "findUnique", async () => mockSession());
  stubPrismaMethod(prisma.interviewAnswer, "create", async ({ data }: any) => {
    savedAnswers.push(data);
    return { id: "answer-1", ...data };
  });
  stubPrismaMethod(prisma.interviewQuestion, "create", async ({ data }: any) => {
    savedQuestions.push(data);
    return { id: "next", ...data };
  });
  return { savedAnswers, savedQuestions };
}

function mockHttpResponse() {
  let status: number | undefined;
  let body: any;
  const response = {
    status(value: number) { status = value; return response; },
    json(value: unknown) { body = value; return response; }
  };
  return { response: response as unknown as Response, status: () => status, body: () => body };
}

const unexpectedNext: NextFunction = (error?: any) => { throw error || new Error("Unexpected next() call"); };

await test("technical openings stay within the selected profession, including at a technology company", async () => {
  const result = await generateInterviewQuestion(resumeData, "Sales Representative", "Google", "Medium", "Technical", "Retail sales", "Technical Interviewer");
  assert.equal(result, nextQuestion);
  assert.equal(requests.length, 1);
  assertRoleContext(requests[0].prompt);
  assert.match(requests[0].prompt, /objection handling/);
  assert.match(requests[0].prompt, /Retail sales/);
  assert.match(requests[0].prompt, /V-Mart \/ Tanishq/);
});

for (const identity of [
  { label: "institution student", userId: "student-1", collegeId: "college-1" },
  { label: "individual candidate", userId: "candidate-1", collegeId: null },
  { label: "anonymous candidate", userId: null, collegeId: null },
]) {
  await test(`new interviews retain the ${identity.label}'s institution association`, async () => {
    stubPrismaMethod(prisma.resume, "findUnique", async () => ({ parsedData: resumeData }));
    const tx = {
      userCredit: { findUnique: mock.fn(async () => ({ balance: 1 })) },
      user: { findUnique: mock.fn(async (_args: any) => ({ collegeId: identity.collegeId })) },
      interviewSession: { create: mock.fn(async ({ data }: any) => ({ id: "new-session", ...data })) },
    };
    stubPrismaMethod(prisma, "$transaction", async (work: any) => work(tx));
    stubPrismaMethod(prisma.interviewQuestion, "create", async ({ data }: any) => ({ id: "first", ...data }));

    const result = await createInterviewSession(identity.userId, "resume-1", "Sales Representative", "Google", "Medium", "Technical", 15);
    assert.equal(result.session.userId, identity.userId);
    assert.equal(result.session.collegeId, identity.collegeId);
    assert.equal(tx.user.findUnique.mock.callCount(), identity.userId ? 1 : 0);
    if (identity.userId) assert.deepEqual(tx.user.findUnique.mock.calls[0].arguments[0], {
      where: { id: identity.userId }, select: { collegeId: true },
    });
  });
}

for (const provider of ["OpenAI", "Gemini"]) {
  await test(`${provider} receives the latest sales answer and full history before a follow-up is saved`, async () => {
    if (provider === "Gemini") {
      env.OPENAI_API_KEY = undefined;
      env.GEMINI_API_KEY = "test-only";
    }
    const { savedAnswers, savedQuestions } = mockAnswerPersistence();
    const result = await answerInterviewQuestion("session-1", "current", correction, 120, 0, 90, 19);
    const prompt = requests.at(-1)!.prompt;
    assertRoleContext(prompt);
    assert.match(prompt, /acknowledge that correction/);
    assert(prompt.includes(`They answered: "${correction}"`));
    assert(prompt.includes(JSON.stringify([
      { questionText: "Tell me about your experience.", answerText: salesAnswer, questionType: "base" },
      { questionText: "Explain the architecture of your project.", answerText: correction, questionType: "followup" }
    ])));
    assert(!prompt.includes("Unused question"));
    assert(prompt.includes("Retail sales, product knowledge and closing sales."));
    assert.equal(result.isComplete, false);
    assert.equal(result.nextQuestion?.questionText, nextQuestion);
    assert.equal(savedAnswers.length, 1);
    assert.equal(savedAnswers[0].answerText, correction);
    assert.equal(savedAnswers[0].durationSecs, 19);
    assert.equal(savedQuestions.length, 1);
    assert.equal(savedQuestions[0].orderIndex, 3);
  });
}

await test("software engineering interviews retain their selected role and relevant technical questions", async () => {
  dialogue = "How did you identify and resolve the database bottleneck you mentioned?";
  const history = [{ questionText: "Describe a performance issue.", answerText: "I optimized a slow database query." }];
  const result = await generateInterviewFollowUp(history, {}, "Backend Engineer", "Google", "Medium", "Technical", undefined, "Technical Interviewer");
  assert.equal(result, dialogue);
  assertRoleContext(requests[0].prompt, "Backend Engineer");
  assert(requests[0].prompt.includes(history[0].answerText));
});

await test("missing AI configuration cannot start a canned interview or persist an unusable session", async () => {
  env.OPENAI_API_KEY = undefined;
  env.GEMINI_API_KEY = undefined;
  stubPrismaMethod(prisma.resume, "findUnique", async () => ({ parsedData: resumeData }));
  const transaction = stubPrismaMethod(prisma, "$transaction", async () => { throw new Error("Must not create a session"); });
  const http = mockHttpResponse();
  await startInterview({ body: {
    resumeId: "resume-1", targetRole: "Sales Representative", companyType: "Google", difficulty: "Medium",
    style: "Technical", durationMins: 15, interviewerPersona: "Technical Interviewer"
  } } as Request, http.response, unexpectedNext);
  assert.equal(http.status(), 503);
  assert.match(http.body().message, /AI interviewer is not configured/);
  assert.equal(transaction.mock.callCount(), 0);
  await assert.rejects(generateInterviewFollowUp(
    [{ questionText: "Tell me about your experience.", answerText: salesAnswer }],
    resumeData, "Sales Representative", "Google", "Medium", "Technical", undefined, "Technical Interviewer"
  ), InterviewAIUnavailableError);
  assert.equal(requests.length, 0);
});

await test("the final answer is saved and completes the report without generating an extra question", async () => {
  env.OPENAI_API_KEY = undefined;
  env.GEMINI_API_KEY = undefined;
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: `q-${index}`, orderIndex: index + 1, questionText: `Sales scenario ${index + 1}?`, questionType: "followup",
    answer: index < 4 ? { answerText: salesAnswer, feedback: evaluation } : null
  }));
  const session = { ...mockSession(), userId: null, creditUsed: true, questions };
  stubPrismaMethod(prisma.interviewSession, "findUnique", async () => session);
  const saveAnswer = stubPrismaMethod(prisma.interviewAnswer, "create", async ({ data }: any) => {
    questions[4].answer = { answerText: data.answerText, feedback: data.feedback };
    return data;
  });
  const saveQuestion = stubPrismaMethod(prisma.interviewQuestion, "create", async () => {
    throw new Error("Must not generate a sixth question");
  });
  stubPrismaMethod(prisma.interviewReport, "deleteMany", async () => ({ count: 0 }));
  const saveReport = stubPrismaMethod(prisma.interviewReport, "create", async ({ data }: any) => data);
  const complete = stubPrismaMethod(prisma.interviewSession, "update", async ({ data }: any) => data);

  const result = await answerInterviewQuestion("session-1", "q-4", salesAnswer, 120, 0, 90, 30);
  assert.deepEqual(result, { isComplete: true, reportId: "session-1" });
  assert.equal(saveAnswer.mock.callCount(), 1);
  assert.equal(saveQuestion.mock.callCount(), 0);
  assert.equal(saveReport.mock.callCount(), 1);
  assert.equal(complete.mock.calls[0].arguments[0].data.status, "completed");
  assert.equal(requests.length, 0);
});

for (const problem of ["http", "network", "empty", "malformed"] as const) {
  await test(`${problem} AI failure leaves the answer retryable and exposes a safe availability error`, async () => {
    failure = problem;
    const { savedAnswers, savedQuestions } = mockAnswerPersistence();
    const http = mockHttpResponse();
    await answerQuestion({ user: { id: "user-1" }, body: {
      sessionId: "session-1", questionId: "current", answerText: correction
    } } as Request, http.response, unexpectedNext);
    assert.equal(http.status(), 503);
    assert.match(http.body().message, /AI interviewer is temporarily unavailable/);
    assert.equal(savedAnswers.length, 0);
    assert.equal(savedQuestions.length, 0);

    failure = undefined;
    const result = await answerInterviewQuestion("session-1", "current", correction);
    assert.equal(result.nextQuestion?.questionText, nextQuestion);
    assert.equal(savedAnswers.length, 1);
    assert.equal(savedQuestions.length, 1);
  });
}
