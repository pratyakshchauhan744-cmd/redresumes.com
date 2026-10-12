import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import enterpriseRoutes from "../modules/enterprise/routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import { signAccessToken } from "../utils/jwt.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];
const app = express();
app.use(express.json());
app.use("/api/enterprise", enterpriseRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/enterprise`;

async function createCollege(label: string) {
  const college = await prisma.college.create({
    data: {
      name: `E16 ${label} ${suffix}`,
      code: `E16-${label}-${suffix}`,
      officialEmail: `e16.${label}.${suffix}@example.com`,
      status: "active",
      creditAccount: { create: { totalAllocated: 500, totalDistributed: 100, balance: 400 } },
    },
  });
  collegeIds.push(college.id);
  return college;
}

async function createFaculty(
  collegeId: string,
  label: string,
  permissions: string[],
  scope: { programs?: string[]; courses?: string[]; sections?: string[] } = {},
  main = false
) {
  const role = main ? "college_main_faculty" : "college_faculty";
  const user = await prisma.user.create({
    data: {
      name: `E16 ${label}`,
      email: `e16.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E16-Test-Password!", 4),
      role,
      collegeId,
      isActive: true,
      facultyProfile: {
        create: {
          collegeId,
          isMainFaculty: main,
          permissions,
          programAccess: scope.programs ?? [],
          courseAccess: scope.courses ?? [],
          sectionAccess: scope.sections ?? [],
          scopeUnrestricted: main || Object.keys(scope).length === 0,
          cohortAccess: main || Object.keys(scope).length === 0
            ? []
            : [{
                program: "B.Tech",
                course: scope.courses?.[0] ?? "CSE",
                section: scope.sections?.[0] ?? "A",
                batch: "2026",
              }],
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
      role,
      collegeId,
      permissions,
    }),
  };
}

async function createStudent(
  collegeId: string,
  label: string,
  course: string,
  section: string,
  batch = "2026"
) {
  const user = await prisma.user.create({
    data: {
      name: `E16 ${label}`,
      email: `e16.student.${label}.${suffix}@example.com`,
      passwordHash: await bcrypt.hash("E16-Student-Password!", 4),
      role: "student",
      collegeId,
      isActive: true,
    },
  });
  const student = await prisma.collegeStudent.create({
    data: {
      userId: user.id,
      collegeId,
      enrollmentNumber: `E16-${label}-${suffix}`,
      program: "B.Tech",
      course,
      section,
      batch,
      status: "active",
    },
  });
  return { user, student };
}

