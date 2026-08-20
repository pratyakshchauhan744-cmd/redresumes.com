"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, RotateCcw } from "lucide-react";

export function CreditsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams();
  };

  const updateUrlParams = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (query.trim()) {
      params.set("query", query.trim());
    } else {
      params.delete("query");
    }

    router.push(`/admin/credits?${params.toString()}`);
  };

  const handleClear = () => {
    setQuery("");
    router.push("/admin/credits");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/20 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm select-none shrink-0 w-full"
    >
      <div className="relative w-full sm:max-w-xs shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search user name or email..."
          className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/80 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
        />
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-rose-950/20 transition-all cursor-pointer"
        >
          Search Ledger
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
          title="Reset search values"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
