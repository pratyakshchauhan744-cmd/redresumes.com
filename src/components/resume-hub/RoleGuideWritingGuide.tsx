import { CheckCircle2 } from 'lucide-react';
import type { RoleGuideStep } from '../../data/roleGuides';

export const RoleGuideWritingGuide = ({
  roleTitle,
  steps,
}: {
  roleTitle: string;
  steps: RoleGuideStep[];
}) => {
  return (
    <section id="writing-guide" className="space-y-8 scroll-mt-24">
      {/* Overview Intro */}
      <div className="space-y-3">
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          How to Write a {roleTitle} Resume
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-300">
          A standout {roleTitle.toLowerCase()} resume must immediately convince recruiters and automated Applicant Tracking Systems (ATS) that your specific skills match the job requisition. Follow this structured roadmap to craft every section with precision.
        </p>
      </div>

      {/* Step by Step List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>Step-by-Step Breakdown</span>
        </h3>

        <div className="grid gap-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-black text-primary dark:bg-red-950/60 dark:text-red-300">
                  {index + 1}
                </span>

                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {step.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {step.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
