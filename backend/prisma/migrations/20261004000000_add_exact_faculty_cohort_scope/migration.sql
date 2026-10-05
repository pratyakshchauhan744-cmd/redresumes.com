ALTER TABLE "CollegeFaculty"
ADD COLUMN "batchAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "scopeUnrestricted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "cohortAccess" JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Convert every existing restricted faculty assignment to concrete student
-- cohort tuples. This removes the Cartesian authorization behavior at deploy
-- time rather than waiting for an administrator to edit each account.
UPDATE "CollegeFaculty" AS faculty
SET
  "scopeUnrestricted" = (
    faculty."isMainFaculty" OR (
      cardinality(faculty."programAccess") = 0 AND
      cardinality(faculty."courseAccess") = 0 AND
      cardinality(faculty."sectionAccess") = 0
    )
  ),
  "cohortAccess" = CASE
    WHEN faculty."isMainFaculty" OR (
      cardinality(faculty."programAccess") = 0 AND
      cardinality(faculty."courseAccess") = 0 AND
      cardinality(faculty."sectionAccess") = 0
    ) THEN '[]'::JSONB
    ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'program', cohort.program,
        'course', cohort.course,
        'section', cohort.section,
        'batch', cohort.batch
      ))
      FROM (
        SELECT DISTINCT student.program, student.course, student.section, student.batch
        FROM "CollegeStudent" AS student
        WHERE student."collegeId" = faculty."collegeId"
          AND (
            cardinality(faculty."programAccess") = 0 OR
            student.program = ANY(faculty."programAccess")
          )
          AND (
            cardinality(faculty."courseAccess") = 0 OR
            student.course = ANY(faculty."courseAccess")
          )
          AND (
            cardinality(faculty."sectionAccess") = 0 OR
            student.section = ANY(faculty."sectionAccess")
          )
      ) AS cohort
    ), '[]'::JSONB)
  END;
