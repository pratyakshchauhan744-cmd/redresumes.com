import { CheckCircle2, Wrench } from 'lucide-react';

export const RoleGuideSkillsPanel = ({
  roleTitle,
  skills,
}: {
  roleTitle: string;
  skills: string[];
}) => {
  return (
    <section id="top-skills" className="space-y-6 scroll-mt-24">
      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          Top Skills to Include in Your {roleTitle} Resume
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Incorporate these high-demand technical and domain keywords to clear ATS screening filters.
        </p>
      </div>

      <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/40 via-white to-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:from-red-950/10 dark:via-zinc-900 dark:to-zinc-900">
        <div className="flex items-center gap-2.5 pb-4 border-b border-red-100/80 dark:border-zinc-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-primary dark:bg-red-950/60 dark:text-red-400">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Essential {roleTitle} Competencies
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Recommended for your summary, skills section, and work experience bullets
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {skills.map((skill, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-800 shadow-xs dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{skill}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
