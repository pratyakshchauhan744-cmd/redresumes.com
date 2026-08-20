"use client";

import React, { useActionState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginStaff } from "@/actions/auth";
import { ShieldCheck, Lock, Mail, Sparkles, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [state, formAction, isPending] = useActionState(loginStaff, {
    success: false,
    error: null,
  });

  // Redirect client-side once auth succeeds
  useEffect(() => {
    if (state.success) {
      router.push(callbackUrl);
      router.refresh();
    }
  }, [state.success, callbackUrl, router]);

  return (
    <main className="min-h-screen w-screen flex items-center justify-center bg-zinc-950 p-6 relative select-none">
      {/* Decorative gradient overlay */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-zinc-800 red-glow shadow-2xl relative space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-950/40">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">RedResumes Console</h2>
          <p className="text-xs text-zinc-400 font-medium">
            Provide staff credentials to authorize your session.
          </p>
        </div>

        {/* Action Form */}
        <form action={formAction} className="space-y-4">
          {/* Email input field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              Staff Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all font-sans"
                placeholder="operator@redresumes.com"
              />
            </div>
          </div>

          {/* Password input field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              Security Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all font-sans"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Error Message Panel */}
          {state.error && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg animate-fade-in">
              {state.error}
            </div>
          )}

          {/* Submit Authorization Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg text-sm font-semibold tracking-wide shadow-md hover:shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                Authorizing Session...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white/80" />
                Sign In to Console
              </>
            )}
          </button>
        </form>

        {/* Footer Warning */}
        <div className="text-center pt-2 border-t border-zinc-800/40">
          <p className="text-[10px] text-zinc-500 font-medium leading-relaxed uppercase tracking-wider">
            Protected internal environment. Unauthorized access attempts are monitored and recorded.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-screen flex items-center justify-center bg-zinc-950"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
