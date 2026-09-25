import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";

const router = Router();

// GET /api/auth/invitations/verify?token=... - Verify single-use token validity
router.get("/verify", async (req, res, next) => {
  try {
    const rawToken = req.query.token as string;
    if (!rawToken) {
      return res.status(400).json({ success: false, message: "Invitation token is required." });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        college: {
          select: { id: true, name: true, code: true, officialEmail: true },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: "Invalid or expired invitation token." });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This invitation has already been ${invitation.status}.`,
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "This invitation link has expired. Please request a new invite from your college administrator.",
      });
    }

    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        college: invitation.college,
        metadata: invitation.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/invitations/accept - Set permanent password and activate account
router.post("/accept", async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "Token is required"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });

    const { token, password } = schema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { college: true },
    });

    if (!invitation || invitation.status !== "pending" || new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or previously used invitation token.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Update User password and status
        const user = await tx.user.update({
          where: { email: invitation.email },
          data: {
            passwordHash,
            isActive: true,
          },
        });

        // 2. Mark Invitation accepted
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        });

        // 3. Mark faculty profile active if applicable
        if (invitation.role === "college_main_faculty" || invitation.role === "college_faculty") {
          await tx.collegeFaculty.updateMany({
            where: { userId: user.id },
            data: { status: "active" },
          });
        }

        return user;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    // Generate JWT tokens
    const accessToken = signAccessToken({
      sub: result.id,
      email: result.email,
      role: result.role,
      collegeId: result.collegeId,
      isMainFaculty: invitation.role === "college_main_faculty",
    });

    const refreshToken = signRefreshToken({
      sub: result.id,
      email: result.email,
      role: result.role,
      collegeId: result.collegeId,
      isMainFaculty: invitation.role === "college_main_faculty",
    });

    await logEnterpriseAudit({
      collegeId: invitation.collegeId,
      actorId: result.id,
      action: "INVITATION_ACCEPTED",
      entity: "User",
      entityId: result.id,
      newValue: { email: result.email, role: result.role },
    });

    res.json({
      success: true,
      message: "Account activated successfully.",
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        role: result.role,
        collegeId: result.collegeId,
        collegeName: invitation.college.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
