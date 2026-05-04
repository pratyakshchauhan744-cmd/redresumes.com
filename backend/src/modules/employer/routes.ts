import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { createJobDedupeHash } from "../../utils/hash.js";
import { enqueueJobIndexing } from "../../queues/enqueue.js";

const router = Router();

const createJobSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  companyId: z.string().min(3),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  remoteType: z.enum(["onsite", "hybrid", "remote"]).default("onsite"),
  employmentType: z.enum(["full_time", "part_time", "contract", "internship", "freelance"]).default("full_time"),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead"]).default("entry"),
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  currency: z.string().default("USD"),
  applyUrl: z.string().url().optional()
});

router.use(requireAuth, requireRole(["employer", "admin"]));

router.post("/jobs", async (req, res, next) => {
  try {
    const body = createJobSchema.parse(req.body);

    const company = await prisma.company.findUnique({ where: { id: body.companyId } });
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    if (req.user!.role !== "admin" && company.ownerId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden: You are not authorized to post jobs for this company" });
      return;
    }

    const dedupeHash = createJobDedupeHash({
      title: body.title,
      company: company.name,
      city: body.city,
      description: body.description
    });

    const existing = await prisma.job.findUnique({ where: { dedupeHash } });
    if (existing) {
      res.status(409).json({ message: "Duplicate job detected", jobId: existing.id });
      return;
    }

    const job = await prisma.job.create({
      data: {
        title: body.title,
        description: body.description,
        companyId: body.companyId,
        postedById: req.user!.id,
        city: body.city,
        state: body.state,
        country: body.country,
        remoteType: body.remoteType,
        employmentType: body.employmentType,
        experienceLevel: body.experienceLevel,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        currency: body.currency,
        sourceType: "direct",
        applyUrl: body.applyUrl,
        dedupeHash
      }
    });

    await enqueueJobIndexing(job.id);

    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { postedById: req.user!.id },
      include: { company: true },
      orderBy: { postedAt: "desc" }
    });

    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get("/applications", async (req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      where: {
        job: {
          postedById: req.user!.id
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        job: {
          include: {
            company: true
          }
        }
      },
      orderBy: { appliedAt: "desc" }
    });

    res.json(applications);
  } catch (error) {
    next(error);
  }
});

export default router;
