"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";

export function UsersFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state initialized from active URL values
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [role, setRole] = useState(searchParams.get("role") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams();
  };

  const updateUrlParams = (updatedRole = role, updatedStatus = status) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Page reset to 1 when filters change
    params.set("page", "1");

    if (query.trim()) {
      params.set("query", query.trim());
    } else {
      params.delete("query");
    }

    if (updatedRole !== "all") {
      params.set("role", updatedRole);
    } else {
      params.delete("role");
    }

    if (updatedStatus !== "all") {
      params.set("status", updatedStatus);
    } else {
      params.delete("status");
    }

    router.push(`/admin/users?${params.toString()}`);
  };

  const handleClear = () => {
    setQuery("");
    setRole("all");
    setStatus("all");
    router.push("/admin/users");
  };

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="glass-panel p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/20 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm shrink-0 select-none"
    >
      {/* Search Input field */}
      <div className="relative w-full md:max-w-xs shrink-0">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or ID..."
          className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/80 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
        />
      </div>

      {/* Selector Filters */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Role filter */}
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            updateUrlParams(e.target.value, status);
          }}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg focus:outline-none focus:border-rose-500/80 transition-all cursor-pointer"
        >
          <option value="all">All Roles</option>
          <option value="candidate">Candidates</option>
          <option value="employer">Employers</option>
          <option value="support">Support Agents</option>
          <option value="manager">Managers</option>
          <option value="admin">Administrators</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateUrlParams(role, e.target.value);
          }}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg focus:outline-none focus:border-rose-500/80 transition-all cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Users</option>
          <option value="suspended">Suspended Users</option>
        </select>

        {/* Trigger Search Button */}
        <button
          type="submit"
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-rose-950/20 transition-all cursor-pointer"
        >
          Apply Filters
        </button>

        {/* Clear Filters Button */}
        <button
          type="button"
          onClick={handleClear}
          className="p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
          title="Clear search queries"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
