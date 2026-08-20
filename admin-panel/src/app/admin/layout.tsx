import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/admin/sidebar";
import { TopNavbar } from "@/components/admin/top-navbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Double-guard authentication and role verification
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const staffRoles = ["admin", "manager", "support"];
  if (!staffRoles.includes(session.role)) {
    redirect("/admin/forbidden");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      {/* Dynamic Role-Based Sidebar */}
      <Sidebar userRole={session.role} userEmail={session.email} />

      {/* Primary Display Shell */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Navbar Header */}
        <TopNavbar userRole={session.role} />

        {/* Single Scroll Container Region */}
        <main className="flex-1 overflow-y-auto bg-zinc-900/40 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
