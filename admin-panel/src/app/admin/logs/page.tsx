import React from "react";
import Link from "next/link";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getSignInLogs, getSignOutLogs } from "@/lib/log-queries";
import { PageContainer } from "@/components/admin/page-container";
import { LogsFilterBar } from "@/components/admin/logs/filter-bar";
import { ErrorState, EmptyState } from "@/components/admin/states";
import {
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Network,
  Calendar,
} from "lucide-react";

interface LogsPageProps {
  searchParams: Promise<{
    tab?: string; // "logins" | "logouts"
    query?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function AdminLogsPage({ searchParams }: LogsPageProps) {
  // 1. Guard route permissions (Support, Manager, and Admin can view logs)
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager", "support"]);
  } catch (error) {
    return null;
  }

  // 2. Resolve search criteria
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab === "logouts" ? "logouts" : "logins";
  const query = resolvedParams.query || "";
  const startDate = resolvedParams.startDate || "";
  const endDate = resolvedParams.endDate || "";
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = 20;

  try {
    // 3. Fetch specific log items depending on selected tab
    const { events, total, pages } =
      activeTab === "logins"
        ? await getSignInLogs({ query, startDate, endDate, page, limit })
        : await getSignOutLogs({ query, startDate, endDate, page, limit });

    // URL generator helper
    const getPageUrl = (targetPage: number) => {
      const params = new URLSearchParams();
      params.set("tab", activeTab);
      if (query) params.set("query", query);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", targetPage.toString());
      return `/admin/logs?${params.toString()}`;
    };

    // Tab URL generator helper
    const getTabUrl = (targetTab: "logins" | "logouts") => {
      const params = new URLSearchParams();
      params.set("tab", targetTab);
      if (query) params.set("query", query);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", "1");
      return `/admin/logs?${params.toString()}`;
    };

    // Browser User-Agent parser helper (basic clean string extraction)
    const parseUserAgent = (uaString: string | null) => {
      if (!uaString) return "Unknown Device";
      if (uaString.includes("Firefox")) return "Firefox Browser";
      if (uaString.includes("Chrome") && !uaString.includes("Chromium")) return "Chrome Browser";
      if (uaString.includes("Safari") && !uaString.includes("Chrome")) return "Apple Safari";
      if (uaString.includes("Edge")) return "Microsoft Edge";
      if (uaString.includes("Postman")) return "Postman Client";
      return uaString.substring(0, 24) + "...";
    };

    return (
      <PageContainer
        title="Session Activity Ledger"
        description="Audit user authorization entry points, session sign-outs, and network locations."
      >
        <div className="space-y-6 pb-12">
          {/* Navigation Tab Anchors */}
          <div className="flex border-b border-zinc-800/60 pb-px shrink-0 select-none">
            <Link
              href={getTabUrl("logins")}
              className={`px-6 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "logins"
                  ? "border-rose-500 text-rose-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign-in Activity
            </Link>
            <Link
              href={getTabUrl("logouts")}
              className={`px-6 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "logouts"
                  ? "border-rose-500 text-rose-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign-out Activity
            </Link>
          </div>

          {/* Filtering Controls */}
          <LogsFilterBar />

          {/* Records Table */}
          {events.length > 0 ? (
            <div className="glass-panel rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden select-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      <th className="px-6 py-4">Operator Account</th>
                      <th className="px-6 py-4">Action</th>
                      {activeTab === "logins" && <th className="px-6 py-4">Auth Method</th>}
                      <th className="px-6 py-4">IP Location</th>
                      <th className="px-6 py-4">Device / Client</th>
                      <th className="px-6 py-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
                    {events.map((event: any) => (
                      <tr
                        key={event.id}
                        className="hover:bg-zinc-900/10 transition-colors"
                      >
                        {/* User linked profile card */}
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/users/${event.user.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-7 h-7 rounded-full bg-zinc-850 border border-zinc-850 flex items-center justify-center text-[9px] font-bold text-zinc-400 uppercase group-hover:text-rose-400 group-hover:border-rose-500/20 transition-all shrink-0">
                              {event.user.name.substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-250 block truncate group-hover:text-rose-400 transition-colors">
                                {event.user.name}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-500 block truncate">
                                {event.user.email}
                              </span>
                            </div>
                          </Link>
                        </td>

                        {/* Action details */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              activeTab === "logins"
                                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                                : "bg-zinc-800/30 text-zinc-400 border-zinc-700/30"
                            }`}
                          >
                            {activeTab === "logins" ? (
                              <>
                                <LogIn className="w-3 h-3" />
                                Login Event
                              </>
                            ) : (
                              <>
                                <LogOut className="w-3 h-3" />
                                Logout Event
                              </>
                            )}
                          </span>
                        </td>

                        {/* Auth method for logins */}
                        {activeTab === "logins" && (
                          <td className="px-6 py-4 font-mono text-[10px] uppercase text-zinc-400">
                            {event.method}
                          </td>
                        )}

                        {/* IP address column */}
                        <td className="px-6 py-4 font-mono text-zinc-450">
                          <div className="flex items-center gap-1.5">
                            <Network className="w-3.5 h-3.5 text-zinc-500" />
                            {event.ipAddress || "127.0.0.1 (Local)"}
                          </div>
                        </td>

                        {/* User Agent / Client */}
                        <td className="px-6 py-4 text-zinc-400">
                          <div className="flex items-center gap-1.5" title={event.userAgent || "Unknown UA"}>
                            <Monitor className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate max-w-[150px]">
                              {parseUserAgent(event.userAgent)}
                            </span>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="px-6 py-4 font-mono text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-650" />
                            {new Date(event.createdAt).toLocaleString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table pagination controller footer */}
              {pages > 1 && (
                <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/20 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
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
              <span className="text-zinc-600 text-lg mb-4">🔍</span>
              <h3 className="text-zinc-200 text-base font-semibold mb-1">No activity events resolved</h3>
              <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">Adjust your date pickers or user query string.</p>
              <Link
                href="/admin/logs"
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
      <PageContainer title="Database Sync Issue">
        <div className="flex items-center justify-center min-h-[50vh]">
          <ErrorState
            title="Unable to query session activities"
            errorMsg={error.message || "PostgreSQL lookup timed out."}
          />
        </div>
      </PageContainer>
    );
  }
}
