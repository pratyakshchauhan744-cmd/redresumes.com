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
        phone: true,
        location: true,
        bio: true,
        photoDataUrl: true,
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
      phone: user.phone ?? "",
      location: user.location ?? "",
      bio: user.bio ?? "",
      photoDataUrl: user.photoDataUrl ?? "",
      credits: user.credits?.balance ?? 0
    });
  } catch (err) {
    next(err);
  }
});

router.put("/profile", requireAuth, async (req, res, next) => {
  try {
    const { name, phone, location, bio, photoDataUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name,
        phone,
        location,
        bio,
        photoDataUrl
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        phone: true,
        location: true,
        bio: true,
        photoDataUrl: true,
        credits: {
          select: {
            balance: true
          }
        }
      }
    });

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      phone: updatedUser.phone ?? "",
      location: updatedUser.location ?? "",
      bio: updatedUser.bio ?? "",
      photoDataUrl: updatedUser.photoDataUrl ?? "",
      credits: updatedUser.credits?.balance ?? 0
    });
  } catch (err) {
    next(err);
  }
});

export default router;
