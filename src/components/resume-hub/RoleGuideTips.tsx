import { Lightbulb } from 'lucide-react';
import type { RoleGuideTip } from '../../data/roleGuides';

export const RoleGuideTips = ({
  roleTitle,
  tips,
}: {
  roleTitle: string;
  tips: RoleGuideTip[];
}) => {
  return (
    <section id="tips" className="space-y-6 scroll-mt-24">
      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          Tips to Create a Job-Winning {roleTitle} Resume
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Proven recruiter strategies to ensure your {roleTitle.toLowerCase()} resume stands out from the competition.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tips.map((tip, index) => (
          <div
            key={index}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2.5 text-primary dark:text-red-400">
              <Lightbulb className="h-4 w-4" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {tip.title}
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-300">
              {tip.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
