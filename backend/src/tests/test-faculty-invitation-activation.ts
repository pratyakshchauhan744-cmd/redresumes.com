import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import invitationRoutes from "../modules/auth/invitation-routes.js";
import { errorHandler } from "../middleware/error-handler.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collegeIds: string[] = [];

const app = express();
app.use(express.json());
app.use("/api/auth/invitations", invitationRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/api/auth/invitations`;

async function request(method: string, path: string, body?: Record<string, unknown>) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function fixture(label: string, expiresAt = new Date(Date.now() + 60_000)) {
  const college = await prisma.college.create({
    data: {
      name: `E13 ${label} ${suffix}`,
      code: `E13-${label}-${suffix}`,
      officialEmail: `e13.${label}.${suffix}@example.com`,
      status: "active",
    },
  });
  collegeIds.push(college.id);
  const bootstrapPassword = `E13-Unknown-${label}-Bootstrap!`;
  const user = await prisma.user.create({
    data: {
      name: `E13 ${label} Faculty`,
      email: `e13.${label}.faculty.${suffix}@example.com`,
      passwordHash: await bcrypt.hash(bootstrapPassword, 4),
      role: "college_faculty",
      collegeId: college.id,
      isActive: false,
      facultyProfile: {
        create: {
          collegeId: college.id,
          status: "invited",
          permissions: ["STUDENT_VIEW"],
        },
      },
    },
  });
  const rawToken = crypto.randomBytes(32).toString("hex");
  const invitation = await prisma.invitation.create({
    data: {
      collegeId: college.id,
      email: user.email,
      role: "college_faculty",
      tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
      expiresAt,
      status: "pending",
      metadata: { name: user.name },
    },
  });
  return { college, user, invitation, rawToken, bootstrapPassword };
}

try {
  const valid = await fixture("valid");
  const originalHash = valid.user.passwordHash;

  let response = await request("GET", `/verify/${valid.rawToken}`);
  assert.equal(response.status, 200);
  const verification = await response.json() as {
    invitation: { email: string; role: string; collegeName: string };
  };
  assert.equal(verification.invitation.email, valid.user.email);
  assert.equal(verification.invitation.role, "college_faculty");
  assert.equal(verification.invitation.collegeName, valid.college.name);
  assert.notEqual(verification.invitation.email, "tampered@example.com");
  console.log("PASS valid token verification returns authoritative faculty identity without trusting URL email");

  response = await request("POST", "/accept", { tokenHash: valid.rawToken, password: "short" });
  assert.equal(response.status, 400);
  assert.equal((await prisma.invitation.findUniqueOrThrow({ where: { id: valid.invitation.id } })).status, "pending");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: valid.user.id } })).passwordHash, originalHash);
  console.log("PASS backend password rejection leaves the invitation usable and account unchanged");

  const chosenPassword = "E13-Faculty-Chosen-Password!";
  response = await request("POST", "/accept", { tokenHash: valid.rawToken, password: chosenPassword });
  assert.equal(response.status, 200);
  const activated = await prisma.user.findUniqueOrThrow({
    where: { id: valid.user.id },
    include: { facultyProfile: true },
  });
  assert.equal(activated.isActive, true);
  assert.equal(activated.facultyProfile?.status, "active");
  assert.equal(await bcrypt.compare(chosenPassword, activated.passwordHash), true);
  assert.equal((await prisma.invitation.findUniqueOrThrow({ where: { id: valid.invitation.id } })).status, "accepted");
  console.log("PASS acceptance atomically sets password, activates faculty, and consumes invitation");

  const acceptedHash = activated.passwordHash;
  response = await request("POST", "/accept", {
    tokenHash: valid.rawToken,
    password: "E13-Replay-Must-Not-Work!",
  });
  assert.equal(response.status, 400);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: valid.user.id } })).passwordHash, acceptedHash);
  response = await request("GET", `/verify/${valid.rawToken}`);
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { message: string }).message, /already been accepted/i);
  console.log("PASS accepted token replay is rejected without changing the activated account");

  const expired = await fixture("expired", new Date(Date.now() - 1_000));
  response = await request("GET", `/verify/${expired.rawToken}`);
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { message: string }).message, /expired/i);
  response = await request("POST", "/accept", {
    tokenHash: expired.rawToken,
    password: "E13-Expired-Must-Not-Work!",
  });
  assert.equal(response.status, 400);
  const expiredUser = await prisma.user.findUniqueOrThrow({
    where: { id: expired.user.id },
    include: { facultyProfile: true },
  });
  assert.equal(expiredUser.isActive, false);
  assert.equal(expiredUser.facultyProfile?.status, "invited");
  console.log("PASS expired invitation cannot activate or change the faculty account");

  response = await request("GET", `/verify/${crypto.randomBytes(32).toString("hex")}`);
  assert.equal(response.status, 404);
  assert.match(((await response.json()) as { message: string }).message, /invalid or no longer available/i);
  console.log("PASS invalid token receives a generic response with no account disclosure");

  const concurrent = await fixture("concurrent");
  const concurrentResponses = await Promise.all([
    request("POST", "/accept", { tokenHash: concurrent.rawToken, password: "E13-Concurrent-Password-A!" }),
    request("POST", "/accept", { tokenHash: concurrent.rawToken, password: "E13-Concurrent-Password-B!" }),
  ]);
  assert.deepEqual(concurrentResponses.map((item) => item.status).sort(), [200, 400]);
  assert.equal((await prisma.invitation.findUniqueOrThrow({ where: { id: concurrent.invitation.id } })).status, "accepted");
  console.log("PASS concurrent double submission has exactly one effective acceptance");

  console.log("E-13 faculty invitation activation regression suite passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  for (const collegeId of collegeIds.reverse()) {
    const users = await prisma.user.findMany({ where: { collegeId }, select: { id: true } });
    await prisma.college.delete({ where: { id: collegeId } }).catch(() => undefined);
    if (users.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    }
  }
  await prisma.$disconnect();
}
