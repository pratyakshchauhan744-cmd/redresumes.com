"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureAuthorized } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { sendInstitutionWelcomeEmail } from "@/lib/email";
import { invalidateTelemetryCache } from "@/lib/dashboard-queries";

const CreateCollegeSchema = z.object({
  name: z.string().min(2, "College name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").toUpperCase(),
  domain: z.string().min(3, "Domain is required"),
  contactEmail: z.string(),
  contactPhone: z.string().optional(),
  initialCredits: z.number().int().min(0).default(0),
  mainFacultyName: z.string().min(2, "Main faculty name is required"),
  mainFacultyEmail: z.string().email("Main faculty email must be valid"),
  mainFacultyPhone: z.string().optional(),
  password: z.string().optional(),
});

const AllocateCreditsSchema = z.object({
  collegeId: z.string().cuid(),
  amount: z.number().int().positive("Amount must be greater than 0"),
  description: z.string().min(3, "Description is required"),
});

const UpdateStatusSchema = z.object({
  collegeId: z.string().cuid(),
  status: z.enum(["active", "suspended", "inactive"]),
});

export async function createCollege(rawInput: unknown): Promise<
  | { success: true; college: any; facultyEmail: string; tempPassword?: string; emailSent?: boolean }
  | { success: false; error: string }
> {
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Super Admin authorization required" };
  }

  const validated = CreateCollegeSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0].message };
  }

  const {
    name,
    code,
    domain,
    contactEmail,
    contactPhone,
    initialCredits,
    mainFacultyName,
    mainFacultyEmail,
    mainFacultyPhone,
    password,
  } = validated.data;

  try {
    const existingCollege = await prisma.college.findFirst({
      where: {
        OR: [{ code }, { officialEmail: contactEmail.toLowerCase() }],
      },
    });

    if (existingCollege) {
      return {
        success: false,
        error: `A college with code "${code}" or email "${contactEmail}" already exists.`,
      };
    }

    // Pre-compute crypto & bcrypt hashes outside of the database transaction
    const tempPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : `Campus@${crypto.randomBytes(3).toString("hex")}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create College record
        const college = await tx.college.create({
          data: {
            name,
            code,
            officialEmail: contactEmail.toLowerCase(),
            contactPhone: contactPhone || null,
            website: domain.startsWith("http") ? domain : `https://${domain}`,
            status: "active",
          },
        });

        // 2. Create College Credit Account
        await tx.collegeCreditAccount.create({
          data: {
            collegeId: college.id,
            balance: initialCredits,
            totalAllocated: initialCredits,
            totalDistributed: 0,
          },
        });

        // 3. Create or update Main Faculty User
        let facultyUser = await tx.user.findUnique({
          where: { email: mainFacultyEmail.toLowerCase() },
        });

        if (!facultyUser) {
          facultyUser = await tx.user.create({
            data: {
              name: mainFacultyName,
              email: mainFacultyEmail.toLowerCase(),
              phone: mainFacultyPhone || null,
              passwordHash,
              role: "college_main_faculty",
              collegeId: college.id,
              isActive: true,
            },
          });
        } else {
          facultyUser = await tx.user.update({
            where: { id: facultyUser.id },
            data: {
              role: "college_main_faculty",
              collegeId: college.id,
              passwordHash,
              isActive: true,
            },
          });
        }

      // 4. Link User to College as Main Faculty
      await tx.collegeFaculty.create({
        data: {
          collegeId: college.id,
          userId: facultyUser.id,
          employeeId: `FAC-${code}-001`,
          department: "Administration / Placement Cell",
          designation: "Head of Placements & Main Faculty Admin",
          isMainFaculty: true,
          permissions: [
            "all",
            "manageFaculty",
            "manageStudents",
            "distributeCredits",
            "viewAnalytics",
            "exportReports",
          ],
          status: "active",
        },
      });

      // 5. Create Invitation Token
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

      await tx.invitation.create({
        data: {
          collegeId: college.id,
          email: mainFacultyEmail.toLowerCase(),
          role: "college_main_faculty",
          tokenHash,
          status: "accepted",
          expiresAt,
          acceptedAt: new Date(),
          invitedById: session.userId,
          metadata: {
            isMainFaculty: true,
            createdVia: "SUPER_ADMIN_ONBOARDING",
          },
        },
      });

      // 6. If initial credits allocated, log transaction
      if (initialCredits > 0) {
        await tx.collegeCreditTransaction.create({
          data: {
            collegeId: college.id,
            amount: initialCredits,
            balanceAfter: initialCredits,
            type: "SUPER_ADMIN_ALLOCATION",
            reason: `Initial credit grant upon institutional onboarding`,
            createdById: session.userId,
          },
        });
      }

        // 7. Audit log
        await logAdminAction({
          tx,
          actorId: session.userId,
          action: "ONBOARD_COLLEGE",
          targetType: "College",
          entityType: "College",
          entityId: college.id,
          targetId: college.id,
          newValue: {
            name,
            code,
            initialCredits,
            mainFacultyEmail,
          },
        });

        return {
          college,
          facultyEmail: mainFacultyEmail,
          tempPassword,
        };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    invalidateTelemetryCache();

    // 8. Dispatch Institutional Welcome Email with Credentials & Portal URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    const loginUrl = `${appUrl}/login?portal=enterprise`;

    let emailSent = false;
    try {
      const emailRes = await sendInstitutionWelcomeEmail({
        to: mainFacultyEmail,
        recipientName: mainFacultyName,
        collegeName: name,
        collegeCode: code,
        password: result.tempPassword,
        loginUrl,
      });
      emailSent = Boolean(emailRes.success);
    } catch (emailErr) {
      console.error("Failed to dispatch welcome email to institution:", emailErr);
    }

    revalidatePath("/admin/colleges");
    return { success: true, ...result, emailSent };
  } catch (error: any) {
    console.error("Failed to create college:", error);
    return { success: false, error: error.message || "Failed to onboard college" };
  }
}

