import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, JobSourceType, RemoteType, EmploymentType, ExperienceLevel } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function createJobDedupeHash(input: { title: string; company: string; city?: string | null; description: string }): string {
  const value = `${input.title}|${input.company}|${input.city ?? ""}|${input.description}`.toLowerCase();
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const [candidate, employer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "candidate@example.com" },
      update: {},
      create: {
        name: "Demo Candidate",
        email: "candidate@example.com",
        passwordHash,
        role: UserRole.candidate
      }
    }),
    prisma.user.upsert({
      where: { email: "employer@example.com" },
      update: {},
      create: {
        name: "Demo Employer",
        email: "employer@example.com",
        passwordHash,
        role: UserRole.employer
      }
    })
  ]);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Demo Admin",
      email: "admin@example.com",
      passwordHash,
      role: UserRole.admin
    }
  });

  const company = await prisma.company.upsert({
    where: { id: "demo-company-id" },
    update: {},
    create: {
      id: "demo-company-id",
      name: "RedResumes Labs",
      website: "https://redresumes.com",
      description: "Career platform company",
      location: "Bengaluru, India"
    }
  });

  const dedupeHash = createJobDedupeHash({
    title: "Backend Engineer",
    company: company.name,
    city: "Bengaluru",
    description: "Build APIs and distributed systems"
  });

  await prisma.job.upsert({
    where: { dedupeHash },
    update: {},
    create: {
      title: "Backend Engineer",
      description: "Build APIs and distributed systems",
      companyId: company.id,
      postedById: employer.id,
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      remoteType: RemoteType.hybrid,
      employmentType: EmploymentType.full_time,
      experienceLevel: ExperienceLevel.mid,
      salaryMin: 100000,
      salaryMax: 180000,
      currency: "INR",
      sourceType: JobSourceType.direct,
      applyUrl: "https://redresumes.com/careers/backend-engineer",
      dedupeHash
    }
  });

  await prisma.savedJob.upsert({
    where: {
      userId_jobId: {
        userId: candidate.id,
        jobId: (await prisma.job.findFirstOrThrow({ where: { dedupeHash } })).id
      }
    },
    update: {},
    create: {
      userId: candidate.id,
      jobId: (await prisma.job.findFirstOrThrow({ where: { dedupeHash } })).id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
