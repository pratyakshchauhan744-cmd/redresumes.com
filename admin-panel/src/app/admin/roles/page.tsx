import React from "react";
import { getSession, ensureAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/admin/page-container";
import { StaffTable } from "@/components/admin/roles/staff-table";
import { ErrorState } from "@/components/admin/states";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default async function AdminRolesPage() {
  // 1. Guard route (Admin-only for role adjustments)
  let session;
  try {
    session = await ensureAuthorized(["admin"]);
  } catch (error) {
    return null;
  }

  try {
    // 2. Fetch all staff members from database
    const staff = await prisma.user.findMany({
      where: {
        role: {
          in: ["admin", "manager", "support"],
        },
      },
      orderBy: {
        role: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return (
      <PageContainer
        title="Staff Role Permissions Deck"
        description="Grant or demote internal staff clearances and monitor active administrative credentials."
        action={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-lg text-xs font-mono font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            Super-Admin Active
          </div>
        }
      >
        <div className="space-y-6 pb-12">
          {/* Informative Warning block */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl flex gap-3.5 select-none">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-200 block">Security Policy Guidelines</span>
              <p className="text-[10px] text-zinc-400 leading-relaxed max-w-2xl">
                Staff promotions grant direct access to user dashboards, transaction summaries, and system settings.
                Always verify identity credentials before modifying access roles. Self-privilege changes are disabled
                to prevent locking yourself out of the panel.
              </p>
            </div>
          </div>

          {/* Interactive table */}
          <StaffTable staffList={staff as any} currentOperatorId={session.userId} />
        </div>
      </PageContainer>
    );
  } catch (error: any) {
    return (
      <PageContainer title="Database Connection Issue">
        <div className="flex items-center justify-center min-h-[50vh]">
          <ErrorState
            title="Unable to query staff registry"
            errorMsg={error.message || "PostgreSQL connection could not be established."}
          />
        </div>
      </PageContainer>
    );
  }
}
