import React from "react";
import Link from "next/link";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getCreditTransactions } from "@/lib/purchase-queries";
import { PageContainer } from "@/components/admin/page-container";
import { PurchasesFilterBar } from "@/components/admin/purchases/filter-bar";
import { PurchasesTable } from "@/components/admin/purchases/purchases-table";
import { ErrorState } from "@/components/admin/states";
import {
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Coins,
  Shield,
  IndianRupee,
} from "lucide-react";

interface PurchasesPageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function AdminPurchasesPage({ searchParams }: PurchasesPageProps) {
  // 1. Guard route permissions (Managers and Admins can view finances; Support cannot)
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager"]);
  } catch (error) {
    return null;
  }

  // 2. Resolve search parameters
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const status = resolvedParams.status || "all";
  const startDate = resolvedParams.startDate || "";
  const endDate = resolvedParams.endDate || "";
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = 15;

  try {
    // 3. Query DB Transactions
    const { transactions, total, pages } = await getCreditTransactions({
      query,
      status,
      startDate,
      endDate,
      page,
      limit,
    });

    // Compute gross page metrics
    const totalSalesVolume = transactions
      .filter((t) => t.status === "succeeded" || t.status === "completed")
      .reduce((sum, t) => sum + t.paymentAmount, 0);

    const totalCreditsCount = transactions
      .filter((t) => t.status === "succeeded" || t.status === "completed")
      .reduce((sum, t) => sum + t.creditsAdded, 0);

    const getPageUrl = (targetPage: number) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (status !== "all") params.set("status", status);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", targetPage.toString());
      return `/admin/purchases?${params.toString()}`;
    };

    return (
      <PageContainer
        title="Monetization Transactions Ledger"
        description="Audit credit card transactions, packages checkout logs, and Razorpay reconciliations."
        action={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-mono">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            Operator: {session.role}
          </div>
        }
      >
        <div className="space-y-6 pb-12">
          {/* Quick Metrics Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
            <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                  Gross Revenue (Page)
                </span>
                <span className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-0.5">
                  <IndianRupee className="w-4 h-4 text-emerald-400 shrink-0" />
                  {totalSalesVolume.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                  Credits Allocated (Page)
                </span>
                <span className="text-xl font-bold tracking-tight text-white font-mono">
                  {totalCreditsCount.toLocaleString()} credits
                </span>
              </div>
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 shrink-0">
                <Coins className="w-4 h-4" />
              </div>
            </div>

            <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                  Records Count
                </span>
                <span className="text-xl font-bold tracking-tight text-white font-mono">
                  {total.toLocaleString()} transactions
                </span>
              </div>
              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filtering Controls */}
          <PurchasesFilterBar />

          {/* Ledger Table */}
          {transactions.length > 0 ? (
            <div className="space-y-4">
              <PurchasesTable transactions={transactions} />

              {/* Table pagination controller footer */}
              {pages > 1 && (
                <div className="px-6 py-4 border border-zinc-800/80 rounded-xl bg-zinc-950/20 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <span>
                    Page {page} of {pages} ({total} records found)
                  </span>
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link
                        href={getPageUrl(page - 1)}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Link>
                    ) : (
                      <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg text-zinc-700 cursor-not-allowed">
                        <ChevronLeft className="w-4 h-4" />
                      </div>
                    )}

                    {page < pages ? (
                      <Link
                        href={getPageUrl(page + 1)}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <div className="p-1.5 bg-zinc-950 border border-zinc-900 rounded-lg text-zinc-700 cursor-not-allowed">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-8 border border-zinc-800/40 rounded-xl bg-zinc-900/20 text-center select-none">
              <span className="text-zinc-600 text-lg mb-4">💳</span>
              <h3 className="text-zinc-200 text-base font-semibold mb-1">No transaction records match query</h3>
              <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">Adjust your status select or date pickers.</p>
              <Link
                href="/admin/purchases"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-sm font-medium transition-all"
              >
                Reset Filter Settings
              </Link>
            </div>
          )}
        </div>
      </PageContainer>
    );
  } catch (error: any) {
    return (
      <PageContainer title="Database Connection Issue">
        <div className="flex items-center justify-center min-h-[50vh]">
          <ErrorState
            title="Unable to query purchases database"
            errorMsg={error.message || "Failed to retrieve credit transaction aggregates."}
          />
        </div>
      </PageContainer>
    );
  }
}
