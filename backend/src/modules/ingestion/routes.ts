import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { enqueueIngestion } from "../../queues/enqueue.js";

const router = Router();

const schema = z.object({
  source: z.enum(["adzuna", "jooble"])
});

router.post("/trigger", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    await enqueueIngestion(body.source);
    res.status(202).json({ message: `Ingestion queued for ${body.source}` });
  } catch (error) {
    next(error);
  }
});

export default router;
