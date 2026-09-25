import { prisma } from "./prisma";

export interface DashboardTelemetry {
  users: {
    total: number;
    active30d: number;
  };
  financials: {
    totalPurchasesCount: number;
    totalRevenue: number;
    totalCreditsBought: number;
  };
  recentLogins: Array<{
    id: string;
    createdAt: Date;
    method: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  recentLogouts: Array<{
    id: string;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  recentPurchases: Array<{
    id: string;
    packageName: string;
    creditsAdded: number;
    paymentAmount: number;
    razorpayPaymentId: string;
    status: string;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    details?: any;
    entityType: string;
    entityId: string | null;
    createdAt: Date;
    actor: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

// In-memory cache for dashboard telemetry with a 30-second TTL to avoid proxy bottleneck
let cachedTelemetry: { data: DashboardTelemetry; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000;

export function invalidateTelemetryCache() {
  cachedTelemetry = null;
}

/**
 * Fetches all dashboard statistics in parallel with resilient handling and caching.
 * Implements strict select statements to avoid loading unnecessary sensitive user data.
 */
export async function getDashboardTelemetry(forceFresh = false): Promise<DashboardTelemetry> {
  const now = Date.now();
  if (!forceFresh && cachedTelemetry && now - cachedTelemetry.timestamp < CACHE_TTL_MS) {
    return cachedTelemetry.data;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [
      totalUsersResult,
      activeUsersResult,
      financialsResult,
      recentLoginsResult,
      recentLogoutsResult,
      recentPurchasesResult,
      recentAuditLogsResult,
    ] = await Promise.allSettled([
      // 1. Total User Count
      prisma.user.count(),

      // 2. Active User Count (distinct users with sign-in activity in past 30 days)
      prisma.signInEvent.groupBy({
        by: ["userId"],
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),

      // 3. Combined Financial & Credits Aggregate (single query)
      prisma.creditTransaction.aggregate({
        _sum: {
          paymentAmount: true,
          creditsAdded: true,
        },
        _count: {
          id: true,
        },
        where: {
          status: {
            in: ["succeeded", "completed"],
          },
        },
      }),

      // 4. Recent logins
      prisma.signInEvent.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          method: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),

      // 5. Recent logouts
      prisma.signOutEvent.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),

      // 6. Recent purchases
      prisma.creditTransaction.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          packageName: true,
          creditsAdded: true,
          paymentAmount: true,
          razorpayPaymentId: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      // 7. Recent Audit Logs (querying both targetType and entityType safely)
      prisma.adminAuditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          details: true,
          createdAt: true,
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalUsers = totalUsersResult.status === "fulfilled" ? totalUsersResult.value : 0;
    const activeUsersGroup = activeUsersResult.status === "fulfilled" ? activeUsersResult.value : [];
    const financials = financialsResult.status === "fulfilled" 
      ? financialsResult.value 
      : { _count: { id: 0 }, _sum: { paymentAmount: 0, creditsAdded: 0 } };

    const recentLogins = recentLoginsResult.status === "fulfilled" ? recentLoginsResult.value : [];
    const recentLogouts = recentLogoutsResult.status === "fulfilled" ? recentLogoutsResult.value : [];
    const recentPurchases = recentPurchasesResult.status === "fulfilled" ? recentPurchasesResult.value : [];
    const rawAuditLogs = recentAuditLogsResult.status === "fulfilled" ? recentAuditLogsResult.value : [];

    const recentAuditLogs = rawAuditLogs.map((log: any) => ({
      ...log,
      entityType: log.entityType || log.targetType || "General",
      entityId: log.entityId || log.targetId || null,
      targetType: log.targetType || log.entityType || "General",
      targetId: log.targetId || log.entityId || null,
    }));

    const data: DashboardTelemetry = {
      users: {
        total: totalUsers,
        active30d: activeUsersGroup.length,
      },
      financials: {
        totalPurchasesCount: financials._count.id || 0,
        totalRevenue: financials._sum.paymentAmount || 0,
        totalCreditsBought: financials._sum.creditsAdded || 0,
      },
      recentLogins: recentLogins as any,
      recentLogouts: recentLogouts as any,
      recentPurchases: recentPurchases as any,
      recentAuditLogs: recentAuditLogs as any,
    };

    cachedTelemetry = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    console.error("Dashboard queries database failure:", error);
    if (cachedTelemetry) {
      return cachedTelemetry.data;
    }
    throw new Error("Failed to load dashboard metrics");
  }
}
