-- AlterTable: Add scoreScale with default 100 to InterviewReport and InterviewAnswer
ALTER TABLE "InterviewReport" ADD COLUMN IF NOT EXISTS "scoreScale" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "InterviewAnswer" ADD COLUMN IF NOT EXISTS "scoreScale" INTEGER DEFAULT 100;

-- Safely migrate legacy 0-10 InterviewReport records to canonical 0-100 percentage scale.
-- Legacy records are identifiable by overallScore <= 10 and presence of legacy 0-10 category keys.
-- Seed/demo records already use 0-100 scores (e.g. 67-92) and are left completely untouched.
UPDATE "InterviewReport"
SET 
  "overallScore" = ROUND(("overallScore" * 10)::numeric, 1),
  "scoreScale" = 100
WHERE "overallScore" <= 10
  AND ("categoryScores"->>'clarity' IS NOT NULL OR "categoryScores"->>'communicationQuality' IS NOT NULL);

-- Safely migrate legacy 0-10 InterviewAnswer records to canonical 0-100 scale.
UPDATE "InterviewAnswer"
SET 
  "score" = ROUND(("score" * 10)::numeric, 1),
  "scoreScale" = 100
WHERE "score" IS NOT NULL AND "score" <= 10;
