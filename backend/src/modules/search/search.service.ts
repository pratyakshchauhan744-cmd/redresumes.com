import { JOBS_INDEX, meili } from "../../db/meili.js";
import { prisma } from "../../db/prisma.js";

export async function ensureJobsIndex(): Promise<void> {
  const index = meili.index(JOBS_INDEX);
  try {
    await index.getRawInfo();
  } catch {
    await meili.createIndex(JOBS_INDEX, { primaryKey: "id" });
    await index.updateFilterableAttributes([
      "city",
      "state",
      "country",
      "remoteType",
      "employmentType",
      "experienceLevel",
      "salaryMin",
      "salaryMax"
    ]);
    await index.updateSortableAttributes(["postedAt", "salaryMin", "salaryMax"]);
  }
}

export async function indexJobById(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: true }
  });

  if (!job) return;

  const index = meili.index(JOBS_INDEX);
  await index.addDocuments([
    {
      id: job.id,
      title: job.title,
      description: job.description,
      company: {
        id: job.company.id,
        name: job.company.name,
        website: job.company.website
      },
      city: job.city,
      state: job.state,
      country: job.country,
      remoteType: job.remoteType,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      currency: job.currency,
      applyUrl: job.applyUrl,
      postedAt: job.postedAt.toISOString()
    }
  ]);
}
