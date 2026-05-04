import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { JOBS_INDEX, meili } from "../../db/meili.js";
import { env } from "../../config/env.js";
import { fetchAdzunaJobs, fetchJoobleJobs, type ExternalJob } from "../ingestion/adapters.js";
import { normalizeAndStoreJobs } from "../ingestion/service.js";

const router = Router();

const listJobsSchema = z.object({
  keyword: z.string().optional(),
  location: z.string().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  remoteType: z.enum(["onsite", "hybrid", "remote"]).optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "internship", "freelance"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

function mapExternalJobsToResponseItems(items: ExternalJob[]) {
  return items.map((item, index) => {
    const locationText = [item.city, item.state, item.country].filter(Boolean).join(", ").toLowerCase();
    const isRemote = locationText.includes("remote");
    const idSeed = `${item.externalId ?? `${item.title}-${item.company}-${index}`}`;

    return {
      id: `ext-${idSeed}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
      title: item.title,
      description: item.description,
      city: item.city ?? null,
      state: item.state ?? null,
      country: item.country ?? null,
      remoteType: isRemote ? "remote" : ("onsite" as const),
      employmentType: "full_time" as const,
      experienceLevel: "mid" as const,
      salaryMin: null,
      salaryMax: null,
      currency: "USD",
      applyUrl: item.applyUrl ?? null,
      postedAt: new Date().toISOString(),
      company: {
        id: `ext-company-${item.company}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        name: item.company,
        website: item.applyUrl ?? null
      }
    };
  });
}

router.get("/", async (req, res, next) => {
  try {
    const query = listJobsSchema.parse(req.query);

    // Bootstrap job catalog from Jooble on first run so Job Finder works out-of-the-box.
    if (env.JOOBLE_API_KEY || (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY)) {
      try {
        const jobsCount = await prisma.job.count();
        if (jobsCount === 0) {
          try {
            const externalJobs = env.JOOBLE_API_KEY ? await fetchJoobleJobs() : await fetchAdzunaJobs();
            if (externalJobs.length > 0) {
              await normalizeAndStoreJobs(env.JOOBLE_API_KEY ? "jooble" : "adzuna", externalJobs);
            }
          } catch {
            // Ignore ingestion bootstrap errors and continue with normal query path.
          }
        }
      } catch {
        // Database unavailable; fallback is handled below.
      }
    }

    if (query.keyword || query.location || query.remoteType || query.employmentType || query.experienceLevel) {
      try {
        const filters: string[] = [];
        if (query.remoteType) filters.push(`remoteType = '${query.remoteType}'`);
        if (query.employmentType) filters.push(`employmentType = '${query.employmentType}'`);
        if (query.experienceLevel) filters.push(`experienceLevel = '${query.experienceLevel}'`);
        if (query.salaryMin !== undefined) filters.push(`salaryMin >= ${query.salaryMin}`);
        if (query.salaryMax !== undefined) filters.push(`salaryMax <= ${query.salaryMax}`);

        const index = meili.index(JOBS_INDEX);
        const result = await index.search(query.keyword ?? query.location ?? "", {
          filter: filters.length > 0 ? filters.join(" AND ") : undefined,
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
          sort: ["postedAt:desc"]
        });

        res.json({
          total: result.estimatedTotalHits ?? result.hits.length,
          page: query.page,
          limit: query.limit,
          items: result.hits
        });
        return;
      } catch {
        // Fallback to PostgreSQL if Meilisearch is not available.
      }
    }

    const where = {
      remoteType: query.remoteType,
      employmentType: query.employmentType,
      experienceLevel: query.experienceLevel,
      salaryMin: query.salaryMin !== undefined ? { gte: query.salaryMin } : undefined,
      salaryMax: query.salaryMax !== undefined ? { lte: query.salaryMax } : undefined,
      OR: query.location
        ? [
            { city: { contains: query.location, mode: "insensitive" as const } },
            { state: { contains: query.location, mode: "insensitive" as const } },
            { country: { contains: query.location, mode: "insensitive" as const } }
          ]
        : undefined,
      title: query.keyword ? { contains: query.keyword, mode: "insensitive" as const } : undefined
    };

    try {
      const [items, total] = await Promise.all([
        prisma.job.findMany({
          where,
          include: { company: true },
          orderBy: { postedAt: "desc" },
          skip: (query.page - 1) * query.limit,
          take: query.limit
        }),
        prisma.job.count({ where })
      ]);

      res.json({ total, page: query.page, limit: query.limit, items });
      return;
    } catch {
      // Fallback mode: serve live jobs directly from provider when DB is unavailable.
      if (!env.JOOBLE_API_KEY && !(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY)) {
        res.json({ total: 0, page: query.page, limit: query.limit, items: [] });
        return;
      }

      try {
        const externalJobs = env.JOOBLE_API_KEY ? await fetchJoobleJobs() : await fetchAdzunaJobs();
        const mapped = mapExternalJobsToResponseItems(externalJobs);
        const filtered = mapped.filter((item) => {
          const keyword = query.keyword?.trim().toLowerCase();
          const location = query.location?.trim().toLowerCase();
          const matchKeyword =
            !keyword ||
            item.title.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword) ||
            item.company.name.toLowerCase().includes(keyword);
          const locationText = [item.city, item.state, item.country].filter(Boolean).join(", ").toLowerCase();
          const matchLocation = !location || locationText.includes(location);
          return matchKeyword && matchLocation;
        });

        const offset = (query.page - 1) * query.limit;
        const paged = filtered.slice(offset, offset + query.limit);
        res.json({ total: filtered.length, page: query.page, limit: query.limit, items: paged });
        return;
      } catch {
        res.json({ total: 0, page: query.page, limit: query.limit, items: [] });
        return;
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { company: true }
    });

    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

export default router;