export async function allocateCollegeCredits(rawInput: unknown): Promise<
  | { success: true; balance: number; totalAllocated: number }
  | { success: false; error: string }
> {
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Super Admin authorization required" };
  }

  const validated = AllocateCreditsSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0].message };
  }

  const { collegeId, amount, description } = validated.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.collegeCreditAccount.findUnique({
        where: { collegeId },
      });

      if (!account) {
        account = await tx.collegeCreditAccount.create({
          data: {
            collegeId,
            balance: 0,
            totalAllocated: 0,
            totalDistributed: 0,
          },
        });
      }

      const newBalance = account.balance + amount;
      const newTotalAllocated = account.totalAllocated + amount;

      const updatedAccount = await tx.collegeCreditAccount.update({
        where: { id: account.id },
        data: {
          balance: newBalance,
          totalAllocated: newTotalAllocated,
        },
      });

      await tx.collegeCreditTransaction.create({
        data: {
          collegeId,
          amount,
          balanceAfter: newBalance,
          type: "SUPER_ADMIN_ALLOCATION",
          reason: description,
          createdById: session.userId,
        },
      });

      await logAdminAction({
        tx,
        actorId: session.userId,
        action: "ALLOCATE_COLLEGE_CREDITS",
        entityType: "CollegeCreditAccount",
        entityId: account.id,
        oldValue: { balance: account.balance },
        newValue: { balance: newBalance, added: amount, description },
      });

      return { balance: updatedAccount.balance, totalAllocated: updatedAccount.totalAllocated };
    }, {
      maxWait: 20000,
      timeout: 60000,
    });

    invalidateTelemetryCache();

    revalidatePath(`/admin/colleges`);
    revalidatePath(`/admin/colleges/${collegeId}`);
    return { success: true, ...result };
  } catch (error: any) {
    console.error("Failed to allocate college credits:", error);
    return { success: false, error: error.message || "Failed to allocate credits" };
  }
}

export async function updateCollegeStatus(rawInput: unknown): Promise<
  | { success: true; college: any }
  | { success: false; error: string }
> {
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Super Admin authorization required" };
  }

  const validated = UpdateStatusSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0].message };
  }

  const { collegeId, status } = validated.data;

  try {
    const oldCollege = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!oldCollege) {
      return { success: false, error: "College not found" };
    }

    const updated = await prisma.college.update({
      where: { id: collegeId },
      data: { status },
    });

    await logAdminAction({
      actorId: session.userId,
      action: "UPDATE_COLLEGE_STATUS",
      entityType: "College",
      entityId: collegeId,
      oldValue: { status: oldCollege.status },
      newValue: { status },
    });

    revalidatePath("/admin/colleges");
    return { success: true, college: updated };
  } catch (error: any) {
    console.error("Failed to update college status:", error);
    return { success: false, error: error.message || "Failed to update status" };
  }
}
