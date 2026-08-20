import React from "react";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/admin/page-container";
import { SettingsPanel } from "@/components/admin/settings/settings-panel";
import { ErrorState } from "@/components/admin/states";
import { ShieldCheck } from "lucide-react";

export default async function AdminSettingsPage() {
  // 1. Guard route access (Admin only)
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return null;
  }

  try {
    // 2. Fetch all system settings from database
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    return (
      <PageContainer
        title="Global Configuration Engine"
        description="Modify dynamic system thresholds, toggle checkout gateways, or initiate global maintenance modes."
        action={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-lg text-xs font-mono font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            Config Clearance Granted
          </div>
        }
      >
        <div className="space-y-6 pb-12">
          {/* Settings Component Panel */}
          <SettingsPanel initialSettings={settings as any} />
        </div>
      </PageContainer>
    );
  } catch (error: any) {
    return (
      <PageContainer title="Database Connection Issue">
        <div className="flex items-center justify-center min-h-[50vh]">
          <ErrorState
            title="Unable to load configuration registers"
            errorMsg={error.message || "PostgreSQL connection timed out."}
          />
        </div>
      </PageContainer>
    );
  }
}
