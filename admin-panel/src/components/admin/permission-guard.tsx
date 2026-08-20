import React from "react";
import { UserRole } from "@prisma/client";
import { hasRequiredRole } from "@/lib/auth";

interface PermissionGuardProps {
  userRole: UserRole;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable layout wrapper to hide/show UI elements dynamically based on user role.
 * Safe for use in both server and client contexts.
 */
export function PermissionGuard({
  userRole,
  allowedRoles,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const isAuthorized = hasRequiredRole(userRole, allowedRoles);

  if (!isAuthorized) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
