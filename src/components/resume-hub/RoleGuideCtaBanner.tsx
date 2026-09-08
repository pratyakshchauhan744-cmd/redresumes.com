import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export const RoleGuideCtaBanner = ({
  roleSlug,
  roleTitle,
}: {
  roleSlug: string;
  roleTitle: string;
}) => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden rounded-3xl crimson-gradient p-8 sm:p-12 text-white shadow-xl">
      {/* Background Decorative Rings */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/10 blur-2xl" />

      <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ready in 15 Minutes</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl text-white">
            Craft Your Perfect {roleTitle} Resume in Minutes
          </h2>

          <p className="text-sm sm:text-base text-red-100">
            Pre-fill your resume with this {roleTitle.toLowerCase()} template, receive AI bullet point suggestions, and export your polished ATS PDF for free.
          </p>

          <div className="flex items-center gap-2 pt-1 text-xs text-red-200">
            <ShieldCheck className="h-4 w-4" />
            <span>No sign-up required &bull; 100% free PDF download &bull; ATS optimized</span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/builder?example=${encodeURIComponent(roleSlug)}`)}
          className="inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-bold text-primary shadow-xl transition-all duration-200 hover:bg-zinc-100 active:scale-98"
        >
          <span>Build Your Resume</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
