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

/**
 * Fetches all dashboard statistics in parallel.
 * Implements strict select statements to avoid loading unnecessary sensitive user data.
 */
export async function getDashboardTelemetry(): Promise<DashboardTelemetry> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [
      totalUsers,
      activeUsersGroup,
      purchasesAggregate,
      creditsAggregate,
      recentLogins,
      recentLogouts,
      recentPurchases,
      recentAuditLogs,
    ] = await Promise.all([
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

      // 3. Financial Aggregate (Sum of completed transactions)
      prisma.creditTransaction.aggregate({
        _sum: {
          paymentAmount: true,
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

      // 4. Credits Aggregate (Sum of credits purchased)
      prisma.creditTransaction.aggregate({
        _sum: {
          creditsAdded: true,
        },
        where: {
          status: {
            in: ["succeeded", "completed"],
          },
        },
      }),

      // 5. Recent logins
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

      // 6. Recent logouts
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

      // 7. Recent purchases
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

      // 8. Recent Audit Logs
      prisma.adminAuditLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
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

    return {
      users: {
        total: totalUsers,
        active30d: activeUsersGroup.length,
      },
      financials: {
        totalPurchasesCount: purchasesAggregate._count.id || 0,
        totalRevenue: purchasesAggregate._sum.paymentAmount || 0,
        totalCreditsBought: creditsAggregate._sum.creditsAdded || 0,
      },
      recentLogins: recentLogins as any,
      recentLogouts: recentLogouts as any,
      recentPurchases: recentPurchases as any,
      recentAuditLogs: recentAuditLogs as any,
    };
  } catch (error) {
    console.error("Dashboard queries database failure:", error);
    throw new Error("Failed to load dashboard metrics");
  }
}
