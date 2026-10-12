import { prisma } from "../db/prisma.js";
import { isLegacyTenScaleRecord, normalizeInterviewScore, normalizeCategoryScores } from "../utils/score.js";

async function main() {
  console.log("=== Migrating Legacy Interview Scores to Canonical 0-100 Scale ===");

  const reports = await prisma.interviewReport.findMany();
  let migratedCount = 0;
  let alreadyCanonicalCount = 0;

  for (const report of reports) {
    const isLegacy = isLegacyTenScaleRecord(report as any);

    if (isLegacy) {
      const canonicalScore = normalizeInterviewScore(report.overallScore, 10);
      const rawCategoryScores = report.categoryScores as Record<string, any>;
      const canonicalCategoryScores = normalizeCategoryScores(rawCategoryScores, 10);

      await prisma.interviewReport.update({
        where: { id: report.id },
        data: {
          overallScore: canonicalScore,
          scoreScale: 100,
          categoryScores: canonicalCategoryScores,
        },
      });

      console.log(
        ` [Migrated] Report ${report.id}: ${report.overallScore}/10 -> ${canonicalScore}/100`
      );
      migratedCount++;
    } else {
      // Ensure scoreScale is set to 100
      if ((report as any).scoreScale !== 100) {
        await prisma.interviewReport.update({
          where: { id: report.id },
          data: { scoreScale: 100 },
        });
      }
      console.log(
        ` [Unchanged] Report ${report.id}: already canonical ${report.overallScore}/100`
      );
      alreadyCanonicalCount++;
    }
  }

  // Also migrate any answers on 0-10 scale
  const answers = await prisma.interviewAnswer.findMany({
    where: { score: { not: null } },
  });

  let migratedAnswersCount = 0;
  for (const ans of answers) {
    if (ans.score !== null && ans.score <= 10) {
      const canonicalAnsScore = normalizeInterviewScore(ans.score, 10);
      await prisma.interviewAnswer.update({
        where: { id: ans.id },
        data: {
          score: canonicalAnsScore,
          scoreScale: 100,
        },
      });
      migratedAnswersCount++;
    } else if (ans.score !== null) {
      await prisma.interviewAnswer.update({
        where: { id: ans.id },
        data: { scoreScale: 100 },
      });
    }
  }

  console.log(`\nMigration completed:`);
  console.log(`  - Reports migrated: ${migratedCount}`);
  console.log(`  - Reports already canonical: ${alreadyCanonicalCount}`);
  console.log(`  - Answers migrated: ${migratedAnswersCount}`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
