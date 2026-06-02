import { Router } from "express";
import type { SignInMethod, UserRole } from "@prisma/client";
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

type SignInActivityItem = {
  signedInAt: Date;
  name: string;
  email: string;
  role: UserRole;
  method: "email_password" | "google" | "existing_session";
  userId: string;
};

function methodLabel(method: SignInMethod | "existing_session"): "email_password" | "google" | "existing_session" {
  return method;
}

router.get("/signins", async (_req, res, next) => {
  try {
    let trackedRows: SignInActivityItem[] = [];

    try {
      const signIns = await prisma.signInEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      trackedRows = signIns.map((event) => ({
        signedInAt: event.createdAt,
        name: event.user.name,
        email: event.user.email,
        role: event.user.role,
        method: methodLabel(event.method),
        userId: event.user.id
      }));
    } catch (error) {
      console.warn("Sign-in event query skipped:", error instanceof Error ? error.message : "unknown error");
    }

    const activeSessions = await prisma.refreshToken.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    const trackedUserIds = new Set(trackedRows.map((event) => event.userId));
    const seenSessionUserIds = new Set<string>();
    const sessionRows = activeSessions
      .filter((session) => {
        if (trackedUserIds.has(session.userId) || seenSessionUserIds.has(session.userId)) {
          return false;
        }
        seenSessionUserIds.add(session.userId);
        return true;
      })
      .map((session) => ({
        signedInAt: session.createdAt,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        method: methodLabel("existing_session"),
        userId: session.user.id
      }));

    const items = [...trackedRows, ...sessionRows]
      .sort((left, right) => right.signedInAt.getTime() - left.signedInAt.getTime())
      .map((item) => ({
        ...item,
        signedInAt: item.signedInAt.toISOString()
      }));

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

export default router;
