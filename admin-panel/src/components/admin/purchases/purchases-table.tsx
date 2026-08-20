"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, X, CreditCard, Coins, Calendar, User, Receipt, ShieldAlert } from "lucide-react";

interface Transaction {
  id: string;
  packageName: string;
  creditsAdded: number;
  paymentAmount: number;
  razorpayPaymentId: string;
  status: string;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface PurchasesTableProps {
  transactions: Transaction[];
}

export function PurchasesTable({ transactions }: PurchasesTableProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
      case "succeeded":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
      case "failed":
        return "bg-rose-500/10 text-rose-400 border-rose-500/25";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    }
  };

  return (
    <div className="relative select-none">
      {/* Primary Table Panel */}
      <div className="glass-panel rounded-xl border border-zinc-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-4">Buyer Account</th>
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Credits Added</th>
                <th className="px-6 py-4">Amount Paid</th>
                <th className="px-6 py-4">Payment ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-900/10 transition-colors">
                  {/* User Profile */}
                  <td className="px-6 py-4">
                    <Link href={`/admin/users/${tx.user.id}`} className="group block min-w-0">
                      <span className="font-semibold text-zinc-200 block truncate group-hover:text-rose-450 transition-colors">
                        {tx.user.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500 block truncate">
                        {tx.user.email}
                      </span>
                    </Link>
                  </td>

                  {/* Package */}
                  <td className="px-6 py-4 text-zinc-300 truncate max-w-[120px]">
                    {tx.packageName}
                  </td>

                  {/* Credits Added */}
                  <td className="px-6 py-4 font-mono font-bold text-zinc-200">
                    +{tx.creditsAdded}
                  </td>

                  {/* Payment Amount */}
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                    {formatCurrency(tx.paymentAmount)}
                  </td>

                  {/* Razorpay ID */}
                  <td className="px-6 py-4 font-mono text-[10px] text-zinc-400 truncate max-w-[100px]">
                    {tx.razorpayPaymentId}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(tx.status)}`}>
                      {tx.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 font-mono text-zinc-550 truncate">
                    {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </td>

                  {/* Detail action */}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Transaction Details Side Drawer Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          <div
            className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800/80 shadow-2xl flex flex-col p-6 animate-slide-in relative"
            style={{ animationDuration: "250ms" }}
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-500" />
                <h4 className="text-sm font-bold text-zinc-150 uppercase tracking-wider">
                  Transaction Metadata Inspect
                </h4>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg text-zinc-450 hover:text-zinc-200 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto space-y-6 text-xs text-zinc-350 pr-1">
              {/* Payment Summary */}
              <div className="glass-panel p-5 rounded-xl border border-zinc-800/60 bg-zinc-900/10 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">Paid Amount</span>
                  <span className="text-2xl font-extrabold text-white font-mono block">
                    {formatCurrency(selectedTx.paymentAmount)}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(selectedTx.status)}`}>
                  {selectedTx.status}
                </span>
              </div>

              {/* Transaction details grid */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900 pb-1.5">
                  Ledger Details
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Credits added</span>
                    <span className="text-zinc-200 font-bold block">+{selectedTx.creditsAdded} credits</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Package package</span>
                    <span className="text-zinc-200 block truncate">{selectedTx.packageName}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Payment gateway ID</span>
                    <span className="text-zinc-200 font-mono block select-text truncate">{selectedTx.razorpayPaymentId}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Timestamp</span>
                    <span className="text-zinc-200 font-mono block">
                      {new Date(selectedTx.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer summary */}
              <div className="space-y-4 pt-2">
                <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900 pb-1.5">
                  Buyer Information
                </h5>
                <div className="glass-panel p-4 rounded-xl border border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-200 block truncate">
                      {selectedTx.user.name}
                    </span>
                    <span className="text-[10px] text-zinc-450 block truncate font-mono">
                      {selectedTx.user.email}
                    </span>
                  </div>
                  <Link
                    href={`/admin/users/${selectedTx.user.id}`}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 hover:text-white rounded-lg transition-all text-[10px] font-semibold shrink-0"
                  >
                    Go Workspace
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer warning */}
            <div className="border-t border-zinc-800/60 pt-4 mt-6 shrink-0 text-center">
              <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider leading-relaxed">
                Reconciliation audits must log changes under setting variables.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
