import React from "react";
import { Receipt, Coins, CheckCircle2, TrendingUp, Sparkles, IndianRupee } from "lucide-react";

interface RevenueSectionProps {
  financials: {
    totalPurchasesCount: number;
    totalRevenue: number;
    totalCreditsBought: number;
  };
  recentPurchases: Array<{
    id: string;
    packageName: string;
    creditsAdded: number;
    paymentAmount: number;
    razorpayPaymentId: string;
    status: string;
    createdAt: Date | string;
    user: {
      name: string;
      email: string;
    };
  }>;
}

export function RevenueSection({ financials, recentPurchases }: RevenueSectionProps) {
  // Format currency helper (RedResumes transactions default to INR or USD)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Compute average order value (AOV)
  const averageOrderValue = financials.totalPurchasesCount > 0
    ? financials.totalRevenue / financials.totalPurchasesCount
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Financial Health Summary (1 Column) */}
      <div className="glass-panel p-6 rounded-xl border border-zinc-800/80 shadow-sm flex flex-col justify-between space-y-6">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-zinc-200 mb-1 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-500" />
            Revenue & Sales Telemetry
          </h3>
          <p className="text-[11px] text-zinc-500 font-medium">Aggregated Razorpay checkout summaries</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              Gross Revenue
            </span>
            <span className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1">
              {formatCurrency(financials.totalRevenue)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-zinc-800/40 pt-4 font-mono text-xs">
            <div>
              <span className="text-zinc-500 block mb-0.5 text-[9px] uppercase">Paid checkouts</span>
              <span className="text-zinc-200 font-bold">{financials.totalPurchasesCount}</span>
            </div>
            <div>
              <span className="text-zinc-500 block mb-0.5 text-[9px] uppercase">Avg Order Val</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(averageOrderValue)}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-900 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-zinc-400 block font-semibold">Payment Sync Status</span>
            <span className="text-[9px] text-emerald-400 font-mono block">All gateways synchronized</span>
          </div>
        </div>
      </div>

      {/* Recent Purchases Ledger (2 Columns) */}
      <div className="lg:col-span-2 glass-panel border border-zinc-800/80 rounded-xl shadow-sm flex flex-col h-[340px]">
        <div className="px-6 border-b border-zinc-800/60 bg-zinc-950/20 py-3 shrink-0 flex justify-between items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Purchases Ledger
          </h3>
          <span className="text-[10px] font-mono text-zinc-500">Last 5 Transactions</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {recentPurchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-900/60 rounded-lg hover:border-zinc-800/60 transition-all smooth-hover"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-lg shrink-0">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-200 block truncate">
                      {purchase.user.name || "System User"}
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate block">
                      {purchase.packageName} • <span className="font-mono text-zinc-400">{purchase.razorpayPaymentId}</span>
                    </span>
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-zinc-100 block font-mono">
                    +{purchase.creditsAdded} credits
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                    {formatCurrency(purchase.paymentAmount)}
                  </span>
                </div>
              </div>
            ))}

            {recentPurchases.length === 0 && (
              <div className="text-center py-16 text-zinc-500 text-xs">
                No payment transactions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
