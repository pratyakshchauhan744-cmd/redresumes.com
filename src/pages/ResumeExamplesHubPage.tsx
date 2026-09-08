import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Filter, 
  FileText, 
  GraduationCap, 
  Briefcase, 
  Layers,
  Wand2
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { Section } from '../components/Section';
import { roleGuides, getAllRoleGuides } from '../data/roleGuides';

export const ResumeExamplesHubPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === 'all') {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: cat });
    }
  };

  const filteredGuides = useMemo(() => {
    let list = getAllRoleGuides();

    if (selectedCategory === 'experience') {
      list = list.filter((g) => g.category === 'experience');
    } else if (selectedCategory === 'function') {
      list = list.filter((g) => g.category === 'function');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.role.toLowerCase().includes(q) ||
          g.heroIntro.toLowerCase().includes(q) ||
          g.topSkills.some((s) => s.toLowerCase().includes(q))
      );
    }

    return list;
  }, [selectedCategory, searchQuery]);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Resume Examples & Writing Guides Hub | RedResumes',
      url: 'https://redresumes.com/resume-examples',
      description:
        'Browse 100% free, ATS-friendly resume examples and comprehensive writing guides tailored by role and experience level.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://redresumes.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Resume Examples',
          item: 'https://redresumes.com/resume-examples',
        },
      ],
    },
  ];

  return (
    <>
      <Seo
        title="Resume Examples & Writing Guides Hub (2026) | RedResumes"
        description="Explore ATS-optimized resume examples and step-by-step writing guides for Software Engineers, Freshers, Entry Level, Marketing, Data Analysts, and more."
        canonicalUrl="https://redresumes.com/resume-examples"
        jsonLd={jsonLd}
      />

      <div className="min-h-screen bg-white pb-20 dark:bg-zinc-950">
        {/* Hub Hero Header */}
        <section className="border-b border-zinc-100 bg-gradient-to-b from-red-50/40 via-white to-transparent py-14 md:py-20 dark:border-zinc-800 dark:from-red-950/20 dark:via-zinc-950">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-1.5 text-xs font-bold text-primary shadow-xs dark:border-red-900/40 dark:bg-zinc-900 dark:text-red-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Comprehensive 2026 Resource Center</span>
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl md:text-6xl dark:text-white">
              Resume Examples &amp; Writing Guides
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg dark:text-zinc-300">
              Real-world, ATS-tested resume examples paired with actionable, step-by-step writing guides. Select your role to view proven bullet points, top skills, and instant builder templates.
            </p>

            {/* Search Input Bar */}
            <div className="mx-auto mt-8 max-w-xl">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-4 h-5 w-5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by role (e.g. Software Engineer, Fresher, Marketing)..."
                  className="w-full rounded-full border border-zinc-200 bg-white py-3.5 pl-12 pr-4 text-sm text-zinc-900 shadow-sm transition-all placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleCategoryChange('all')}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                All Examples ({roleGuides.length})
              </button>

              <button
                onClick={() => handleCategoryChange('experience')}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  selectedCategory === 'experience'
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>By Experience Level (4)</span>
              </button>

              <button
                onClick={() => handleCategoryChange('function')}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  selectedCategory === 'function'
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>By Job Function (10)</span>
              </button>
            </div>
          </div>
        </section>

        {/* Guides Grid Section */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-between pb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Showing {filteredGuides.length} Resume {filteredGuides.length === 1 ? 'Guide' : 'Guides'}
            </h2>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              All guides include editable templates
            </span>
          </div>

          {filteredGuides.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
              <FileText className="mx-auto h-10 w-10 text-zinc-400" />
              <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100">No matching guides found</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Try searching for a different job title or resetting your category filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGuides.map((guide) => (
                <div
                  key={guide.slug}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-primary dark:bg-red-950/40 dark:text-red-300">
                        {guide.experienceLevel}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-400">
                        Updated 2026
                      </span>
                    </div>

                    <Link to={`/resume-examples/${guide.slug}`} className="block">
                      <h3 className="text-lg font-bold text-zinc-900 group-hover:text-primary transition-colors dark:text-zinc-100 dark:group-hover:text-red-400">
                        {guide.role} Resume Example
                      </h3>
                    </Link>

                    <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {guide.heroIntro}
                    </p>

                    <div className="pt-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                        Key Skills Included
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {guide.topSkills.slice(0, 3).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {skill}
                          </span>
                        ))}
                        {guide.topSkills.length > 3 && (
                          <span className="rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800/40">
                            +{guide.topSkills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <Link
                      to={`/resume-examples/${guide.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-zinc-700 hover:text-primary dark:text-zinc-300 dark:hover:text-red-400"
                    >
                      <span>Read Guide</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>

                    <button
                      onClick={() => navigate(`/builder?example=${encodeURIComponent(guide.slug)}`)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 active:scale-98"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Value Prop Banner */}
        <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 md:p-12 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-primary dark:bg-red-950/60 dark:text-red-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  100% ATS-Compliant Layouts
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                  Every example is built using single-column, cleanly structured HTML that passes through automated applicant tracking filters without distortion.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-primary dark:bg-red-950/60 dark:text-red-400">
                  <Wand2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  AI-Powered Bullet Writing
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                  Load any example directly into the RedResumes builder to receive real-time AI bullet enhancements with strong action verbs and quantified impact.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-primary dark:bg-red-950/60 dark:text-red-400">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Free PDF &amp; Word Export
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                  Export finished resumes immediately with zero hidden paywalls or subscription credit card requirements.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};
