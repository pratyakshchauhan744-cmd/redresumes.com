"use client";

import React, { useState } from "react";
import { LogIn, LogOut, FileClock, Shield, Clock, Terminal } from "lucide-react";

interface ActivityFeedProps {
  logins: Array<{
    id: string;
    createdAt: Date;
    method: string;
    user: { name: string; email: string; role: string };
  }>;
  logouts: Array<{
    id: string;
    createdAt: Date;
    user: { name: string; email: string; role: string };
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: Date;
    actor: { name: string; email: string };
  }>;
}

export function ActivityFeed({ logins, logouts, auditLogs }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<"sessions" | "audit">("sessions");

  // Format date helper
  const formatTimeAgo = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="glass-panel border border-zinc-800/80 rounded-xl shadow-sm flex flex-col h-[400px]">
      {/* Header Tabs Navigation */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-800/60 bg-zinc-950/20 py-3 shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("sessions")}
            className={`text-xs font-semibold uppercase tracking-wider pb-1 transition-all border-b-2 cursor-pointer ${
              activeTab === "sessions"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Session Logs
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`text-xs font-semibold uppercase tracking-wider pb-1 transition-all border-b-2 cursor-pointer ${
              activeTab === "audit"
                ? "border-rose-500 text-rose-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Audit Log Feed
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          Realtime
        </div>
      </div>

      {/* Feed list scroll region */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeTab === "sessions" ? (
          <div className="space-y-3.5">
            {/* Merged Logins and Logouts timeline */}
            {[
              ...logins.map((l) => ({ ...l, type: "login" as const })),
              ...logouts.map((l) => ({ ...l, type: "logout" as const })),
            ]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 8)
              .map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-900/60 hover:border-zinc-800/60 transition-all smooth-hover"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        event.type === "login"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                      }`}
                    >
                      {event.type === "login" ? (
                        <LogIn className="w-3.5 h-3.5" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 block truncate">
                        {event.user.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate block">
                        {event.user.email} •{" "}
                        <span className="text-[9px] font-mono capitalize px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded">
                          {event.user.role}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-500 font-mono block">
                      {formatTimeAgo(event.createdAt)}
                    </span>
                    <span className="text-[9px] text-zinc-600 block uppercase font-mono tracking-wider">
                      {event.type === "login" ? `via ${(event as any).method || "Web"}` : "Sign Out"}
                    </span>
                  </div>
                </div>
              ))}

            {logins.length === 0 && logouts.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No session activity recorded recently.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3.5 bg-zinc-950/40 border border-zinc-900/60 rounded-lg hover:border-zinc-800/60 transition-all smooth-hover gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-rose-950/20 text-rose-400 border border-rose-500/10 rounded-lg shrink-0 mt-0.5">
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-200 block truncate">
                        {log.actor.name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                        {log.action}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block">
                      Changed {log.entityType} ID: <span className="font-mono text-zinc-300">{log.entityId || "N/A"}</span>
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono shrink-0 pt-0.5">
                  {formatTimeAgo(log.createdAt)}
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No administrative audit entries found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
