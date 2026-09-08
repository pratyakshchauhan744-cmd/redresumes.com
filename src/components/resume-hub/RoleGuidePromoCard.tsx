import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Zap, Check } from 'lucide-react';

export const RoleGuidePromoCard = ({ roleSlug, roleTitle }: { roleSlug: string; roleTitle: string }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/60 to-white p-5 shadow-xs dark:border-red-900/30 dark:from-red-950/20 dark:to-zinc-900">
      <div className="flex items-center gap-2 text-primary dark:text-red-400">
        <Zap className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Fast &amp; Free</span>
      </div>

      <h4 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
        Build your {roleTitle} resume in 15 minutes
      </h4>

      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Pre-fill this exact template, get AI bullet suggestions, and download your ATS PDF without signing up.
      </p>

      <ul className="mt-3 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
        <li className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Pre-loaded {roleTitle} structure</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>AI-generated bullet suggestions</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Instant ATS Score analysis</span>
        </li>
      </ul>

      <button
        onClick={() => navigate(`/builder?example=${encodeURIComponent(roleSlug)}`)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 active:scale-98"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Open in Resume Builder</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
