import { Worker } from "bullmq";
import { redisConnection } from "./db/redis.js";
import { fetchAdzunaJobs, fetchJoobleJobs } from "./modules/ingestion/adapters.js";
import { normalizeAndStoreJobs } from "./modules/ingestion/service.js";
import { prisma } from "./db/prisma.js";
import { indexJobById } from "./modules/search/search.service.js";
import { sendNotification } from "./modules/notifications/service.js";

new Worker(
  "job-ingestion",
  async (job) => {
    if (job.name !== "fetch-jobs") return;

    const source = job.data.source as "adzuna" | "jooble";
    const jobs = source === "adzuna" ? await fetchAdzunaJobs() : await fetchJoobleJobs();
    await normalizeAndStoreJobs(source, jobs);
  },
  { connection: redisConnection }
);

new Worker(
  "job-deduplication",
  async (job) => {
    if (job.name !== "dedupe-job") return;

    const existing = await prisma.job.findUnique({
      where: { id: job.data.jobId },
      include: { company: true }
    });

    if (!existing) return;

    const duplicates = await prisma.job.findMany({
      where: {
        dedupeHash: existing.dedupeHash,
        NOT: { id: existing.id }
      },
      orderBy: { createdAt: "asc" }
    });

    for (const duplicate of duplicates) {
      await prisma.job.delete({ where: { id: duplicate.id } });
    }
  },
  { connection: redisConnection }
);

new Worker(
  "job-indexing",
  async (job) => {
    if (job.name !== "index-job") return;
    await indexJobById(job.data.jobId);
  },
  { connection: redisConnection }
);

new Worker(
  "notifications",
  async (job) => {
    if (job.name !== "send-notification") return;
    await sendNotification(job.data.userId, job.data.message);
  },
  { connection: redisConnection }
);

console.log("Workers started for ingestion, deduplication, indexing, notifications");
