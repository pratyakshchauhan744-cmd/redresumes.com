import type { EnterpriseAuditLog } from "../types/enterpriseAudit";

export function formatEntityName(entity: string | null | undefined): string {
  if (!entity) return "—";
  const trimmed = entity.trim();
  if (!trimmed) return "—";

  // Normalize lowercase entities like "faculty" or "student"
  if (trimmed.toLowerCase() === "faculty") return "Faculty";
  if (trimmed.toLowerCase() === "student") return "Student";
  if (trimmed.toLowerCase() === "college") return "College";

  // Normalize "CollegeFaculty" -> "Faculty", "CollegeStudent" -> "Student"
  const stripped = trimmed.replace(/^College/, "");
  // Insert spaces before capital letters: "InterviewCredit" -> "Interview Credit"
  const spaced = stripped.replace(/([A-Z])/g, " $1").trim();
  return spaced || trimmed;
}

export interface TargetUserInfo {
  name?: string | null;
  email?: string | null;
}

export function getTargetUser(log: EnterpriseAuditLog): TargetUserInfo | null {
  const meta = (log.metadata && typeof log.metadata === "object" ? log.metadata : null) as Record<string, any> | null;
  const nw = (log.newValue && typeof log.newValue === "object" ? log.newValue : null) as Record<string, any> | null;
  const old = (log.oldValue && typeof log.oldValue === "object" ? log.oldValue : null) as Record<string, any> | null;

  if (meta?.targetUser && typeof meta.targetUser === "object") {
    const u = meta.targetUser;
    if (u.name || u.email) return { name: u.name ?? null, email: u.email ?? null };
  }
  if (meta?.studentEmail || meta?.studentName) {
    return { name: meta.studentName ?? null, email: meta.studentEmail ?? null };
  }
  if (meta?.facultyEmail || meta?.facultyName) {
    return { name: meta.facultyName ?? null, email: meta.facultyEmail ?? null };
  }
  // Check newValue/oldValue if entity represents a user (Faculty or Student)
  const isUserEntity = log.entity && /faculty|student|user/i.test(log.entity);
  if (isUserEntity) {
    if (nw?.email || nw?.name) {
      return { name: nw.name ?? null, email: nw.email ?? null };
    }
    if (old?.email || old?.name) {
      return { name: old.name ?? null, email: old.email ?? null };
    }
  }
  return null;
}

function formatPrimitiveValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number" || typeof val === "string") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    if (val.every((x) => typeof x === "string" || typeof x === "number" || typeof x === "boolean")) {
      return `[${val.join(", ")}]`;
    }
    return `[${val.length} items]`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val as object);
    if (keys.length === 0) return "{}";
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }
  return String(val);
}

export function formatAuditDetails(log: EnterpriseAuditLog): string {
  const { oldValue, newValue, metadata } = log;

  // Case 1: Both oldValue and newValue are present -> Diff comparison
  if (oldValue !== null && oldValue !== undefined && newValue !== null && newValue !== undefined) {
    if (
      typeof oldValue === "object" &&
      typeof newValue === "object" &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue)
    ) {
      const oldObj = oldValue as Record<string, unknown>;
      const newObj = newValue as Record<string, unknown>;
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      const changes: string[] = [];

      for (const k of allKeys) {
        const vOld = oldObj[k];
        const vNew = newObj[k];
        if (JSON.stringify(vOld) !== JSON.stringify(vNew)) {
          changes.push(`${k}: ${formatPrimitiveValue(vOld)} → ${formatPrimitiveValue(vNew)}`);
        }
      }

      if (changes.length > 0) {
        return changes.join(" | ");
      }
      return "No field changes";
    }

    return `${formatPrimitiveValue(oldValue)} → ${formatPrimitiveValue(newValue)}`;
  }

  // Case 2: Only newValue is present (e.g. Created / Added)
  if (newValue !== null && newValue !== undefined) {
    if (typeof newValue === "object" && !Array.isArray(newValue)) {
      const entries = Object.entries(newValue as Record<string, unknown>)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${formatPrimitiveValue(v)}`);
      if (entries.length > 0) {
        return entries.join(", ");
      }
    }
    return formatPrimitiveValue(newValue);
  }

  // Case 3: Only oldValue is present (e.g. Deleted / Revoked)
  if (oldValue !== null && oldValue !== undefined) {
    if (typeof oldValue === "object" && !Array.isArray(oldValue)) {
      const entries = Object.entries(oldValue as Record<string, unknown>)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${formatPrimitiveValue(v)}`);
      if (entries.length > 0) {
        return `Removed: ${entries.join(", ")}`;
      }
    }
    return `Removed: ${formatPrimitiveValue(oldValue)}`;
  }

  // Case 4: Only metadata is present
  if (metadata !== null && metadata !== undefined) {
    if (typeof metadata === "object" && !Array.isArray(metadata)) {
      const entries = Object.entries(metadata as Record<string, unknown>)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${formatPrimitiveValue(v)}`);
      if (entries.length > 0) {
        return entries.join(", ");
      }
    }
    return formatPrimitiveValue(metadata);
  }

  return "—";
}

export interface PaginationRangeResult {
  start: number;
  end: number;
  total: number;
  text: string;
}

export function calculatePaginationRange(
  page: number,
  limit: number,
  total: number
): PaginationRangeResult {
  const safeTotal = Math.max(0, total || 0);
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 15);

  if (safeTotal === 0) {
    return {
      start: 0,
      end: 0,
      total: 0,
      text: "No audit events",
    };
  }

  const start = (safePage - 1) * safeLimit + 1;
  const end = Math.min(safePage * safeLimit, safeTotal);

  return {
    start,
    end,
    total: safeTotal,
    text: `Showing ${start}–${end} of ${safeTotal} audit events`,
  };
}
