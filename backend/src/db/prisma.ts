import { PrismaClient } from "@prisma/client";

if (
  process.env.VERCEL &&
  process.env.DATABASE_PUBLIC_URL &&
  process.env.DATABASE_URL?.includes(".internal")
) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

export const prisma = new PrismaClient();
