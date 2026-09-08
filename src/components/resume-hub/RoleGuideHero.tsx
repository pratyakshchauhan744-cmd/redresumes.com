import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import type { RoleGuide } from '../../data/roleGuides';

export const RoleGuideHero = ({ guide }: { guide: RoleGuide }) => {
  const navigate = useNavigate();

  const handleBuildResume = () => {
    navigate(`/builder?example=${encodeURIComponent(guide.slug)}`);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-red-100 bg-gradient-to-br from-red-50/70 via-white to-zinc-50/50 p-6 sm:p-10 md:p-12 dark:border-zinc-800 dark:from-red-950/20 dark:via-zinc-900/60 dark:to-zinc-900/40">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Column: Copy & Actions */}
        <div className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/80 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs backdrop-blur-xs dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{guide.badgeTitle} &bull; Updated for 2026</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-white">
            {guide.role} Resume Example &amp; Writing Guide
          </h1>

          <p className="text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
            {guide.heroIntro}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleBuildResume}
              className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-700 hover:shadow-red-900/30 active:scale-98"
            >
              <span>Build This Resume</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#resume-example"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-6 py-3.5 text-sm font-semibold text-zinc-700 shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <FileText className="h-4 w-4 text-zinc-500" />
              <span>View Example Below</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ATS-Optimized Formatting
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Recruiter-Approved Metrics
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Free PDF Export
            </span>
          </div>
        </div>

        {/* Right Column: Mini Resume Hero Preview Card */}
        <div className="lg:col-span-5">
          <div 
            onClick={handleBuildResume}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* Top Ribbon */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[11px] font-bold text-primary dark:text-red-400">
                Live Sample Template
              </span>
            </div>

            {/* Mini Resume Layout Mockup */}
            <div className="mt-4 space-y-3 font-sans text-xs">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{guide.resumeExample.name}</h2>
                <p className="text-xs font-semibold text-primary">{guide.resumeExample.jobTitle}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{guide.resumeExample.location} &bull; {guide.resumeExample.email}</p>
              </div>

              <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Summary</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                  {guide.resumeExample.summary}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Key Experience</p>
                {guide.resumeExample.experience.slice(0, 1).map((exp, i) => (
                  <div key={i} className="mt-1">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">{exp.title} &bull; {exp.company}</p>
                    <p className="line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      &bull; {exp.bullets[0]}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Top Skills</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {guide.resumeExample.skills.slice(0, 4).map((skill, i) => (
                    <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-zinc-900 shadow-lg">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Customize in Builder
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
