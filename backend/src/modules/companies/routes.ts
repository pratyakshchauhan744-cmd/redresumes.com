import { Router } from "express";
import { prisma } from "../../db/prisma.js";

const router = Router();

router.get("/:id", async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        jobs: {
          orderBy: { postedAt: "desc" },
          take: 20
        }
      }
    });

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
});

export default router;
