import React from "react";
import { Users, UserCheck, CreditCard, Coins } from "lucide-react";

interface KPICardsProps {
  data: {
    totalUsers: number;
    active30d: number;
    totalPurchasesCount: number;
    totalCreditsBought: number;
  };
}

export function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: "Total Registered Users",
      value: data.totalUsers.toLocaleString(),
      description: "Candidates and employers registered",
      icon: Users,
      color: "text-blue-400 bg-blue-500/5 border-blue-500/10",
    },
    {
      label: "Active Users (30d)",
      value: data.active30d.toLocaleString(),
      description: "Distinct user logins in last 30 days",
      icon: UserCheck,
      color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10",
    },
    {
      label: "Total Purchase Transactions",
      value: data.totalPurchasesCount.toLocaleString(),
      description: "Completed checkout count (Razorpay)",
      icon: CreditCard,
      color: "text-rose-400 bg-rose-500/5 border-rose-500/10",
    },
    {
      label: "Credits Issued / Bought",
      value: data.totalCreditsBought.toLocaleString(),
      description: "Aggregated user package credits",
      icon: Coins,
      color: "text-amber-400 bg-amber-500/5 border-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="glass-panel p-5 rounded-xl border border-zinc-800/80 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-all duration-200 smooth-hover group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                  {card.label}
                </span>
                <span className="text-2xl font-bold tracking-tight text-zinc-100 block group-hover:text-white transition-colors">
                  {card.value}
                </span>
              </div>
              <div className={`p-2.5 border rounded-lg shrink-0 ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="border-t border-zinc-800/40 mt-4 pt-3">
              <p className="text-[10px] text-zinc-500 font-medium leading-normal">{card.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
