"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAuthorized } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

const AdjustCreditsSchema = z.object({
  userId: z.string().cuid(),
  amount: z.number().int("Amount must be a whole number"),
  reason: z.string().min(3, "Reason must be at least 3 characters").max(100),
});

/**
 * Manually adjusts user credit balances. Guarded behind Admin role.
 */
export async function adjustUserCredits(rawInput: unknown) {
  // 1. Authenticate & Verify Role (Admin only)
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return { success: false, error: "Access denied: Unauthorized staff level" };
  }

  // 2. Validate input schema
  const validated = AdjustCreditsSchema.safeParse(rawInput);
  if (!validated.success) {
    return { success: false, error: validated.error.errors[0].message };
  }

  const { userId, amount, reason } = validated.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find current user credit
      const userCredit = await tx.userCredit.findUnique({
        where: { userId },
      });

      const oldBalance = userCredit?.balance ?? 0;
      const newBalance = oldBalance + amount;

      if (newBalance < 0) {
        throw new Error(`Cannot subtract ${Math.abs(amount)} credits. Balance would fall below 0.`);
      }

      // Upsert balance record
      const updated = await tx.userCredit.upsert({
        where: { userId },
        update: { balance: newBalance },
        create: { userId, balance: newBalance },
      });

      // Insert item into transaction history
      await tx.creditTransaction.create({
        data: {
          userId,
          packageName: `Manual Adjustment: ${reason}`,
          creditsAdded: amount,
          paymentAmount: 0.0,
          razorpayPaymentId: `MANUAL-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          status: "completed",
        },
      });

      // Log administrative audit trail
      await logAdminAction({
        tx,
        actorId: session.userId,
        action: "ADJUST_CREDITS",
        entityType: "UserCredit",
        entityId: updated.id,
        oldValue: { balance: oldBalance },
        newValue: { balance: newBalance, reason },
      });

      return { newBalance };
    });

    // Revalidate details path
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/users`);

    return { success: true, balance: result.newBalance };
  } catch (error: any) {
    console.error(`Failed to adjust credits for user ${userId}:`, error);
    return { success: false, error: error.message || "Prisma transaction failed" };
  }
}