async function request(token: string, query = "") {
  return fetch(`${baseUrl}/credits/ledger${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

try {
  const collegeA = await createCollege("college-a");
  const collegeB = await createCollege("college-b");
  const administrator = await createFaculty(collegeA.id, "administrator", ["all"], {}, true);
  const restricted = await createFaculty(
    collegeA.id,
    "restricted",
    ["INTERVIEW_CREDIT_VIEW"],
    { programs: ["B.Tech"], courses: ["CSE"], sections: ["A"] }
  );
  const noPermission = await createFaculty(
    collegeA.id,
    "no-permission",
    [],
    { programs: ["B.Tech"], courses: ["CSE"], sections: ["A"] }
  );
  const outsideActor = await createFaculty(collegeA.id, "outside-actor", ["INTERVIEW_CREDIT_VIEW"]);
  const collegeBAdmin = await createFaculty(collegeB.id, "college-b-administrator", ["all"], {}, true);

  const inScope = await createStudent(collegeA.id, "cse-a", "CSE", "A");
  const secondInScope = await createStudent(collegeA.id, "cse-a-second", "CSE", "A");
  const wrongSection = await createStudent(collegeA.id, "cse-b", "CSE", "B");
  const wrongCourse = await createStudent(collegeA.id, "mechanical-a", "Mechanical", "A");
  const collegeBStudent = await createStudent(collegeB.id, "college-b", "CSE", "A");

  await prisma.collegeCreditTransaction.createMany({
    data: [
      ...Array.from({ length: 25 }, (_, index) => ({
        collegeId: collegeA.id,
        studentId: inScope.student.id,
        createdById: administrator.user.id,
        type: "FACULTY_DISTRIBUTION",
        amount: 1,
        balanceAfter: 399 - index,
        reason: `authorized-cse-a-primary-${index}`,
      })),
      ...Array.from({ length: 25 }, (_, index) => ({
        collegeId: collegeA.id,
        studentId: secondInScope.student.id,
        createdById: administrator.user.id,
        type: "STUDENT_CONSUMPTION",
        amount: -1,
        balanceAfter: 374 - index,
        reason: `authorized-cse-a-secondary-${index}`,
      })),
      ...Array.from({ length: 25 }, (_, index) => ({
        collegeId: collegeA.id,
        studentId: wrongSection.student.id,
        createdById: outsideActor.user.id,
        type: "FACULTY_DISTRIBUTION",
        amount: 2,
        balanceAfter: 349 - index,
        reason: `forbidden-section-b-${index}`,
        batchFilter: { privateMarker: `SECTION_B_PRIVATE_${index}` },
      })),
      ...Array.from({ length: 25 }, (_, index) => ({
        collegeId: collegeA.id,
        studentId: wrongCourse.student.id,
        createdById: outsideActor.user.id,
        type: "STUDENT_ASSIGNMENT",
        amount: 3,
        balanceAfter: 324 - index,
        reason: `forbidden-mechanical-${index}`,
        batchFilter: { privateMarker: `MECHANICAL_PRIVATE_${index}` },
      })),
      {
        collegeId: collegeA.id,
        studentId: null,
        createdById: administrator.user.id,
        type: "SUPER_ADMIN_ALLOCATION",
        amount: 500,
        balanceAfter: 500,
        reason: "institution-private-allocation",
      },
      {
        collegeId: collegeB.id,
        studentId: collegeBStudent.student.id,
        createdById: collegeBAdmin.user.id,
        type: "FACULTY_DISTRIBUTION",
        amount: 99,
        balanceAfter: 1,
        reason: "COLLEGE_B_PRIVATE_TRANSACTION",
      },
    ],
  });

  let response = await request(restricted.token, "?page=1&limit=20");
  assert.equal(response.status, 200);
  let body = await response.json() as any;
  assert.equal(body.total, 50);
  assert.equal(body.pagination.total, 50);
  assert.equal(body.pagination.totalPages, 3);
  assert.equal(body.transactions.length, 20);
  let responseText = JSON.stringify(body);
  assert.doesNotMatch(responseText, /forbidden-|PRIVATE_|outside-actor|institution-private|COLLEGE_B/);
  assert(body.transactions.every((transaction: any) =>
    transaction.recipientStudent?.course === "CSE" && transaction.recipientStudent?.section === "A"
  ));
  assert(body.transactions.every((transaction: any) =>
    transaction.performedBy?.name === administrator.user.name &&
    transaction.performedBy?.email === administrator.user.email &&
    !("createdBy" in transaction)
  ));
  console.log("PASS authorized ledger rows expose their recorded actor only as performedBy");
  console.log("PASS restricted ledger query returns only in-scope student transactions and authorized counts");

  response = await request(restricted.token, "?page=3&limit=20");
  body = await response.json() as any;
  assert.equal(body.transactions.length, 10);
  assert.equal(body.total, 50);
  console.log("PASS pagination is applied after authorization filtering");

  response = await request(restricted.token, `?studentId=${encodeURIComponent(wrongSection.student.id)}`);
  body = await response.json() as any;
  assert.equal(body.total, 0);
  assert.deepEqual(body.transactions, []);

  response = await request(restricted.token, `?studentId=${encodeURIComponent(inScope.student.id)}`);
  body = await response.json() as any;
  assert.equal(body.total, 25);
  console.log("PASS known student IDs cannot bypass scope while an in-scope ID remains queryable");

  response = await request(restricted.token, `?search=${encodeURIComponent(wrongCourse.user.email)}`);
  body = await response.json() as any;
  assert.equal(body.total, 0);
  responseText = JSON.stringify(body);
  assert.doesNotMatch(responseText, new RegExp(wrongCourse.user.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  response = await request(restricted.token, `?search=${encodeURIComponent(inScope.user.email)}`);
  body = await response.json() as any;
  assert.equal(body.total, 25);
  console.log("PASS search is intersected with scope and cannot reveal out-of-scope student identities");

  response = await request(restricted.token, `?collegeId=${encodeURIComponent(collegeB.id)}&search=COLLEGE_B_PRIVATE_TRANSACTION`);
  body = await response.json() as any;
  assert.equal(body.total, 0);
  assert.doesNotMatch(JSON.stringify(body), /COLLEGE_B_PRIVATE_TRANSACTION/);
  console.log("PASS client tenant parameters cannot expose another institution's ledger");

  response = await request(noPermission.token);
  assert.equal(response.status, 403);
  console.log("PASS cohort scope does not substitute for INTERVIEW_CREDIT_VIEW permission");

  response = await request(administrator.token, "?limit=100");
  body = await response.json() as any;
  assert.equal(body.total, 101);
  assert.equal(body.transactions.length, 100);
  response = await request(administrator.token, "?search=institution-private-allocation");
  body = await response.json() as any;
  assert.equal(body.total, 1);
  assert.equal(body.transactions[0]?.reason, "institution-private-allocation");
  assert.equal(body.transactions[0]?.performedBy?.name, administrator.user.name);
  console.log("PASS Main Faculty retains institution-wide ledger access including institution-level allocations");

  await prisma.user.update({ where: { id: outsideActor.user.id }, data: { isActive: false } });
  response = await request(administrator.token, "?search=forbidden-mechanical-0");
  body = await response.json() as any;
  assert.equal(body.total, 1);
  assert.equal(body.transactions[0]?.performedBy?.name, outsideActor.user.name);
  console.log("PASS deactivating an actor preserves historical ledger attribution");

  console.log("E-16 credit ledger scope regression suite passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const collegeId of collegeIds.reverse()) {
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { collegeId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
