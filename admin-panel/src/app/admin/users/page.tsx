import React from "react";
import Link from "next/link";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getPaginatedUsers } from "@/lib/user-queries";
import { PageContainer } from "@/components/admin/page-container";
import { UsersFilterBar } from "@/components/admin/users/filter-bar";
import { ErrorState, EmptyState } from "@/components/admin/states";
import {
  Eye,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

// Force live DB query on every request — never serve a cached user list
export const dynamic = "force-dynamic";
export const revalidate = 0;


interface UsersPageProps {
  searchParams: Promise<{
    query?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  // 1. Guard route permissions for staff
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager", "support"]);
  } catch (error) {
    return null;
  }

  // 2. Resolve search criteria
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const role = resolvedParams.role || "all";
  const status = (resolvedParams.status as any) || "all";
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = 15;

  try {
    // 3. Query DB
    const { users, total, pages } = await getPaginatedUsers({
      query,
      role,
      status,
      page,
      limit,
    });

    // Pagination helper function
    const getPageUrl = (targetPage: number) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);
      params.set("page", targetPage.toString());
      return `/admin/users?${params.toString()}`;
    };

    return (
      <PageContainer
        title="User Management Directory"
        description="Search, view, and administer candidate and employer accounts."
        action={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-mono">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            Total: {total.toLocaleString()} records
          </div>
        }
      >
        <div className="space-y-6 pb-12">
          {/* URL Search & Dropdown Filter Panel */}
          <UsersFilterBar />

          {/* Table Container */}
          {users.length > 0 ? (
            <div className="glass-panel rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden select-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      <th className="px-6 py-4">Account User</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">System Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Registered Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-xs">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-zinc-900/20 transition-colors"
                      >
                        {/* Name & Avatar ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase shrink-0 border border-zinc-800">
                              {user.name.substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-200 block truncate">
                                {user.name}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-500 block truncate">
                                {user.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-6 py-4 text-zinc-300 font-mono truncate max-w-[200px]">
                          {user.email}
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold capitalize bg-zinc-900 border border-zinc-800 text-zinc-400">
                            {user.role}
                          </span>
                        </td>

                        {/* Status (Active / Suspended) */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              user.isActive
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full bg-current ${
                                user.isActive ? "animate-pulse" : ""
                              }`}
                            />
                            {user.isActive ? "Active" : "Suspended"}
                          </span>
                        </td>

                        {/* Registration Date */}
                        <td className="px-6 py-4 text-zinc-400 font-mono">
                          {new Date(user.createdAt).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        {/* Link to Details */}
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controller footer */}
              {pages > 1 && (
                <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/20 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <span>
                    Page {page} of {pages} ({total} total results)
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
            <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-8 border border-zinc-800/40 rounded-xl bg-zinc-900/20 text-center">
              <span className="text-zinc-600 text-lg mb-4">🔍</span>
              <h3 className="text-zinc-200 text-base font-semibold mb-1">No users match query parameters</h3>
              <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">Adjust your search syntax or select a different role filter.</p>
              <Link
                href="/admin/users"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-sm font-medium transition-all"
              >
                Reset Search Parameters
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
            title="Unable to query database directory"
            errorMsg={error.message || "Failed to resolve PostgreSQL query values."}
          />
        </div>
      </PageContainer>
    );
  }
}
