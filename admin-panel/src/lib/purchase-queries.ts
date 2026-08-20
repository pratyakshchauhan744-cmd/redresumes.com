import { prisma } from "./prisma";

export interface TransactionFilter {
  query?: string;
  status?: string; // "completed" | "failed" | "all"
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch a paginated, filterable list of credit purchase transactions.
 */
export async function getCreditTransactions(filters: TransactionFilter) {
  const page = filters.page || 1;
  const limit = filters.limit || 15;
  const skip = (page - 1) * limit;

  const where: any = {};

  // 1. Text Search across buyer name/email, packageName, or payment ID
  if (filters.query) {
    where.OR = [
      { razorpayPaymentId: { contains: filters.query } },
      { packageName: { contains: filters.query, mode: "insensitive" } },
      {
        user: {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" } },
            { email: { contains: filters.query, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  // 2. Filter by payment status
  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }

  // 3. Date range filters
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
    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        skip,
        take: limit,
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
      prisma.creditTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Prisma error in getCreditTransactions:", error);
    throw new Error("Failed to load purchase records");
  }
}

/**
 * Fetch detailed metrics for a single payment transaction.
 */
export async function getTransactionDetails(transactionId: string) {
  try {
    return await prisma.creditTransaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });
  } catch (error) {
    console.error(`Prisma error in getTransactionDetails for ${transactionId}:`, error);
    throw new Error("Failed to retrieve transaction details");
  }
}

/**
 * Fetch users sorted by credit balance.
 */
export async function getUserCreditBalances(filters: { query?: string; page?: number; limit?: number }) {
  const page = filters.page || 1;
  const limit = filters.limit || 15;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { email: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          credits: {
            balance: "desc",
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          credits: {
            select: {
              balance: true,
              updatedAt: true,
            },
          },
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
    console.error("Prisma error in getUserCreditBalances:", error);
    throw new Error("Failed to load user credit balances");
  }
}
