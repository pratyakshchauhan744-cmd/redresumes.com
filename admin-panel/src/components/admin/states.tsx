import React from "react";
import { Loader2, Inbox, AlertTriangle, ShieldAlert, ArrowLeft } from "lucide-react";

/**
 * 1. Loading State Component
 */
export function LoadingState({ message = "Loading dashboard assets..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 text-center animate-fade-in">
      <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-4" />
      <p className="text-zinc-400 text-sm font-medium tracking-wide">{message}</p>
    </div>
  );
}

/**
 * 2. Empty State Component
 */
export function EmptyState({
  title = "No records found",
  description = "Adjust your search parameters or check filters.",
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] w-full p-8 border border-zinc-800/40 rounded-xl bg-zinc-900/20 text-center">
      <Inbox className="w-12 h-12 text-zinc-600 mb-4" />
      <h3 className="text-zinc-200 text-base font-semibold mb-1">{title}</h3>
      <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg text-sm font-medium transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * 3. Error State Component
 */
export function ErrorState({
  title = "Database sync failed",
  errorMsg = "We encountered a network timeout or connection reset. Please retry the request.",
  onRetry,
}: {
  title?: string;
  errorMsg?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[350px] w-full p-8 border border-red-900/30 rounded-xl bg-red-950/5 text-center">
      <div className="p-3 bg-red-950/50 rounded-full border border-red-500/20 mb-4">
        <AlertTriangle className="w-8 h-8 text-rose-500" />
      </div>
      <h3 className="text-zinc-200 text-base font-semibold mb-1">{title}</h3>
      <p className="text-red-400/80 text-xs font-mono mb-6 max-w-md bg-red-950/20 p-3 rounded-lg border border-red-900/20">
        {errorMsg}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-rose-950/30"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}

/**
 * 4. Forbidden / Unauthorized State Component
 */
export function ForbiddenState({
  title = "Access Level Insufficient",
  message = "Your account does not possess the permissions required to view this administrative resource. Contact a System Administrator to request support roles.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] w-full p-8 text-center animate-fade-in">
      <div className="p-4 bg-rose-950/30 border border-rose-500/25 rounded-full mb-6 relative">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-xl animate-pulse" />
      </div>
      <h1 className="text-zinc-100 text-2xl font-bold tracking-tight mb-2">{title}</h1>
      <p className="text-zinc-400 text-sm max-w-md mb-8 leading-relaxed">{message}</p>
      <a
        href="/admin"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white text-sm font-semibold transition-all hover:border-zinc-700 shadow-lg shadow-black/50"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </a>
    </div>
  );
}
