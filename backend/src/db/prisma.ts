import { env } from "../config/env.js";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

if (
  process.env.VERCEL &&
  process.env.DATABASE_PUBLIC_URL &&
  process.env.DATABASE_URL?.includes(".internal")
) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

// Append connection pool settings to DATABASE_URL if not already present
function buildDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "10");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const databaseUrl = buildDatabaseUrl(process.env.DATABASE_URL || env.DATABASE_URL);

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

