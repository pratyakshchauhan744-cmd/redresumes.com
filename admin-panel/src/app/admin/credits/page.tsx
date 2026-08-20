import React from "react";
import Link from "next/link";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getUserCreditBalances } from "@/lib/purchase-queries";
import { PageContainer } from "@/components/admin/page-container";
import { CreditsFilterBar } from "@/components/admin/credits/filter-bar";
import { ErrorState } from "@/components/admin/states";
import {
  Coins,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield,
  Calendar,
} from "lucide-react";

interface CreditsPageProps {
  searchParams: Promise<{
    query?: string;
    page?: string;
  }>;
}

export default async function AdminCreditsPage({ searchParams }: CreditsPageProps) {
  // 1. Guard route permissions (Managers and Admins can view credits; Support cannot)
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager"]);
  } catch (error) {
    return null;
  }

  // 2. Resolve parameters
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = 15;

  try {
    // 3. Query DB Credit balances
    const { users, total, pages } = await getUserCreditBalances({
      query,
      page,
      limit,
    });

    const getPageUrl = (targetPage: number) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      params.set("page", targetPage.toString());
      return `/admin/credits?${params.toString()}`;
    };

    return (
      <PageContainer
        title="User Credits Ledger"
        description="Audit candidate credit allocations, current balances, and last update events."
        action={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-mono">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            Clearance: {session.role}
          </div>
        }
      >
        <div className="space-y-6 pb-12">
          {/* Filtering Controls */}
          <CreditsFilterBar />

          {/* Table Ledger Grid */}
          {users.length > 0 ? (
            <div className="space-y-4">
              <div className="glass-panel rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden select-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        <th className="px-6 py-4">Account User</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">System Role</th>
                        <th className="px-6 py-4">Credit Balance</th>
                        <th className="px-6 py-4">Last Ledger Sync</th>
                        <th className="px-6 py-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
                      {users.map((user) => {
                        const balance = user.credits?.balance ?? 0;
                        const updatedAt = user.credits?.updatedAt;

                        return (
                          <tr key={user.id} className="hover:bg-zinc-900/10 transition-colors">
                            {/* Profile details */}
                            <td className="px-6 py-4 font-semibold text-zinc-200">
                              <Link href={`/admin/users/${user.id}`} className="hover:text-rose-455 transition-colors">
                                {user.name}
                              </Link>
                            </td>

                            {/* Email */}
                            <td className="px-6 py-4 font-mono text-zinc-400 truncate max-w-[180px]">
                              {user.email}
                            </td>

                            {/* System Role */}
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-semibold capitalize bg-zinc-900 border border-zinc-850 text-zinc-400">
                                {user.role}
                              </span>
                            </td>

                            {/* Balance */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5 font-mono font-extrabold text-zinc-150">
                                <Coins className={`w-3.5 h-3.5 shrink-0 ${balance > 0 ? "text-amber-400" : "text-zinc-550"}`} />
                                {balance} credits
                              </div>
                            </td>

                            {/* Last Updated */}
                            <td className="px-6 py-4 font-mono text-zinc-500">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-zinc-650" />
                                {updatedAt
                                  ? new Date(updatedAt).toLocaleDateString("en-IN", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Never"}
                              </div>
                            </td>

                            {/* Workspace Link */}
                            <td className="px-6 py-4 text-right">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Details
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

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
              <span className="text-zinc-600 text-lg mb-4">🪙</span>
              <h3 className="text-zinc-200 text-base font-semibold mb-1">No user credit profiles match query</h3>
              <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">Adjust your text search queries.</p>
              <Link
                href="/admin/credits"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-sm font-medium transition-all"
              >
                Reset Search Filters
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
            title="Unable to query credit registers"
            errorMsg={error.message || "Failed to retrieve user credit ledger aggregates."}
          />
        </div>
      </PageContainer>
    );
  }
}
