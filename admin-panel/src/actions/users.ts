"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAuthorized } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { UserRole } from "@prisma/client";

const ToggleStatusSchema = z.object({
  userId: z.string().cuid(),
  isActive: z.boolean(),
});

const ChangeRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(UserRole),
});

/**
 * Enable/Disable user accounts. Guards write action behind Admin role.
 * Includes lockout protection.
 */
export async function toggleUserStatus(rawInput: unknown) {
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Unauthorized staff level" };
  }

  const validated = ToggleStatusSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: "Invalid parameters supplied" };
  }

  const { userId, isActive } = validated.data;

  // 1. Prevent self-suspension
  if (userId === session.userId && !isActive) {
    return {
      success: false,
      error: "Operation aborted: You cannot suspend your own administrative account.",
    };
  }

  try {
    const errorMsg = await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!targetUser) {
        throw new Error("Target user could not be resolved");
      }

      if (targetUser.isActive === isActive) {
        return null;
      }

      // 2. Prevent suspending the last remaining administrator
      if (targetUser.role === "admin" && !isActive) {
        const activeAdminsCount = await tx.user.count({
          where: {
            role: "admin",
            isActive: true,
          },
        });

        if (activeAdminsCount <= 1) {
          throw new Error("Operation aborted: Cannot suspend the last remaining active Administrator.");
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
        select: { id: true, isActive: true },
      });

      await logAdminAction({
        tx,
        actorId: session.userId,
        action: isActive ? "ACTIVATE_USER" : "SUSPEND_USER",
        entityType: "User",
        entityId: userId,
        oldValue: { isActive: targetUser.isActive },
        newValue: { isActive: updated.isActive },
      });

      return null;
    });

    if (errorMsg) {
      return { success: false, error: errorMsg };
    }

    revalidatePath(`/admin/users`);
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/roles`);

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to toggle status for user ${userId}:`, error);
    return { success: false, error: error.message || "Database update operation aborted" };
  }
}

/**
 * Modify user roles (promote/demote candidates/employers/staff). Admin only.
 * Includes privilege escalation and lockout protections.
 */
export async function changeUserRole(rawInput: unknown) {
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Unauthorized staff level" };
  }

  const validated = ChangeRoleSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: "Invalid parameters supplied" };
  }

  const { userId, role } = validated.data;

  // 1. Prevent self-demotion
  if (userId === session.userId && role !== "admin") {
    return {
      success: false,
      error: "Operation aborted: You cannot demote your own Administrative privileges.",
    };
  }

  try {
    const errorMsg = await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, isActive: true },
      });

      if (!targetUser) {
        throw new Error("Target user could not be resolved");
      }

      if (targetUser.role === role) {
        return null;
      }

      // 2. Prevent demoting the last remaining active administrator
      if (targetUser.role === "admin" && role !== "admin") {
        const activeAdminsCount = await tx.user.count({
          where: {
            role: "admin",
            isActive: true,
          },
        });

        if (activeAdminsCount <= 1) {
          throw new Error("Operation aborted: Cannot demote the last remaining active Administrator.");
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, role: true },
      });

      await logAdminAction({
        tx,
        actorId: session.userId,
        action: "CHANGE_ROLE",
        entityType: "User",
        entityId: userId,
        oldValue: { role: targetUser.role },
        newValue: { role: updated.role },
      });

      return null;
    });

    if (errorMsg) {
      return { success: false, error: errorMsg };
    }

    revalidatePath(`/admin/users`);
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/roles`);

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to change role for user ${userId}:`, error);
    return { success: false, error: error.message || "Database update operation aborted" };
  }
}
