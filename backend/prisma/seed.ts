import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  await Promise.all([
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

  const internalJobs = await prisma.job.findMany({
    where: {
      OR: [
        { applyUrl: { startsWith: "https://redresumes.com" } },
        { applyUrl: { startsWith: "https://www.redresumes.com" } },
        { company: { name: "RedResumes Labs" } }
      ]
    },
    select: { id: true }
  });

  if (internalJobs.length > 0) {
    const internalJobIds = internalJobs.map((job) => job.id);
    await prisma.savedJob.deleteMany({ where: { jobId: { in: internalJobIds } } });
    await prisma.application.deleteMany({ where: { jobId: { in: internalJobIds } } });
    await prisma.job.deleteMany({ where: { id: { in: internalJobIds } } });
  }
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
