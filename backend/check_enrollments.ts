import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const enrollments = await prisma.onboardingEnrollment.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  const emailSends = await prisma.onboardingEmailSend.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log("ENROLLMENTS:", JSON.stringify(enrollments, null, 2));
  console.log("EMAIL SENDS:", JSON.stringify(emailSends, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
