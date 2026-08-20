"use client";

import React, { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import { changeUserRole, toggleUserStatus } from "@/actions/users";
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCog,
} from "lucide-react";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date | string;
}

interface StaffTableProps {
  staffList: StaffUser[];
  currentOperatorId: string;
}

export function StaffTable({ staffList, currentOperatorId }: StaffTableProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleRoleUpdate = (userId: string, newRole: UserRole) => {
    clearMessages();
    startTransition(async () => {
      const res = await changeUserRole({ userId, role: newRole });
      if (res.success) {
        setSuccessMsg("Staff member role clearance modified successfully.");
      } else {
        setErrorMsg(res.error || "Failed to update staff role level");
      }
    });
  };

  const handleStatusToggle = (userId: string, currentActive: boolean) => {
    clearMessages();
    startTransition(async () => {
      const res = await toggleUserStatus({ userId, isActive: !currentActive });
      if (res.success) {
        setSuccessMsg(`Staff member access status updated successfully.`);
      } else {
        setErrorMsg(res.error || "Failed to update staff access status");
      }
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Feedback banners */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/20 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/25 rounded-lg text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Staff directory grid */}
      <div className="glass-panel rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">Staff Member</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Privilege Clearance</th>
                <th className="px-6 py-4">State</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
              {staffList.map((user) => {
                const isSelf = user.id === currentOperatorId;

                return (
                  <tr key={user.id} className="hover:bg-zinc-900/10 transition-colors">
                    {/* User profile details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-850 border border-zinc-850 flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase shrink-0">
                          {user.name.substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-200 block">
                            {user.name} {isSelf && <span className="text-[10px] text-rose-500 font-bold font-mono pl-1">(You)</span>}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 block">
                            ID: {user.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 font-mono text-zinc-400">
                      {user.email}
                    </td>

                    {/* Privilege Role Selector */}
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        disabled={isPending || isSelf}
                        onChange={(e) => handleRoleUpdate(user.id, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg focus:outline-none focus:border-rose-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={isSelf ? "You cannot modify your own administrative roles." : "Update staff level"}
                      >
                        <option value="admin">Administrator</option>
                        <option value="manager">Manager</option>
                        <option value="support">Support Agent</option>
                        <option value="candidate">Demote to Candidate</option>
                        <option value="employer">Demote to Employer</option>
                      </select>
                    </td>

                    {/* Account status badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          user.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full bg-current ${user.isActive ? "animate-pulse" : ""}`} />
                        {user.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>

                    {/* Inline suspend buttons */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleStatusToggle(user.id, user.isActive)}
                        disabled={isPending || isSelf}
                        className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          user.isActive
                            ? "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-400"
                            : "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        }`}
                        title={isSelf ? "Self-suspension is blocked to prevent lockouts." : "Toggle access"}
                      >
                        {isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : user.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Suspend Access
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Restore Access
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
