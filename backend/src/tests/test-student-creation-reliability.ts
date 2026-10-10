import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { EmailService } from "../services/email.service.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
let sentEmails: Array<{ to: string; recipientName: string }> = [];

const originalSendWelcome = EmailService.sendStudentWelcomeEmail;
let emailMode: "success" | "failure" | "throw" = "success";
let forcedStatusUpdateError = false;

EmailService.sendStudentWelcomeEmail = async (params) => {
  sentEmails.push({ to: params.to, recipientName: params.recipientName });
  if (emailMode === "throw") {
    throw new Error("SMTP connection timed out to mail provider");
  }
  if (emailMode === "failure") {
    return { success: false, error: "Recipient mailbox is full or rejected" };
  }
  return { success: true, messageId: "msg-test-123" };
};

const originalUpdateMany = prisma.invitation.updateMany.bind(prisma.invitation);
(prisma.invitation as any).updateMany = async (...args: any[]) => {
  if (forcedStatusUpdateError) {
    throw new Error("Simulated database connection drop during invitation updateMany");
  }
  return (originalUpdateMany as any)(...args);
};

const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(
  method: string,
  path: string,
  token?: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createFixtureCollege(label: string, initialBalance = 100) {
  const college = await prisma.college.create({
    data: {
      name: `Reliability Test ${label} ${suffix}`,
      code: `REL-${label}-${suffix}`,
      officialEmail: `rel.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);

  await prisma.collegeCreditAccount.create({
    data: {
      collegeId: college.id,
      totalAllocated: initialBalance,
      totalDistributed: 0,
      balance: initialBalance,
    },
  });

  return college;
}

async function createFaculty(
  collegeId: string,
  label: string,
  permissions: string[]
) {
  const user = await prisma.user.create({
    data: {
      name: `Faculty ${label}`,
      email: `faculty.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("FacultyPassword123!", 4),
      role: "college_faculty",
      collegeId,
      isActive: true,
      facultyProfile: {
        create: {
          collegeId,
          permissions,
          programAccess: ["B.Tech"],
          courseAccess: ["Computer Science"],
          sectionAccess: ["A"],
          batchAccess: ["2026"],
          scopeUnrestricted: false,
          cohortAccess: [
            {
              program: "B.Tech",
              course: "Computer Science",
              section: "A",
              batch: "2026",
            },
          ],
          status: "active",
        },
      },
    },
  });

  return {
    user,
    token: signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      collegeId,
      permissions,
    }),
  };
}

