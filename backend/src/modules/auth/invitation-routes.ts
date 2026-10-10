import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";

import { persistRefreshToken, setRefreshCookie } from "./refresh-session.js";
import { loadSessionContext } from "./session-context.js";

const router = Router();
const supportedInvitationRoles = new Set(["student", "college_faculty", "college_main_faculty"]);

// GET /api/auth/invitations/verify?token=... - Verify single-use token validity (query param format)
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

    if (!invitation || !supportedInvitationRoles.has(invitation.role)) {
      return res.status(404).json({
        success: false,
        code: "INVITATION_INVALID",
        message: "This invitation link is invalid or no longer available.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        code: invitation.status === "accepted" ? "INVITATION_USED" : "INVITATION_UNAVAILABLE",
        message: invitation.status === "accepted"
          ? "This invitation has already been accepted."
          : "This invitation link is invalid or no longer available.",
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        code: "INVITATION_EXPIRED",
        message: "This invitation link has expired. Please request a new invite from your college administrator.",
      });
    }

    res.json({
      success: true,
      // 'valid' field matches backendApi.enterprise.verifyInvitation response shape
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        college: invitation.college,
        collegeName: invitation.college.name,
        metadata: invitation.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/invitations/verify/:tokenHash
 * Path-param format used by frontend backendApi.enterprise.verifyInvitation(tokenHash)
 * The tokenHash here is the RAW token (not hashed) — consistent with the query-param route above.
 */
router.get("/verify/:rawToken", async (req, res, next) => {
  try {
    const rawToken = req.params.rawToken;
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

    if (!invitation || !supportedInvitationRoles.has(invitation.role)) {
      return res.status(404).json({
        success: false,
        code: "INVITATION_INVALID",
        message: "This invitation link is invalid or no longer available.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        code: invitation.status === "accepted" ? "INVITATION_USED" : "INVITATION_UNAVAILABLE",
        message: invitation.status === "accepted"
          ? "This invitation has already been accepted."
          : "This invitation link is invalid or no longer available.",
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        code: "INVITATION_EXPIRED",
        message: "This invitation link has expired. Please request a new invite from your college administrator.",
      });
    }

    res.json({
      success: true,
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        college: invitation.college,
        collegeName: invitation.college.name,
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
    // Accept both 'token' (legacy) and 'tokenHash' (frontend backendApi.enterprise.acceptInvitation)
    const schema = z.object({
      token: z.string().optional(),
      tokenHash: z.string().optional(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().optional(), // Optional name update
    }).refine((data) => data.token || data.tokenHash, {
      message: "Either token or tokenHash is required",
    });

    const parsed = schema.parse(req.body);
    const rawToken = parsed.token || parsed.tokenHash!;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { college: true },
    });

    if (
      !invitation ||
      !supportedInvitationRoles.has(invitation.role) ||
      invitation.status !== "pending" ||
      new Date() > invitation.expiresAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or previously used invitation token.",
      });
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const result = await prisma.$transaction(
      async (tx) => {
        // Claim the single-use token atomically. Concurrent/replayed requests
        // cannot both change the password.
        const claimed = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            status: "pending",
            expiresAt: { gt: new Date() },
          },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        });
        if (claimed.count !== 1) return null;

        const matchingUser = await tx.user.findFirst({
          where: { email: invitation.email, collegeId: invitation.collegeId },
          select: { id: true, role: true },
        });
        if (!matchingUser || matchingUser.role !== invitation.role) {
          throw new Error("Invitation account no longer exists in this institution.");
        }

        // The password changes only here, after successful token validation.
        const user = await tx.user.update({
          where: { id: matchingUser.id },
          data: {
            passwordHash,
            isActive: true,
          },
        });

        // Older refresh sessions are revoked only after the password actually
        // changes. Existing sessions are untouched by a resend request.
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });

        // Defensive cleanup if legacy data contains another pending token.
        await tx.invitation.updateMany({
          where: {
            id: { not: invitation.id },
            collegeId: invitation.collegeId,
            email: invitation.email,
            role: invitation.role,
            status: "pending",
          },
          data: { status: "revoked" },
        });

        if (invitation.role === "college_main_faculty" || invitation.role === "college_faculty") {
          const activatedFaculty = await tx.collegeFaculty.updateMany({
            where: { userId: user.id, collegeId: invitation.collegeId },
            data: { status: "active" },
          });
          if (activatedFaculty.count !== 1) {
            throw new Error("Invitation faculty profile no longer exists in this institution.");
          }
        }

        return user;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or previously used invitation token.",
      });
    }

    const context = await loadSessionContext(result.id);
    const accessToken = signAccessToken(context.payload);
    const refreshToken = signRefreshToken(context.payload);
    await persistRefreshToken(result.id, refreshToken);
    setRefreshCookie(res, refreshToken);

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
      user: { ...context.user, collegeName: invitation.college.name },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
