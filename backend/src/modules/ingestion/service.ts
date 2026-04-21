import { prisma } from "../../db/prisma.js";
import { createJobDedupeHash } from "../../utils/hash.js";
import type { ExternalJob } from "./adapters.js";
import { enqueueJobIndexing } from "../../queues/enqueue.js";

export async function normalizeAndStoreJobs(source: string, jobs: ExternalJob[]): Promise<{ insertedCount: number; dedupedCount: number }> {
  let insertedCount = 0;
  let dedupedCount = 0;

  for (const raw of jobs) {
    const company = await prisma.company.upsert({
      where: { id: `ingested-${raw.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}` },
      update: {},
      create: {
        id: `ingested-${raw.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        name: raw.company,
        location: [raw.city, raw.state, raw.country].filter(Boolean).join(", ")
      }
    });

    const dedupeHash = createJobDedupeHash({
      title: raw.title,
      company: raw.company,
      city: raw.city,
      description: raw.description
    });

    const duplicate = await prisma.job.findUnique({ where: { dedupeHash } });
    if (duplicate) {
      dedupedCount += 1;
      continue;
    }

    const created = await prisma.job.create({
      data: {
        title: raw.title,
        description: raw.description,
        companyId: company.id,
        city: raw.city,
        state: raw.state,
        country: raw.country,
        sourceType: "api",
        externalId: raw.externalId,
        applyUrl: raw.applyUrl,
        dedupeHash
      }
    });

    insertedCount += 1;
    await enqueueJobIndexing(created.id);
  }

  await prisma.ingestionLog.create({
    data: {
      source,
      fetchedCount: jobs.length,
      insertedCount,
      dedupedCount,
      status: "completed"
    }
  });

  return { insertedCount, dedupedCount };
}
