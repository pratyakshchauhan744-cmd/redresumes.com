import { prisma } from "./prisma";
import { UserRole } from "@prisma/client";

export interface UserListFilter {
  query?: string;
  role?: string;
  status?: "active" | "suspended" | "all";
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "name" | "email";
  sortOrder?: "asc" | "desc";
}

/**
 * Fetch a paginated, filtered list of all candidates and employers.
 */
export async function getPaginatedUsers(filters: UserListFilter) {
  const page = filters.page || 1;
  const limit = filters.limit || 15;
  const skip = (page - 1) * limit;
  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";

  // Build prisma query condition
  const where: any = {};

  // 1. Text Search across name, email, or ID
  if (filters.query) {
    where.OR = [
      { id: { contains: filters.query } },
      { name: { contains: filters.query, mode: "insensitive" } },
      { email: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  // 2. Filter by role
  if (filters.role && filters.role !== "all") {
    where.role = filters.role as UserRole;
  }

  // 3. Filter by Active status
  if (filters.status && filters.status !== "all") {
    where.isActive = filters.status === "active";
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          phone: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Prisma error in getPaginatedUsers:", error);
    throw new Error("Failed to load user directory from database");
  }
}

/**
 * Fetch unified details for a single user, including credits, transaction ledgers,
 * session event histories, and created resumes.
 */
export async function getUserDetails(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        phone: true,
        location: true,
        bio: true,
        photoDataUrl: true,
        credits: {
          select: {
            balance: true,
            updatedAt: true,
          },
        },
        transactions: {
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
          },
        },
        signInEvents: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            method: true,
            createdAt: true,
          },
        },
        signOutEvents: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
          },
        },
        resumes: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fileName: true,
            createdAt: true,
          },
        },
      },
    });

    return user;
  } catch (error) {
    console.error(`Prisma error in getUserDetails for ${userId}:`, error);
    throw new Error("Failed to load user credentials from database");
  }
}
