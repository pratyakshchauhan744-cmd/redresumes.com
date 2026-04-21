import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

router.post("/jobs/:id/save", requireAuth, requireRole(["candidate"]), async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    const saved = await prisma.savedJob.upsert({
      where: {
        userId_jobId: {
          userId: req.user!.id,
          jobId: job.id
        }
      },
      update: {},
      create: {
        userId: req.user!.id,
        jobId: job.id
      }
    });

    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.get("/users/me/saved-jobs", requireAuth, requireRole(["candidate"]), async (req, res, next) => {
  try {
    const items = await prisma.savedJob.findMany({
      where: { userId: req.user!.id },
      include: {
        job: {
          include: { company: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(items);
  } catch (error) {
    next(error);
  }
});

export default router;
