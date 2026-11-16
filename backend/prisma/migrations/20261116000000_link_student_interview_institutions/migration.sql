-- Older student interviews were saved without collegeId, so institution reports
-- could not find them. Only restore missing links when both memberships agree.
UPDATE "InterviewSession" AS session
SET "collegeId" = student."collegeId"
FROM "CollegeStudent" AS student
JOIN "User" AS owner ON owner.id = student."userId"
WHERE session."userId" = student."userId"
  AND session."collegeId" IS NULL
  AND owner."collegeId" = student."collegeId";
