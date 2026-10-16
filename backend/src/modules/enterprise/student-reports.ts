import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { getReadinessCategory, normalizeReportScore } from "../../utils/score.js";

// There is no completedAt column. Report creation is the recorded evaluation
// completion time; session.createdAt is the interview start time.
export const reportOrder = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.InterviewReportOrderByWithRelationInput[];
export const evaluatedSessions = (collegeId: string) => ({
  collegeId, status: "completed", report: { isNot: null },
});

export function studentSummarySelect(collegeId: string) {
  return {
    id: true, userId: true, enrollmentNumber: true, program: true,
    course: true, section: true, batch: true, status: true, createdAt: true,
    user: { select: {
      name: true, email: true, phone: true, credits: { select: { balance: true } },
      _count: { select: { interviewSessions: { where: evaluatedSessions(collegeId) } } },
      interviewSessions: {
        where: evaluatedSessions(collegeId), take: 1,
        orderBy: [{ report: { createdAt: "desc" as const } }, { report: { id: "desc" as const } }],
        select: { targetRole: true, report: { select: { id: true, overallScore: true, scoreScale: true, createdAt: true, speakingPace: true, fillerWords: true } } },
      },
    } },
  } satisfies Prisma.CollegeStudentSelect;
}

type SummaryStudent = Prisma.CollegeStudentGetPayload<{ select: ReturnType<typeof studentSummarySelect> }>;
export function serializeStudentSummary(student: SummaryStudent, averageScore: number | null = null) {
  const latest = student.user.interviewSessions[0]?.report;
  const { user, ...identity } = student;
  return {
    ...identity, name: user.name, email: user.email, phone: user.phone,
    completedInterviewsCount: user._count.interviewSessions,
    latestScore: normalizeReportScore(latest), latestInterviewDate: latest?.createdAt ?? null,
    // Retain the existing students/analytics API fields for older consumers.
    averageScore, readinessRating: getReadinessCategory(averageScore),
    overallScore: normalizeReportScore(latest) ?? averageScore,
    availableCredits: user.credits?.balance ?? 0,
    latestTargetRole: user.interviewSessions[0]?.targetRole ?? null,
    speakingPace: latest?.speakingPace ?? null, fillerWords: latest?.fillerWords ?? null,
    reportId: latest?.id ?? null,
  };
}

/** Group in PostgreSQL, once for the page; never load full historical reports. */
export async function studentScoreAverages(collegeId: string, userIds: string[]) {
  const totals = new Map<string, { sum: number; count: number }>();
  if (!userIds.length) return new Map<string, number>();
  const groups = await prisma.$queryRaw<Array<{ userId: string; overallScore: number; scoreScale: number; count: bigint }>>(Prisma.sql`
    SELECT s."userId", r."overallScore", r."scoreScale", COUNT(*) AS count
    FROM "InterviewReport" r JOIN "InterviewSession" s ON s.id = r."sessionId"
    WHERE s."collegeId" = ${collegeId} AND s.status = 'completed' AND s."userId" IN (${Prisma.join(userIds)})
    GROUP BY s."userId", r."overallScore", r."scoreScale"
  `);
  for (const group of groups) {
    const score = normalizeReportScore(group);
    if (score === null) continue;
    const total = totals.get(group.userId) ?? { sum: 0, count: 0 };
    total.sum += score * Number(group.count); total.count += Number(group.count);
    totals.set(group.userId, total);
  }
  return new Map([...totals].map(([userId, total]) => [userId, Math.round(total.sum / total.count)]));
}

export const fullReportInclude = {
  session: { include: { questions: { orderBy: { orderIndex: "asc" as const }, include: { answer: true } } } },
} satisfies Prisma.InterviewReportInclude;
export type FullInterviewReport = Prisma.InterviewReportGetPayload<{ include: typeof fullReportInclude }>;
