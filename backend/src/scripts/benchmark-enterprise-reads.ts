import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

// Read-only diagnostic: prints timings/query counts, never identities, SQL,
// credentials or query parameters. No login, account writes or emails occur.
const url = new URL(env.DATABASE_URL);
if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "30");
if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "10");
const db = new PrismaClient({
  datasources: { db: { url: url.toString() } },
  log: [{ level: "query", emit: "event" }],
});
let queryCount = 0;
db.$on("query", () => { queryCount++; });
async function measure<T>(label: string, run: () => Promise<T>) {
  queryCount = 0;
  const started = performance.now();
  const result = await run();
  console.log(JSON.stringify({ label, ms: Math.round(performance.now() - started), queries: queryCount }));
  return result;
}
try {
  await measure("cold SELECT 1", () => db.$queryRaw`SELECT 1`);
  for (let i = 0; i < 3; i++) await measure("warm SELECT 1", () => db.$queryRaw`SELECT 1`);
  const actor = await db.user.findFirst({
    where: { isActive: true, role: "college_main_faculty", college: { status: "active" }, facultyProfile: { status: "active" } },
    select: { id: true, collegeId: true },
  });
  if (!actor?.collegeId) throw new Error("No active school administrator available for profiling");
  const collegeId = actor.collegeId;
  for (const strategy of ["query", "join"] as const) {
    await measure(`authorization (${strategy})`, () => db.user.findUnique({
      relationLoadStrategy: strategy,
      where: { id: actor.id },
      select: {
        isActive: true, role: true, collegeId: true, college: { select: { status: true } },
        facultyProfile: { select: {
          collegeId: true, status: true, isMainFaculty: true, permissions: true,
          programAccess: true, courseAccess: true, sectionAccess: true, batchAccess: true,
          scopeUnrestricted: true, cohortAccess: true,
        } },
      },
    }));
    const rows = await measure(`student page (${strategy})`, () => db.collegeStudent.findMany({
      relationLoadStrategy: strategy, where: { collegeId }, take: 15,
      orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }],
      include: { user: { select: {
        id: true, name: true, email: true, phone: true, credits: { select: { balance: true } },
        _count: { select: { interviewSessions: true, resumes: true } },
      } } },
    }));
    console.log(JSON.stringify({ strategy, studentPageRows: rows.length }));
  }
} catch (error) {
  console.error("Read-only benchmark failed:", error instanceof Error ? error.name : "Unknown error");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
