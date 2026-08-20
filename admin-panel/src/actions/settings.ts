"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAuthorized } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

const SettingSchema = z.object({
  key: z.string().min(2).max(50),
  value: z.string().min(1).max(255),
});

/**
 * Update a dynamic system setting variable in the database. Admin only.
 */
export async function updateSystemSetting(rawInput: unknown) {
  // 1. Guard route clearance (Admin only)
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Unauthorized staff level" };
  }

  // 2. Validate input schema
  const validated = SettingSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0].message };
  }

  const { key, value } = validated.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find current setting state
      const currentSetting = await tx.systemSetting.findUnique({
        where: { key },
      });

      const oldValue = currentSetting?.value ?? null;

      // Upsert value
      const updated = await tx.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value, description: "Dynamic System Configuration" },
      });

      // Write administrative audit trail
      await logAdminAction({
        tx,
        actorId: session.userId,
        action: "UPDATE_SETTING",
        entityType: "SystemSetting",
        entityId: key,
        oldValue: { value: oldValue },
        newValue: { value },
      });

      return updated;
    });

    revalidatePath("/admin/settings");
    return { success: true, key: result.key, value: result.value };
  } catch (error: any) {
    console.error(`Failed to update setting ${key}:`, error);
    return { success: false, error: error.message || "Database update operation aborted" };
  }
}
