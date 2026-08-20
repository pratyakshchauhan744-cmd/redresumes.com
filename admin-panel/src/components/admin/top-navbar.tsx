"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { Bell, Search, Shield, HardDrive, Wifi } from "lucide-react";

interface TopNavbarProps {
  userRole: UserRole;
}

export function TopNavbar({ userRole }: TopNavbarProps) {
  const pathname = usePathname();

  // Generate dynamic path breadcrumbs
  const getPageTitle = () => {
    if (pathname === "/admin") return "Overview Operations";
    const segment = pathname.split("/").pop();
    if (!segment) return "Operations Dashboard";
    
    // Capitalize and format
    return segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Assign badge styling based on staff level
  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "manager":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "support":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700/50";
    }
  };

  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between px-8 select-none">
      {/* Dynamic Title / Breadcrumb context */}
      <div className="flex items-center gap-2.5">
        <Shield className="w-4 h-4 text-zinc-500" />
        <span className="text-zinc-600 text-xs">/</span>
        <h1 className="text-sm font-semibold tracking-tight text-zinc-200">{getPageTitle()}</h1>
      </div>

      {/* Right Navbar Controls */}
      <div className="flex items-center gap-6">
        {/* Dynamic DB Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-mono text-emerald-400/90 font-bold uppercase tracking-wider">
            DB Live
          </span>
        </div>

        {/* Dynamic Staff Authorization Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 border rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${getRoleBadgeStyle(
            userRole
          )}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {userRole} Access
        </div>

        {/* Global Notifications Icon */}
        <button className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-900/60 transition-all cursor-pointer">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
