import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../db/prisma.js";

const router = Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        credits: {
          select: {
            balance: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      credits: user.credits?.balance ?? 0
    });
  } catch (err) {
    next(err);
  }
});

export default router;
