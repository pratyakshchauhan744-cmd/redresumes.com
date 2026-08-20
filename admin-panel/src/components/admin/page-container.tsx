import React from "react";

interface PageContainerProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function PageContainer({ title, description, action, children }: PageContainerProps) {
  return (
    <div className="max-w-7xl mx-auto w-full px-8 py-8 space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/40 pb-5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">{title}</h2>
          {description && (
            <p className="text-xs text-zinc-400 font-medium leading-normal">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
      </div>

      {/* Main Page Content */}
      <div className="animate-fade-in">{children}</div>
    </div>
  );
}
