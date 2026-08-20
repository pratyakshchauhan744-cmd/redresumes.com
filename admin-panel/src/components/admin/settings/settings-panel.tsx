"use client";

import React, { useState, useTransition } from "react";
import { updateSystemSetting } from "@/actions/settings";
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Settings,
  Flame,
} from "lucide-react";

interface SettingItem {
  key: string;
  value: string;
  description: string | null;
}

interface SettingsPanelProps {
  initialSettings: SettingItem[];
}

export function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const [isPending, startTransition] = useTransition();

  // Load state from db list or fallback values
  const getSettingVal = (key: string, fallback: string) => {
    return initialSettings.find((s) => s.key === key)?.value ?? fallback;
  };

  const [signupCredits, setSignupCredits] = useState<string>(getSettingVal("default_signup_credits", "5"));
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(getSettingVal("maintenance_mode", "false") === "true");
  const [scraperDelay, setScraperDelay] = useState<string>(getSettingVal("scraper_throttle_ms", "2000"));
  const [paymentsActive, setPaymentsActive] = useState<boolean>(getSettingVal("razorpay_checkout_enabled", "true") === "true");

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveSetting = (key: string, value: string) => {
    clearMessages();
    startTransition(async () => {
      const res = await updateSystemSetting({ key, value });
      if (res.success) {
        setSuccessMsg(`Setting variable [${key}] committed successfully.`);
      } else {
        setErrorMsg(res.error || "Failed to commit system config changes");
      }
    });
  };

  return (
    <div className="space-y-6 select-none max-w-3xl">
      {/* Toast Alert Feedback */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/20 border border-rose-500/25 rounded-lg text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/25 rounded-lg text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Grid of settings blocks */}
      <div className="space-y-6">
        {/* 1. Signup Credits */}
        <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
              Default Signup Bonuses
            </h4>
            <span className="text-[10px] text-zinc-500 block leading-relaxed">
              Define the quantity of free AI mock interview credits allocated to candidates when registering.
            </span>
          </div>

          <div className="flex gap-3 max-w-sm">
            <input
              type="number"
              min="0"
              max="100"
              value={signupCredits}
              onChange={(e) => setSignupCredits(e.target.value)}
              className="w-24 bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={() => handleSaveSetting("default_signup_credits", signupCredits)}
              disabled={isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Setting
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Scraper Throttling Delays */}
        <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
              Scraper Ingestion Delays
            </h4>
            <span className="text-[10px] text-zinc-500 block leading-relaxed">
              Delay in milliseconds between scraping requests to prevent database locks or remote site blocks.
            </span>
          </div>

          <div className="flex gap-3 max-w-sm">
            <input
              type="number"
              min="500"
              max="60000"
              value={scraperDelay}
              onChange={(e) => setScraperDelay(e.target.value)}
              className="w-28 bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
            />
            <span className="text-zinc-650 text-xs shrink-0 self-center">ms</span>
            <button
              onClick={() => handleSaveSetting("scraper_throttle_ms", scraperDelay)}
              disabled={isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Setting
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Razorpay Payments Toggle */}
        <div className="glass-panel p-5 rounded-xl border border-zinc-800/80 flex items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
              Razorpay Checkouts Active
            </h4>
            <span className="text-[10px] text-zinc-500 block leading-relaxed max-w-md">
              Toggle this off to disable payment checkout gates across the main user application in case
              gateway issues or maintenance occurs.
            </span>
          </div>

          <button
            onClick={() => {
              const nextState = !paymentsActive;
              setPaymentsActive(nextState);
              handleSaveSetting("razorpay_checkout_enabled", nextState ? "true" : "false");
            }}
            disabled={isPending}
            className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              paymentsActive
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : paymentsActive ? (
              "Gateways Live"
            ) : (
              "Checkouts Frozen"
            )}
          </button>
        </div>

        {/* 4. Maintenance Mode Toggle */}
        <div className="glass-panel p-5 rounded-xl border border-red-900/35 bg-red-950/5 flex items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider block flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
              Global System Maintenance Mode
            </h4>
            <span className="text-[10px] text-zinc-500 block leading-relaxed max-w-md">
              Freezes user dashboard accesses and shows a maintenance screen. Staff panels remain operational.
            </span>
          </div>

          <button
            onClick={() => {
              const nextState = !maintenanceMode;
              setMaintenanceMode(nextState);
              handleSaveSetting("maintenance_mode", nextState ? "true" : "false");
            }}
            disabled={isPending}
            className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              maintenanceMode
                ? "bg-rose-600 hover:bg-rose-550 border-rose-650 text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : maintenanceMode ? (
              "Maintenance ON"
            ) : (
              "Normal Ops"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
