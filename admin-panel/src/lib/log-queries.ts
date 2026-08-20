import { prisma } from "./prisma";

export interface LogFilter {
  query?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch paginated, filterable sign-in events.
 */
export async function getSignInLogs(filters: LogFilter) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  // 1. Text Search across user email/name
  if (filters.query) {
    where.user = {
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { email: { contains: filters.query, mode: "insensitive" } },
      ],
    };
  }

  // 2. Date Filtering
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      // Set to end of day
      const endOfDay = new Date(filters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt.lte = endOfDay;
    }
  }

  try {
    const [events, total] = await Promise.all([
      prisma.signInEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          method: true,
          ipAddress: true,
          userAgent: true,
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
      prisma.signInEvent.count({ where }),
    ]);

    return {
      events,
      total,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Prisma error in getSignInLogs:", error);
    throw new Error("Failed to load sign-in activity logs");
  }
}

/**
 * Fetch paginated, filterable sign-out events.
 */
export async function getSignOutLogs(filters: LogFilter) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  // 1. Text Search across user email/name
  if (filters.query) {
    where.user = {
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { email: { contains: filters.query, mode: "insensitive" } },
      ],
    };
  }

  // 2. Date Filtering
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endOfDay = new Date(filters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt.lte = endOfDay;
    }
  }

  try {
    const [events, total] = await Promise.all([
      prisma.signOutEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
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
      prisma.signOutEvent.count({ where }),
    ]);

    return {
      events,
      total,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Prisma error in getSignOutLogs:", error);
    throw new Error("Failed to load sign-out activity logs");
  }
}
