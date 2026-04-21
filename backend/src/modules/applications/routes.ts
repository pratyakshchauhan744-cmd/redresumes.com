import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

const applySchema = z.object({
  resumeUrl: z.string().url().optional()
});

router.post("/jobs/:id/apply", requireAuth, requireRole(["candidate"]), async (req, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    const application = await prisma.application.upsert({
      where: {
        userId_jobId: {
          userId: req.user!.id,
          jobId: job.id
        }
      },
      update: {
        resumeUrl: body.resumeUrl
      },
      create: {
        userId: req.user!.id,
        jobId: job.id,
        resumeUrl: body.resumeUrl
      }
    });

    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/users/me/applications", requireAuth, requireRole(["candidate"]), async (req, res, next) => {
  try {
    const items = await prisma.application.findMany({
      where: { userId: req.user!.id },
      include: {
        job: {
          include: {
            company: true
          }
        }
      },
      orderBy: { appliedAt: "desc" }
    });

    res.json(items);
  } catch (error) {
    next(error);
  }
});

export default router;
