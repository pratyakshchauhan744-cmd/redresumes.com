"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Calendar, RotateCcw } from "lucide-react";

export function PurchasesFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize values from URL query string
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams();
  };

  const updateUrlParams = (updatedStatus = status, start = startDate, end = endDate) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Reset page to index 1 on filters modify
    params.set("page", "1");

    if (query.trim()) {
      params.set("query", query.trim());
    } else {
      params.delete("query");
    }

    if (updatedStatus !== "all") {
      params.set("status", updatedStatus);
    } else {
      params.delete("status");
    }

    if (start) {
      params.set("startDate", start);
    } else {
      params.delete("startDate");
    }

    if (end) {
      params.set("endDate", end);
    } else {
      params.delete("endDate");
    }

    router.push(`/admin/purchases?${params.toString()}`);
  };

  const handleClear = () => {
    setQuery("");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    router.push("/admin/purchases");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/20 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm select-none shrink-0 w-full"
    >
      {/* 1. Name/Email/Tx ID Search */}
      <div className="relative w-full lg:max-w-xs shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or Payment ID..."
          className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/80 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
        />
      </div>

      {/* 2. Selectors and Date Pickers */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        {/* Status selector */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateUrlParams(e.target.value, startDate, endDate);
          }}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg focus:outline-none focus:border-rose-500"
        >
          <option value="all">All Transactions</option>
          <option value="succeeded">Completed Purchases</option>
          <option value="failed">Failed Transactions</option>
          <option value="pending">Pending Orders</option>
        </select>

        {/* Date picking box */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              updateUrlParams(status, e.target.value, endDate);
            }}
            className="bg-transparent border-0 text-xs text-zinc-300 focus:outline-none cursor-pointer"
            title="Start date range"
          />
          <span className="text-zinc-650 text-xs px-1">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              updateUrlParams(status, startDate, e.target.value);
            }}
            className="bg-transparent border-0 text-xs text-zinc-300 focus:outline-none cursor-pointer"
            title="End date range"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-rose-950/20 transition-all cursor-pointer"
        >
          Apply Filters
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
          title="Reset filter values"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
