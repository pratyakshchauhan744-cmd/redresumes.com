import React from "react";
import Link from "next/link";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getUserDetails } from "@/lib/user-queries";
import { PageContainer } from "@/components/admin/page-container";
import { UserActionsPanel } from "@/components/admin/users/user-actions-panel";
import { ErrorState, EmptyState } from "@/components/admin/states";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Hash,
  Coins,
  MapPin,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Receipt,
  User,
} from "lucide-react";

interface UserDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminUserDetailPage({ params }: UserDetailPageProps) {
  // 1. Guard route permissions for staff
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager", "support"]);
  } catch (error) {
    return null;
  }

  // 2. Resolve parameters & DB records
  const resolvedParams = await params;
  const userId = resolvedParams.id;

  try {
    const user = await getUserDetails(userId);

    if (!user) {
      return (
        <PageContainer title="User Directory Account Lookup">
          <div className="flex items-center justify-center min-h-[50vh]">
            <EmptyState
              title="User Account Not Resolved"
              description={`We were unable to locate any account matching ID: ${userId}`}
              actionLabel="Return to User Directory"
            />
          </div>
        </PageContainer>
      );
    }

    const currentBalance = user.credits?.balance ?? 0;

    return (
      <PageContainer
        title="User Workspace Profile"
        description="View candidate/employer telemetry, transactions ledger, and staff actions."
        action={
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Directory
          </Link>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-16">
          {/* Main User Profile & Timeline Panels (Left Side - 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Account Metadata & Summary Card */}
            <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 uppercase">
                    {user.name.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      {user.name}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono capitalize bg-zinc-900 border border-zinc-850 text-zinc-400">
                        {user.role}
                      </span>
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono block">UID: {user.id}</span>
                  </div>
                </div>
                
                {/* Active Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border self-start sm:self-auto ${
                    user.isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-current ${user.isActive ? "animate-pulse" : ""}`} />
                  {user.isActive ? "Active Account" : "Suspended"}
                </span>
              </div>

              {/* Grid Metadata details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-800/40 pt-4 text-xs">
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>{user.phone || "No phone linked"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>{user.location || "No location set"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Registered: {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* 2. Resumes List Card */}
            <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                Created Resumes ({user.resumes.length})
              </h4>
              <div className="divide-y divide-zinc-800/40">
                {user.resumes.map((resume) => (
                  <div key={resume.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 block truncate">
                        {resume.fileName}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono block">ID: {resume.id}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(resume.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {user.resumes.length === 0 && (
                  <p className="text-xs text-zinc-500 py-2">No resumes built on this account yet.</p>
                )}
              </div>
            </div>

            {/* 3. Credits & Transactions History */}
            <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                Recent Payments & Purchases
              </h4>
              <div className="divide-y divide-zinc-800/40">
                {user.transactions.map((tx) => (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200 block">{tx.packageName}</span>
                      <span className="text-[10px] font-mono text-zinc-500 block">{tx.razorpayPaymentId}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-200 block font-mono">+{tx.creditsAdded} cr</span>
                      <span className="text-[10px] text-emerald-400 font-bold font-mono">
                        {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(tx.paymentAmount)}
                      </span>
                    </div>
                  </div>
                ))}
                {user.transactions.length === 0 && (
                  <p className="text-xs text-zinc-500 py-2">No transaction histories recorded.</p>
                )}
              </div>
            </div>

            {/* 4. Login / Logout Timeline Logs */}
            <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Authentication Activity Logs
              </h4>
              <div className="space-y-3.5">
                {[
                  ...user.signInEvents.map((e) => ({ ...e, type: "login" as const })),
                  ...user.signOutEvents.map((e) => ({ ...e, type: "logout" as const })),
                ]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-900/60 text-xs">
                      <div className="flex items-center gap-2.5">
                        {event.type === "login" ? (
                          <LogIn className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold text-zinc-300 capitalize">
                            {event.type === "login" ? "Signed In" : "Signed Out"}
                          </span>
                          {event.type === "login" && (
                            <span className="text-[10px] text-zinc-500 font-mono pl-1">
                              via {(event as any).method}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                {user.signInEvents.length === 0 && user.signOutEvents.length === 0 && (
                  <p className="text-xs text-zinc-500 py-2">No active sessions logs recorded.</p>
                )}
              </div>
            </div>
          </div>

          {/* Side Panel (Right Side - 1 Column) */}
          <div className="space-y-6">
            {/* Credits Summary Box */}
            <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 bg-rose-950/5 relative overflow-hidden flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                  Credit Balance
                </span>
                <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                  {currentBalance}
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 border border-amber-500/20">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Admin Action panel (Suspension, promotion, credit grants) */}
            <UserActionsPanel
              userId={user.id}
              isActive={user.isActive}
              userRole={user.role}
              currentCredits={currentBalance}
              operatorRole={session.role}
            />
          </div>
        </div>
      </PageContainer>
    );
  } catch (error: any) {
    return (
      <PageContainer title="Database Connection Issue">
        <div className="flex items-center justify-center min-h-[50vh]">
          <ErrorState
            title="Unable to load user workspace"
            errorMsg={error.message || "Prisma lookup failed."}
          />
        </div>
      </PageContainer>
    );
  }
}
