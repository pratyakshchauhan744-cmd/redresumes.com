import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { prisma } from "../../db/prisma.js";

const router = Router();

router.use(requireAuth, requireRole(["admin"]));

router.get("/stats", async (_req, res, next) => {
  try {
    const [users, companies, jobs, applications, logs] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.ingestionLog.findMany({ take: 20, orderBy: { createdAt: "desc" } })
    ]);

    res.json({ users, companies, jobs, applications, recentIngestionLogs: logs });
  } catch (error) {
    next(error);
  }
});

export default router;
