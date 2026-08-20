import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 1. KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 space-y-4 h-[120px]">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-28 bg-zinc-800 rounded" />
                <div className="h-7 w-20 bg-zinc-800 rounded" />
              </div>
              <div className="w-10 h-10 bg-zinc-800 rounded-lg" />
            </div>
            <div className="h-3 w-40 bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* 2. Middle Row: Activity Feed and Section Overview Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial telemetry skeleton (1 Column) */}
        <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-6 h-[340px] space-y-6">
          <div className="space-y-2">
            <div className="h-4 w-44 bg-zinc-800 rounded" />
            <div className="h-3 w-28 bg-zinc-800/60 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-20 bg-zinc-800/60 rounded" />
            <div className="h-10 w-48 bg-zinc-800 rounded" />
          </div>
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-zinc-800/60 rounded" />
                <div className="h-4 w-12 bg-zinc-800 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 bg-zinc-800/60 rounded" />
                <div className="h-4 w-16 bg-zinc-800 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Ledger skeleton (2 Columns) */}
        <div className="lg:col-span-2 bg-zinc-950/40 border border-zinc-900 rounded-xl p-6 h-[340px] flex flex-col justify-between">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
            <div className="h-4 w-36 bg-zinc-800 rounded" />
            <div className="h-3 w-20 bg-zinc-800/60 rounded" />
          </div>
          <div className="space-y-3.5 flex-1 pt-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-zinc-900/20 border border-zinc-900/60 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-24 bg-zinc-800 rounded" />
                    <div className="h-3 w-36 bg-zinc-800/60 rounded" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-3.5 w-16 bg-zinc-800 rounded ml-auto" />
                  <div className="h-3 w-12 bg-zinc-800/60 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Activity Feed Timeline Skeleton */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-6 h-[400px] flex flex-col justify-between">
        <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-3.5 w-16 bg-zinc-800/60 rounded" />
        </div>
        <div className="space-y-3 flex-1 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 bg-zinc-900/20 border border-zinc-900/60 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-3.5 w-28 bg-zinc-800 rounded" />
                  <div className="h-3 w-40 bg-zinc-800/60 rounded" />
                </div>
              </div>
              <div className="h-3 w-16 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
