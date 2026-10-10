import type { Request } from "express";
import { prisma } from "../../db/prisma.js";
import { EnterpriseAuthorizationError, resolveEnterprisePermission } from "../../middleware/tenant.js";

/** Reuse the live institutional permission policy for HTTP and internal imports.
 * Derive role and membership from storage, never caller-provided permission flags.
 */
export async function assertStudentCreditAuthorization(collegeId: string, actorId: string, requiresCredits: boolean) {
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (!actor) throw new EnterpriseAuthorizationError("Active institutional access is required.");
  const request = { collegeId, user: { id: actorId, role: actor.role } } as Request;
  const required = requiresCredits ? ["STUDENT_CREATE", "INTERVIEW_CREDIT_ASSIGN"] : ["STUDENT_CREATE"];
  for (const permission of required) {
    const decision = await resolveEnterprisePermission(request, permission);
    if (!decision.allowed) {
      console.warn("Student onboarding permission denied", { permission });
      throw new EnterpriseAuthorizationError(`${permission} permission is required${permission === "INTERVIEW_CREDIT_ASSIGN" ? " to assign positive initial credits" : " to create students"}.`);
    }
  }
}
