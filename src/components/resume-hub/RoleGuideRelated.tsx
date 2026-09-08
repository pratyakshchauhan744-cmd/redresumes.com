import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import type { RoleGuide } from '../../data/roleGuides';

export const RoleGuideRelated = ({ relatedGuides }: { relatedGuides: RoleGuide[] }) => {
  if (!relatedGuides || relatedGuides.length === 0) return null;

  return (
    <section id="related-examples" className="space-y-6 scroll-mt-24">
      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          Related Resume Examples
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Explore additional role-specific guides and templates across related domains.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {relatedGuides.map((guide) => (
          <Link
            key={guide.slug}
            to={`/resume-examples/${guide.slug}`}
            className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {guide.experienceLevel}
                </span>
                <FileText className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>

              <h3 className="text-base font-bold text-zinc-900 group-hover:text-primary transition-colors dark:text-zinc-100 dark:group-hover:text-red-400">
                {guide.role} Resume Guide
              </h3>

              <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                {guide.heroIntro}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary dark:text-red-400">
              <span>Read Guide &amp; Example</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
