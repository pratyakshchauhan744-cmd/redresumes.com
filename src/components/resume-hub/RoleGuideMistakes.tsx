import { XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { RoleGuideMistake } from '../../data/roleGuides';

export const RoleGuideMistakes = ({
  roleTitle,
  mistakes,
}: {
  roleTitle: string;
  mistakes: RoleGuideMistake[];
}) => {
  return (
    <section id="mistakes" className="space-y-6 scroll-mt-24">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Pitfalls &amp; Solutions</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          Common {roleTitle} Resume Mistakes to Avoid
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Avoid these frequent candidate errors that lead to ATS rejections or recruiter drop-off.
        </p>
      </div>

      <div className="grid gap-4">
        {mistakes.map((item, index) => (
          <div
            key={index}
            className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Mistake */}
            <div className="flex items-start gap-3 rounded-xl bg-red-50/60 p-3.5 dark:bg-red-950/20">
              <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  Common Mistake
                </span>
                <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {item.mistake}
                </p>
              </div>
            </div>

            {/* Fix */}
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50/60 p-3.5 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  The Better Fix
                </span>
                <p className="mt-1 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                  {item.fix}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
