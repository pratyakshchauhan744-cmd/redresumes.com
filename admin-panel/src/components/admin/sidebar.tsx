"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Coins,
  ShieldCheck,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  userRole: UserRole;
  userEmail: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  allowedRoles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    allowedRoles: ["admin", "manager", "support"],
  },
  {
    name: "User Directory",
    href: "/admin/users",
    icon: Users,
    allowedRoles: ["admin", "manager", "support"],
  },
  {
    name: "Activity Logs",
    href: "/admin/logs",
    icon: FileText,
    allowedRoles: ["admin", "manager", "support"],
  },
  {
    name: "Purchases",
    href: "/admin/purchases",
    icon: CreditCard,
    allowedRoles: ["admin", "manager"],
  },
  {
    name: "Credit Tracker",
    href: "/admin/credits",
    icon: Coins,
    allowedRoles: ["admin", "manager"],
  },
  {
    name: "Staff Permissions",
    href: "/admin/roles",
    icon: ShieldCheck,
    allowedRoles: ["admin"],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    allowedRoles: ["admin"],
  },
];

export function Sidebar({ userRole, userEmail }: SidebarProps) {
  const pathname = usePathname();

  // Filter navigation items by role
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-800/80">
        <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center red-glow">
          <Sparkles className="w-4 h-4 text-white animate-pulse" />
        </div>
        <div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100 block">RedResumes</span>
          <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Admin Engine</span>
        </div>
      </div>

      {/* Navigation Scroll Region */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 smooth-hover ${
                isActive
                  ? "bg-rose-950/30 text-rose-400 border-l-2 border-rose-500 pl-3"
                  : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-rose-400" : "text-zinc-500"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile & Sign Out */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 uppercase">
            {userEmail.substring(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-zinc-300 block truncate">{userEmail}</span>
            <span className="text-[10px] text-zinc-500 capitalize block font-mono">{userRole}</span>
          </div>
        </div>
        
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-rose-950/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-950 rounded-lg text-xs font-semibold text-zinc-400 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Session
          </button>
        </form>
      </div>
    </aside>
  );
}
