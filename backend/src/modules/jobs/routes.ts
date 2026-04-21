import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { JOBS_INDEX, meili } from "../../db/meili.js";

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

router.get("/", async (req, res, next) => {
  try {
    const query = listJobsSchema.parse(req.query);

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
