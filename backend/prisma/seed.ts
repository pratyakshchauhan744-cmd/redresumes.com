import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("===============================================================================");
  console.log("  REDRESUMES ENTERPRISE SAAS: SEEDING DEMO INSTITUTION & TEST DATA");
  console.log("===============================================================================\n");

  const defaultPassword = "Password@123";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Super Admin Accounts
  console.log("-> 1. Seeding Super Admin accounts...");
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@redresumes.com" },
    update: { passwordHash, role: UserRole.admin, isActive: true },
    create: {
      name: "Platform Super Admin",
      email: "admin@redresumes.com",
      passwordHash,
      role: UserRole.admin,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { passwordHash, role: UserRole.admin, isActive: true },
    create: {
      name: "Demo Admin",
      email: "admin@example.com",
      passwordHash,
      role: UserRole.admin,
      isActive: true,
    },
  });
  console.log("   [OK] Super Admin: admin@redresumes.com / admin@example.com (Password: Password@123)");

  // 2. Demo College 1: Apex Institute of Technology
  console.log("\n-> 2. Seeding Demo College 1: Apex Institute of Technology (APEX)...");
  const apexCollege = await prisma.college.upsert({
    where: { code: "APEX" },
    update: {
      name: "Apex Institute of Technology",
      officialEmail: "contact@apex.edu",
      website: "https://apex.edu",
      status: "active",
    },
    create: {
      name: "Apex Institute of Technology",
      code: "APEX",
      officialEmail: "contact@apex.edu",
      website: "https://apex.edu",
      status: "active",
    },
  });

  // Credit Account for Apex
  await prisma.collegeCreditAccount.upsert({
    where: { collegeId: apexCollege.id },
    update: { balance: 480, totalAllocated: 500, totalDistributed: 20 },
    create: {
      collegeId: apexCollege.id,
      balance: 480,
      totalAllocated: 500,
      totalDistributed: 20,
    },
  });

  // Main Faculty for Apex
  const apexMainFacultyUser = await prisma.user.upsert({
    where: { email: "faculty@apex.edu" },
    update: {
      name: "Dr. Jane Smith",
      passwordHash,
      role: UserRole.college_main_faculty,
      collegeId: apexCollege.id,
      isActive: true,
    },
    create: {
      name: "Dr. Jane Smith",
      email: "faculty@apex.edu",
      passwordHash,
      role: UserRole.college_main_faculty,
      collegeId: apexCollege.id,
      isActive: true,
    },
  });

  await prisma.collegeFaculty.upsert({
    where: { userId: apexMainFacultyUser.id },
    update: {
      collegeId: apexCollege.id,
      department: "Computer Science & Engineering",
      designation: "Head of Placement Cell & Dean",
      employeeId: "FAC-APEX-001",
      isMainFaculty: true,
      permissions: ["all", "manageFaculty", "manageStudents", "distributeCredits", "viewAnalytics", "exportReports"],
      status: "active",
    },
    create: {
      userId: apexMainFacultyUser.id,
      collegeId: apexCollege.id,
      department: "Computer Science & Engineering",
      designation: "Head of Placement Cell & Dean",
      employeeId: "FAC-APEX-001",
      isMainFaculty: true,
      permissions: ["all", "manageFaculty", "manageStudents", "distributeCredits", "viewAnalytics", "exportReports"],
      status: "active",
    },
  });
  console.log("   [OK] Main Faculty: faculty@apex.edu (Password: Password@123)");

  // Subordinate Faculty / Evaluator for Apex
  const apexEvaluatorUser = await prisma.user.upsert({
    where: { email: "evaluator@apex.edu" },
    update: {
      name: "Prof. Rajesh Kumar",
      passwordHash,
      role: UserRole.college_faculty,
      collegeId: apexCollege.id,
      isActive: true,
    },
    create: {
      name: "Prof. Rajesh Kumar",
      email: "evaluator@apex.edu",
      passwordHash,
      role: UserRole.college_faculty,
      collegeId: apexCollege.id,
      isActive: true,
    },
  });

  await prisma.collegeFaculty.upsert({
    where: { userId: apexEvaluatorUser.id },
    update: {
      collegeId: apexCollege.id,
      department: "Information Technology",
      designation: "Assistant Professor & Placement Coordinator",
      employeeId: "FAC-APEX-002",
      isMainFaculty: false,
      permissions: ["manageStudents", "distributeCredits", "viewAnalytics", "exportReports"],
      status: "active",
    },
    create: {
      userId: apexEvaluatorUser.id,
      collegeId: apexCollege.id,
      department: "Information Technology",
      designation: "Assistant Professor & Placement Coordinator",
      employeeId: "FAC-APEX-002",
      isMainFaculty: false,
      permissions: ["manageStudents", "distributeCredits", "viewAnalytics", "exportReports"],
      status: "active",
    },
  });
  console.log("   [OK] Evaluator Faculty: evaluator@apex.edu (Password: Password@123)");

  // 3. Student Cohort for Apex (5 diverse students)
  console.log("\n-> 3. Seeding Student Cohort for Apex Institute...");
  const apexStudentsData = [
    {
      name: "Aarav Sharma",
      email: "student@apex.edu", // primary demo student
      altEmail: "aarav.sharma@apex.edu",
      roll: "APEX-2026-001",
      program: "B.Tech",
      course: "Computer Science & Engineering",
      section: "A",
      batch: "2022-2026",
      semester: 6,
      gender: "Male",
      credits: 5,
      targetRole: "Full Stack Software Engineer",
      overallScore: 88,
      pace: 135,
      fillers: 2,
    },
    {
      name: "Diya Patel",
      email: "diya.patel@apex.edu",
      roll: "APEX-2026-002",
      program: "B.Tech",
      course: "Computer Science & Engineering",
      section: "A",
      batch: "2022-2026",
      semester: 6,
      gender: "Female",
      credits: 4,
      targetRole: "Frontend React Developer",
      overallScore: 92,
      pace: 140,
      fillers: 1,
    },
    {
      name: "Rohan Gupta",
      email: "rohan.gupta@apex.edu",
      roll: "APEX-2026-003",
      program: "B.Tech",
      course: "Information Technology",
      section: "B",
      batch: "2022-2026",
      semester: 6,
      gender: "Male",
      credits: 3,
      targetRole: "Cloud DevOps Engineer",
      overallScore: 74,
      pace: 120,
      fillers: 5,
    },
    {
      name: "Ananya Singh",
      email: "ananya.singh@apex.edu",
      roll: "APEX-2026-004",
      program: "B.Tech",
      course: "Electronics & Communication",
      section: "A",
      batch: "2023-2027",
      semester: 4,
      gender: "Female",
      credits: 2,
      targetRole: "Embedded Firmware Engineer",
      overallScore: 81,
      pace: 128,
      fillers: 3,
    },
    {
      name: "Karan Verma",
      email: "karan.verma@apex.edu",
      roll: "APEX-2026-005",
      program: "MBA",
      course: "Tech Product Management",
      section: "A",
      batch: "2024-2026",
      semester: 2,
      gender: "Male",
      credits: 6,
      targetRole: "Associate Product Manager",
      overallScore: 67,
      pace: 115,
      fillers: 7,
    },
  ];

  for (const s of apexStudentsData) {
    const studentUser = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        passwordHash,
        role: UserRole.student,
        collegeId: apexCollege.id,
        isActive: true,
      },
      create: {
        name: s.name,
        email: s.email,
        passwordHash,
        role: UserRole.student,
        collegeId: apexCollege.id,
        isActive: true,
      },
    });

    await prisma.collegeStudent.upsert({
      where: { userId: studentUser.id },
      update: {
        collegeId: apexCollege.id,
        enrollmentNumber: s.roll,
        program: s.program,
        course: s.course,
        section: s.section,
        batch: s.batch,
        semester: s.semester,
        gender: s.gender,
        status: "active",
      },
      create: {
        userId: studentUser.id,
        collegeId: apexCollege.id,
        enrollmentNumber: s.roll,
        program: s.program,
        course: s.course,
        section: s.section,
        batch: s.batch,
        semester: s.semester,
        gender: s.gender,
        status: "active",
      },
    });

    // Create a demo resume for the student if none exists
    let resume = await prisma.resume.findFirst({
      where: { userId: studentUser.id },
    });

    if (!resume) {
      resume = await prisma.resume.create({
        data: {
          userId: studentUser.id,
          collegeId: apexCollege.id,
          fileName: `${s.name.replace(/\s+/g, "_")}_Resume.pdf`,
          parsedData: {
            basics: { name: s.name, email: s.email, phone: "+1 555-0199" },
            education: [{ institution: apexCollege.name, studyType: s.program, area: s.course }],
          },
        },
      });
    }

    // Create interview session & evaluation report
    const existingSession = await prisma.interviewSession.findFirst({
      where: { userId: studentUser.id },
      include: { report: true },
    });

    if (!existingSession) {
      const session = await prisma.interviewSession.create({
        data: {
          userId: studentUser.id,
          collegeId: apexCollege.id,
          resumeId: resume.id,
          targetRole: s.targetRole,
          companyType: "Tier-1 Tech Product",
          difficulty: "intermediate",
          interviewStyle: "technical_behavioral",
          durationMins: 25,
          status: "completed",
          creditUsed: true,
        },
      });

      await prisma.interviewReport.create({
        data: {
          sessionId: session.id,
          overallScore: s.overallScore,
          categoryScores: {
            technical: Math.min(100, s.overallScore + 4),
            communication: Math.min(100, s.overallScore - 2),
            problemSolving: s.overallScore,
          },
          strengths: ["Clear architectural explanations", "Systematic algorithmic breakdown", "Strong composure"],
          weaknesses: ["Could elaborate on production scaling", "Edge case coverage in dynamic programming"],
          recommendations: ["Review distributed systems latency trade-offs", "Practice timed mock rounds"],
          speakingPace: s.pace,
          fillerWords: s.fillers,
          voiceConfidence: 0.88,
        },
      });
    }

    console.log(`   [OK] Student: ${s.email} (Roll: ${s.roll}) - Score: ${s.overallScore}%`);
  }

  // Also create alias for student@apex.edu if different
  await prisma.user.upsert({
    where: { email: "student@apex.edu" },
    update: { passwordHash, role: UserRole.student, collegeId: apexCollege.id, isActive: true },
    create: {
      name: "Aarav Sharma",
      email: "student@apex.edu",
      passwordHash,
      role: UserRole.student,
      collegeId: apexCollege.id,
      isActive: true,
    },
  });

  // 4. Audit Logs for Apex
  console.log("\n-> 4. Seeding Institutional Audit Trail for Apex...");
  const sampleAuditEvents = [
    { action: "ONBOARD_COLLEGE", entity: "College", entityId: apexCollege.id, details: { name: apexCollege.name, code: "APEX" } },
    { action: "CREDITS_ALLOCATED", entity: "CollegeCreditAccount", entityId: apexCollege.id, details: { amount: 500, balanceAfter: 500 } },
    { action: "STUDENTS_IMPORTED", entity: "CollegeStudent", entityId: apexCollege.id, details: { totalProcessed: 5, totalCreated: 5, batch: "2022-2026" } },
    { action: "CREDITS_DISTRIBUTED", entity: "CollegeCreditAccount", entityId: apexCollege.id, details: { creditsPerStudent: 2, totalDeducted: 10, targetCohort: "CSE-A" } },
    { action: "FACULTY_INVITED", entity: "CollegeFaculty", entityId: apexEvaluatorUser.id, details: { email: "evaluator@apex.edu", role: "college_faculty" } },
    { action: "REPORTS_EXPORTED", entity: "InterviewReport", entityId: apexCollege.id, details: { format: "xlsx", exportedCount: 5 } },
  ];

  for (const log of sampleAuditEvents) {
    await prisma.enterpriseAuditLog.create({
      data: {
        collegeId: apexCollege.id,
        actorId: apexMainFacultyUser.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        newValue: log.details,
        ipAddress: "127.0.0.1",
        userAgent: "RedResumes-Enterprise/1.0",
      },
    });
  }
  console.log("   [OK] Seeded 6 institutional audit trail records");

  // 5. Demo College 2: Stanford Engineering Institute (Multi-Tenant Isolation Testing)
  console.log("\n-> 5. Seeding Demo College 2: Stanford Engineering Institute (STANFORD)...");
  const stanfordCollege = await prisma.college.upsert({
    where: { code: "STANFORD" },
    update: {
      name: "Stanford Engineering Institute",
      officialEmail: "contact@stanford.edu",
      website: "https://stanford.edu",
      status: "active",
    },
    create: {
      name: "Stanford Engineering Institute",
      code: "STANFORD",
      officialEmail: "contact@stanford.edu",
      website: "https://stanford.edu",
      status: "active",
    },
  });

  await prisma.collegeCreditAccount.upsert({
    where: { collegeId: stanfordCollege.id },
    update: { balance: 250, totalAllocated: 250, totalDistributed: 0 },
    create: {
      collegeId: stanfordCollege.id,
      balance: 250,
      totalAllocated: 250,
      totalDistributed: 0,
    },
  });

  const stanfordMainFacultyUser = await prisma.user.upsert({
    where: { email: "dean@stanford.edu" },
    update: {
      name: "Dr. David Miller",
      passwordHash,
      role: UserRole.college_main_faculty,
      collegeId: stanfordCollege.id,
      isActive: true,
    },
    create: {
      name: "Dr. David Miller",
      email: "dean@stanford.edu",
      passwordHash,
      role: UserRole.college_main_faculty,
      collegeId: stanfordCollege.id,
      isActive: true,
    },
  });

  await prisma.collegeFaculty.upsert({
    where: { userId: stanfordMainFacultyUser.id },
    update: {
      collegeId: stanfordCollege.id,
      department: "Electrical Engineering",
      designation: "Dean of Engineering",
      employeeId: "FAC-STAN-001",
      isMainFaculty: true,
      permissions: ["all"],
      status: "active",
    },
    create: {
      userId: stanfordMainFacultyUser.id,
      collegeId: stanfordCollege.id,
      department: "Electrical Engineering",
      designation: "Dean of Engineering",
      employeeId: "FAC-STAN-001",
      isMainFaculty: true,
      permissions: ["all"],
      status: "active",
    },
  });
  console.log("   [OK] Stanford Faculty: dean@stanford.edu (Password: Password@123)");

  // Stanford Student
  const stanfordStudentUser = await prisma.user.upsert({
    where: { email: "lucas.brown@stanford.edu" },
    update: {
      name: "Lucas Brown",
      passwordHash,
      role: UserRole.student,
      collegeId: stanfordCollege.id,
      isActive: true,
    },
    create: {
      name: "Lucas Brown",
      email: "lucas.brown@stanford.edu",
      passwordHash,
      role: UserRole.student,
      collegeId: stanfordCollege.id,
      isActive: true,
    },
  });

  await prisma.collegeStudent.upsert({
    where: { userId: stanfordStudentUser.id },
    update: {
      collegeId: stanfordCollege.id,
      enrollmentNumber: "STAN-2026-001",
      program: "B.S.",
      course: "Robotics & AI",
      section: "A",
      batch: "2022-2026",
      status: "active",
    },
    create: {
      userId: stanfordStudentUser.id,
      collegeId: stanfordCollege.id,
      enrollmentNumber: "STAN-2026-001",
      program: "B.S.",
      course: "Robotics & AI",
      section: "A",
      batch: "2022-2026",
      status: "active",
    },
  });
  console.log("   [OK] Stanford Student: lucas.brown@stanford.edu (Roll: STAN-2026-001)");

  console.log("\n===============================================================================");
  console.log("  SEEDING COMPLETE! ALL TEST ACCOUNTS READY WITH PASSWORD: 'Password@123'");
  console.log("===============================================================================");
  console.log("Super Admin:       admin@redresumes.com     / Password@123");
  console.log("Apex Main Faculty: faculty@apex.edu         / Password@123");
  console.log("Apex Evaluator:    evaluator@apex.edu       / Password@123");
  console.log("Apex Student:      student@apex.edu         / Password@123");
  console.log("Stanford Faculty:  dean@stanford.edu        / Password@123");
  console.log("===============================================================================\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
