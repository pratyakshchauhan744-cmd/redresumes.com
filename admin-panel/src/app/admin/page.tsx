import React from "react";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { getDashboardTelemetry } from "@/lib/dashboard-queries";
import { PageContainer } from "@/components/admin/page-container";
import { KPICards } from "@/components/admin/dashboard/kpi-cards";
import { RevenueSection } from "@/components/admin/dashboard/revenue-section";
import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { ErrorState } from "@/components/admin/states";
import { HardDrive, RefreshCw } from "lucide-react";

// Force this page to always fetch live data on every request (no caching)
export const dynamic = "force-dynamic";
export const revalidate = 0;


export default async function AdminDashboardPage() {
  // 1. Guard route access for staff roles
  let session;
  try {
    session = await ensureAuthorized(["admin", "manager", "support"]);
  } catch (err) {
    // If not authenticated/authorized, layout redirect will catch this, but return empty
    return null;
  }

  // 2. Fetch all telemetry statistics from database
  try {
    const data = await getDashboardTelemetry();

    // Context details to show
    const operatorName = session.email.split("@")[0];

    return (
      <PageContainer
        title="Administrative Operations Console"
        description={`Hello, ${operatorName}. Current system telemetry is fully synced and verified.`}
        action={
          <div className="flex items-center gap-3">
            {/* Live Environment Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-mono font-bold uppercase tracking-wider">
              <HardDrive className="w-3.5 h-3.5 text-rose-400" />
              Production Sync
            </div>
          </div>
        }
      >
        <div className="space-y-8 pb-10">
          {/* A. Dynamic KPI Cards Grid */}
          <KPICards
            data={{
              totalUsers: data.users.total,
              active30d: data.users.active30d,
              totalPurchasesCount: data.financials.totalPurchasesCount,
              totalCreditsBought: data.financials.totalCreditsBought,
            }}
          />

          {/* B. Financial Metrics Summary & Checkout Ledger */}
          {/* Note: Support staff are restricted from seeing full purchases in detail. We hide this component if Support role */}
          {session.role !== "support" ? (
            <RevenueSection
              financials={{
                totalPurchasesCount: data.financials.totalPurchasesCount,
                totalRevenue: data.financials.totalRevenue,
                totalCreditsBought: data.financials.totalCreditsBought,
              }}
              recentPurchases={data.recentPurchases}
            />
          ) : (
            <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/10 flex items-center justify-between text-zinc-400 text-xs">
              <span>Financial telemetry is hidden for Support access level.</span>
              <span className="font-mono text-[10px] text-zinc-500 uppercase">Restricted Resource</span>
            </div>
          )}

          {/* C. Timelines Feed: Logins, Logouts, and Audit Trails */}
          <div className="grid grid-cols-1 gap-6">
            <ActivityFeed
              logins={data.recentLogins}
              logouts={data.recentLogouts}
              auditLogs={data.recentAuditLogs}
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
            title="Unable to sync administrative telemetry"
            errorMsg={error.message || "The query engine failed to resolve PostgreSQL aggregates."}
          />
        </div>
      </PageContainer>
    );
  }
}