try {
  console.log("Starting Student Creation Reliability & Idempotency Test Suite...");

  const college = await createFixtureCollege("Main", 200);
  const authorizedFaculty = await createFaculty(college.id, "Authorized", [
    "STUDENT_CREATE",
    "INTERVIEW_CREDIT_ASSIGN",
  ]);
  const unauthorizedFaculty = await createFaculty(college.id, "Unauthorized", [
    "INTERVIEW_CREDIT_ASSIGN",
  ]);

  // =========================================================================
  // Test 1: Full Success Path (Committed + Email Accepted + Status Saved)
  // =========================================================================
  {
    emailMode = "success";
    forcedStatusUpdateError = false;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Alice Smith",
      email: `alice.${suffix}@example.com`,
      enrollmentNumber: `ENR-ALICE-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 5,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );

    assert.equal(res.status, 201, "Expected HTTP 201 on success");
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.invitationStatus, "sent");
    assert.equal(body.invitationPersistenceFailed, false);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, payload.email);

    // Verify DB committed student and credits
    const student = await prisma.collegeStudent.findUnique({
      where: {
        collegeId_enrollmentNumber: {
          collegeId: college.id,
          enrollmentNumber: payload.enrollmentNumber,
        },
      },
    });
    assert(student, "Student profile must be committed to database");
    const userCredit = await prisma.userCredit.findUnique({
      where: { userId: student.userId },
    });
    assert.equal(userCredit?.balance, 5, "Initial credits must be 5");

    // Verify college balance was deducted from 200 to 195
    const collegeAccount = await prisma.collegeCreditAccount.findUnique({
      where: { collegeId: college.id },
    });
    assert.equal(collegeAccount?.balance, 195, "Institution balance must be deducted");

    console.log("PASS 1: Full success path commits student, allocates credits, sends email (HTTP 201)");
  }

  // =========================================================================
  // Test 2: Email Delivery Fails After Account Commit
  // =========================================================================
  {
    emailMode = "failure";
    forcedStatusUpdateError = false;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Bob Jones",
      email: `bob.${suffix}@example.com`,
      enrollmentNumber: `ENR-BOB-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 3,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );

    assert.equal(res.status, 201, "Expected HTTP 201 even when email delivery fails post-commit");
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.invitationStatus, "failed");
    assert.equal(body.invitationPersistenceFailed, false);
    assert(body.emailError, "Expected safe email error message");

    // Verify DB committed student
    const student = await prisma.collegeStudent.findUnique({
      where: {
        collegeId_enrollmentNumber: {
          collegeId: college.id,
          enrollmentNumber: payload.enrollmentNumber,
        },
      },
    });
    assert(student, "Student profile must exist despite email failure");
    const userCredit = await prisma.userCredit.findUnique({
      where: { userId: student.userId },
    });
    assert.equal(userCredit?.balance, 3);

    console.log("PASS 2: Email delivery failure after commit still returns HTTP 201 with invitation failed notice");
  }

  // =========================================================================
  // Test 3: Status Persistence Fails After Account Commit
  // =========================================================================
  {
    emailMode = "success";
    forcedStatusUpdateError = true;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Charlie Brown",
      email: `charlie.${suffix}@example.com`,
      enrollmentNumber: `ENR-CHARLIE-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 2,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );

    assert.equal(res.status, 201, "Expected HTTP 201 even when status persistence fails post-commit");
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.invitationStatus, "persistence_failed");
    assert.equal(body.invitationPersistenceFailed, true);
    assert(body.invitationPersistenceWarning, "Expected persistence warning");

    // Verify student account is preserved in database!
    const student = await prisma.collegeStudent.findUnique({
      where: {
        collegeId_enrollmentNumber: {
          collegeId: college.id,
          enrollmentNumber: payload.enrollmentNumber,
        },
      },
    });
    assert(student, "Student must be committed even if post-commit status persistence threw an error");

    console.log("PASS 3: Post-commit status update failure is isolated, preserves student, and returns HTTP 201 warning");
  }

  // =========================================================================
  // Test 4: Both Email Delivery and Status Persistence Fail After Commit
  // =========================================================================
  {
    emailMode = "throw";
    forcedStatusUpdateError = true;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Diana Prince",
      email: `diana.${suffix}@example.com`,
      enrollmentNumber: `ENR-DIANA-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 1,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );

    assert.equal(res.status, 201, "Expected HTTP 201 even when both email and status fail post-commit");
    const body = await res.json() as any;
    assert.equal(body.success, true);
    assert.equal(body.invitationStatus, "persistence_failed");
    assert.equal(body.invitationPersistenceFailed, true);
    assert(body.emailError);

    const student = await prisma.collegeStudent.findUnique({
      where: {
        collegeId_enrollmentNumber: {
          collegeId: college.id,
          enrollmentNumber: payload.enrollmentNumber,
        },
      },
    });
    assert(student, "Student must be committed");

    console.log("PASS 4: Both email and status update failures return HTTP 201 with partial onboarding details");
  }

  // =========================================================================
  // Test 5: Idempotent Replay (Same Key, Same Payload)
  // =========================================================================
  {
    emailMode = "success";
    forcedStatusUpdateError = false;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Evan Wright",
      email: `evan.${suffix}@example.com`,
      enrollmentNumber: `ENR-EVAN-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 4,
    };

    // First request
    const res1 = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );
    assert.equal(res1.status, 201);
    const body1 = await res1.json() as any;
    assert.equal(sentEmails.length, 1);

    const institutionBalanceAfterFirst = (await prisma.collegeCreditAccount.findUnique({
      where: { collegeId: college.id },
    }))?.balance;

    // Second request (replayed identical request)
    const res2 = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload,
      { "Idempotency-Key": key }
    );
    assert.equal(res2.status, 201, "Replay must return 201 receipt");
    const body2 = await res2.json() as any;
    assert.equal(body2.student.id, body1.student.id, "Replay must return the same student ID");

    // Critical invariants:
    assert.equal(sentEmails.length, 1, "Must NOT send duplicate welcome email on replay");

    const institutionBalanceAfterSecond = (await prisma.collegeCreditAccount.findUnique({
      where: { collegeId: college.id },
    }))?.balance;
    assert.equal(
      institutionBalanceAfterSecond,
      institutionBalanceAfterFirst,
      "Must NOT deduct institution credits a second time on replay"
    );

    const studentAccounts = await prisma.collegeStudent.findMany({
      where: {
        collegeId: college.id,
        enrollmentNumber: payload.enrollmentNumber,
      },
    });
    assert.equal(studentAccounts.length, 1, "Must NOT create duplicate student accounts");

    console.log("PASS 5: Idempotent replay returns cached receipt without duplicate student, credits, or emails");
  }

  // =========================================================================
  // Test 6: Replay with Same Key but Materially Different Payload -> HTTP 409
  // =========================================================================
  {
    const key = crypto.randomUUID();
    const payload1 = {
      name: "Fiona Apple",
      email: `fiona.${suffix}@example.com`,
      enrollmentNumber: `ENR-FIONA-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 2,
    };

    const res1 = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload1,
      { "Idempotency-Key": key }
    );
    assert.equal(res1.status, 201);

    // Attempt reuse with different student details
    const payload2 = {
      ...payload1,
      name: "Different Name",
      enrollmentNumber: `ENR-FIONA-DIFF-${suffix}`,
    };

    const res2 = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload2,
      { "Idempotency-Key": key }
    );
    assert.equal(res2.status, 409, "Expected 409 Conflict when key reused with different payload");
    const body2 = await res2.json() as any;
    assert.equal(body2.success, false);

    console.log("PASS 6: Reusing same idempotency key with different payload returns HTTP 409");
  }

  // =========================================================================
  // Test 7: Pre-Commit Conflict Check (Enrollment Number Exists) -> HTTP 400
  // =========================================================================
  {
    // Try to create another student with Alice's enrollment number without the same key
    const payload = {
      name: "Alice Clone",
      email: `alice.clone.${suffix}@example.com`,
      enrollmentNumber: `ENR-ALICE-${suffix}`, // Already created in Test 1
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 0,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload
    );
    assert.equal(res.status, 400, "Expected HTTP 400 for duplicate enrollment number");
    const body = await res.json() as any;
    assert.equal(body.success, false);
    assert(body.message.includes("already exists"));

    console.log("PASS 7: Pre-commit collision for duplicate enrollment number returns HTTP 400");
  }

  // =========================================================================
  // Test 8: Pre-Commit Conflict Check (Email Exists) -> HTTP 409
  // =========================================================================
  {
    // Try to create another student with Alice's email
    const payload = {
      name: "Alice Another",
      email: `alice.${suffix}@example.com`, // Already created in Test 1
      enrollmentNumber: `ENR-NEW-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 0,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      authorizedFaculty.token,
      payload
    );
    assert.equal(res.status, 409, "Expected HTTP 409 for duplicate email");
    const body = await res.json() as any;
    assert.equal(body.success, false);

    console.log("PASS 8: Pre-commit collision for duplicate email returns HTTP 409");
  }

  // =========================================================================
  // Test 9: Unauthorized Faculty Creation -> HTTP 403
  // =========================================================================
  {
    const payload = {
      name: "George Costanza",
      email: `george.${suffix}@example.com`,
      enrollmentNumber: `ENR-GEORGE-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 0,
    };

    const res = await request(
      "POST",
      "/api/enterprise/students",
      unauthorizedFaculty.token,
      payload
    );
    assert.equal(res.status, 403, "Expected HTTP 403 when faculty lacks STUDENT_CREATE");

    console.log("PASS 9: Unauthorized faculty creation rejected with HTTP 403");
  }

  // =========================================================================
  // Test 10: Concurrent Requests With Same Key
  // =========================================================================
  {
    emailMode = "success";
    forcedStatusUpdateError = false;
    sentEmails = [];

    const key = crypto.randomUUID();
    const payload = {
      name: "Helen Troy",
      email: `helen.${suffix}@example.com`,
      enrollmentNumber: `ENR-HELEN-${suffix}`,
      program: "B.Tech",
      course: "Computer Science",
      section: "A",
      batch: "2026",
      initialCredits: 5,
    };

    // Execute concurrently
    const [resA, resB] = await Promise.all([
      request("POST", "/api/enterprise/students", authorizedFaculty.token, payload, {
        "Idempotency-Key": key,
      }),
      request("POST", "/api/enterprise/students", authorizedFaculty.token, payload, {
        "Idempotency-Key": key,
      }),
    ]);

    // Either both return 201 (one created, one replayed) or one returns 201 and one returns 503 retry
    assert(
      [201, 503].includes(resA.status),
      `Expected 201 or 503, got ${resA.status}`
    );
    assert(
      [201, 503].includes(resB.status),
      `Expected 201 or 503, got ${resB.status}`
    );
    assert(
      resA.status === 201 || resB.status === 201,
      "At least one request must succeed with 201"
    );

    // In all cases, exactly 1 student account must exist in the database!
    const students = await prisma.collegeStudent.findMany({
      where: {
        collegeId: college.id,
        enrollmentNumber: payload.enrollmentNumber,
      },
    });
    assert.equal(students.length, 1, "Concurrent requests with same key must create exactly one student");

    console.log("PASS 10: Concurrent requests with same key safely serialize without duplicate accounts");
  }

  console.log("\nALL 10 STUDENT CREATION RELIABILITY TESTS PASSED SUCCESSFULLY!");
} finally {
  EmailService.sendStudentWelcomeEmail = originalSendWelcome;
  (prisma.invitation as any).updateMany = originalUpdateMany;
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({
      where: { collegeId },
      select: { id: true },
    });
    await prisma.creditIdempotencyRecord
      .deleteMany({ where: { collegeId } })
      .catch(() => undefined);
    await prisma.college
      .delete({ where: { id: collegeId } })
      .catch(() => undefined);
    if (users.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: users.map((u) => u.id) } } })
        .catch(() => undefined);
    }
  }
  await prisma.$disconnect();
}
