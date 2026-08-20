"use client";

import React, { useState, useTransition } from "react";
import { UserRole } from "@prisma/client";
import { toggleUserStatus, changeUserRole } from "@/actions/users";
import { adjustUserCredits } from "@/actions/credits";
import {
  ShieldAlert,
  Coins,
  UserCheck,
  UserX,
  UserCog,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface UserActionsPanelProps {
  userId: string;
  isActive: boolean;
  userRole: UserRole;
  currentCredits: number;
  operatorRole: UserRole;
}

export function UserActionsPanel({
  userId,
  isActive,
  userRole,
  currentCredits,
  operatorRole,
}: UserActionsPanelProps) {
  const [isPending, startTransition] = useTransition();

  // Local Form states
  const [creditsAmount, setCreditsAmount] = useState<number>(10);
  const [creditsReason, setCreditsReason] = useState<string>("Support adjustment");
  const [selectedRole, setSelectedRole] = useState<UserRole>(userRole);

  // Status feedback state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If the operator is not an Admin, they cannot execute write commands
  const isOperatorAdmin = operatorRole === "admin";

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleToggleStatus = () => {
    clearMessages();
    startTransition(async () => {
      const res = await toggleUserStatus({ userId, isActive: !isActive });
      if (res.success) {
        setSuccessMsg(`Account status changed successfully.`);
      } else {
        setErrorMsg(res.error || "Failed to toggle status");
      }
    });
  };

  const handleRoleChange = () => {
    clearMessages();
    startTransition(async () => {
      const res = await changeUserRole({ userId, role: selectedRole });
      if (res.success) {
        setSuccessMsg(`User role promoted to ${selectedRole} successfully.`);
      } else {
        setErrorMsg(res.error || "Failed to alter role type");
      }
    });
  };

  const handleCreditsAdjustment = (amountMultiplier: 1 | -1) => {
    clearMessages();
    const adjustmentAmount = creditsAmount * amountMultiplier;

    if (adjustmentAmount === 0) {
      setErrorMsg("Adjustment amount cannot be zero");
      return;
    }

    startTransition(async () => {
      const res = await adjustUserCredits({
        userId,
        amount: adjustmentAmount,
        reason: creditsReason,
      });

      if (res.success) {
        setSuccessMsg(
          `Successfully ${adjustmentAmount > 0 ? "added" : "deducted"} ${Math.abs(
            adjustmentAmount
          )} credits.`
        );
        setCreditsAmount(10);
      } else {
        setErrorMsg(res.error || "Failed to adjust credit ledger");
      }
    });
  };

  if (!isOperatorAdmin) {
    return (
      <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 bg-zinc-950/20 text-center select-none space-y-2">
        <ShieldAlert className="w-8 h-8 text-zinc-500 mx-auto" />
        <h4 className="text-zinc-200 text-xs font-semibold uppercase tracking-wider">
          Read-Only Access
        </h4>
        <p className="text-[10px] text-zinc-400 max-w-xs mx-auto leading-normal">
          You are authenticated as {operatorRole}. Account deletions, promotions, and credit grants are
          restricted to administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      <h3 className="text-sm font-semibold tracking-tight text-zinc-200 uppercase border-b border-zinc-800/60 pb-2">
        Administrative Actions
      </h3>

      {/* Feedback Panels */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/20 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/25 rounded-lg text-emerald-400 text-xs font-medium flex items-start gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid of operational controls */}
      <div className="space-y-5">
        {/* 1. Account Access Suspension Toggle */}
        <div className="glass-panel p-4 rounded-lg border border-zinc-800/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-200 block">
              {isActive ? "Suspend Account" : "Activate Account"}
            </span>
            <span className="text-[9px] text-zinc-400 block leading-normal max-w-[200px]">
              {isActive
                ? "Prevent the user from signing in, downloading resumes, or consuming credits."
                : "Restore platform access and reactivate features for this account."}
            </span>
          </div>

          <button
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isActive
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isActive ? (
              <>
                <UserX className="w-3.5 h-3.5" />
                Suspend
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                Reactivate
              </>
            )}
          </button>
        </div>

        {/* 2. Manual Credit Adjustment */}
        <div className="glass-panel p-4 rounded-lg border border-zinc-800/80 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-zinc-200">Adjust Credit Balance</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-zinc-400 block uppercase">Credits</label>
              <input
                type="number"
                min="1"
                max="500"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[9px] font-mono text-zinc-400 block uppercase">Reason Log</label>
              <input
                type="text"
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
                placeholder="Goodwill grant, fix error..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleCreditsAdjustment(1)}
              disabled={isPending}
              className="flex-1 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3 animate-spin" /> : "+ Add"}
            </button>
            <button
              onClick={() => handleCreditsAdjustment(-1)}
              disabled={isPending || currentCredits === 0}
              className="flex-1 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-rose-950/40 hover:bg-rose-950/10 text-zinc-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3 animate-spin" /> : "- Deduct"}
            </button>
          </div>
        </div>

        {/* 3. Account Role Promotion Dropdown */}
        <div className="glass-panel p-4 rounded-lg border border-zinc-800/80 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-zinc-800/40 pb-2">
            <UserCog className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-zinc-200">Adjust System Role</span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg focus:outline-none focus:border-rose-500"
            >
              <option value="candidate">Candidate</option>
              <option value="employer">Employer</option>
              <option value="support">Support Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </select>

            <button
              onClick={handleRoleChange}
              disabled={isPending || selectedRole === userRole}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:bg-zinc-900 disabled:text-zinc-600 border disabled:border-zinc-800/40 text-white text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Update Role"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
