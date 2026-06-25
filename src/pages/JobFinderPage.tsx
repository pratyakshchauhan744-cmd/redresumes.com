import { useState, useEffect, useRef } from 'react';
import {
  Search, MapPin, Bookmark, BookmarkCheck, LoaderCircle,
  Building2, Clock, ExternalLink, Briefcase,
  Filter, X, ChevronDown, CheckCircle2, Globe,
} from 'lucide-react';
import { backendApi, mapBackendJobToUiJob, type AuthUser, type JobFilters } from '../lib/backendApi';
import { Section } from '../components/Section';
import { Seo } from '../components/Seo';
import { buildUserScopedStorageKey, getStoredAccessToken, SAVED_JOBS_STORAGE_KEY, APPLIED_JOBS_STORAGE_KEY } from '../lib/auth';
import type { JobItem } from '../types';

/* ─── Helpers ─────────────────────────────────────────────── */

const getPostedLabel = (iso?: string): string => {
  if (!iso) return 'Recently Posted';
  const diffH = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (diffH < 24) return 'Posted Today';
  if (diffH < 48) return 'Posted Yesterday';
  if (diffH < 72) return 'Posted 2 Days Ago';
  if (diffH < 168) return 'Posted This Week';
  return 'Recently Posted';
};

const getStatusBadge = (job: JobItem): { label: string; color: string } => {
  if (job.isNew) return { label: 'NEW', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  const diffH = job.postedAt ? (Date.now() - new Date(job.postedAt).getTime()) / 36e5 : 999;
  if (diffH < 48) return { label: 'Recently Posted', color: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (job.type.toLowerCase().includes('remote')) return { label: 'Remote', color: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (job.type.toLowerCase().includes('hybrid')) return { label: 'Hybrid', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Recommended', color: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
};

/** Deterministic color avatar from company initial */
const CompanyAvatar = ({ company }: { company: string }) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-orange-100 text-orange-700',
  ];
  const idx = company.charCodeAt(0) % colors.length;
  return (
    <div
      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-black ${colors[idx]}`}
      aria-hidden="true"
    >
      {company.charAt(0).toUpperCase()}
    </div>
  );
};

/** Skeleton card for loading state */
const JobCardSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-4">
      <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-zinc-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-zinc-100" />
        <div className="h-3 w-1/2 rounded bg-zinc-100" />
        <div className="h-3 w-1/3 rounded bg-zinc-100" />
      </div>
    </div>
    <div className="mt-4 flex gap-2">
      <div className="h-6 w-20 rounded-full bg-zinc-100" />
      <div className="h-6 w-24 rounded-full bg-zinc-100" />
      <div className="h-6 w-16 rounded-full bg-zinc-100" />
    </div>
    <div className="mt-4 flex gap-2">
      <div className="h-9 w-36 rounded-xl bg-zinc-100" />
      <div className="h-9 w-24 rounded-xl bg-zinc-100" />
    </div>
  </div>
);

/* ─── Filter chip ──────────────────────────────────────────── */
const FilterChip = ({
  label, active, onClick,
}: { key?: string; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
      active
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
    }`}
  >
    {active && <CheckCircle2 className="h-3 w-3" />}
    {label}
  </button>
);

/* ─── Job Card ─────────────────────────────────────────────── */
const JobCard = ({
  job,
  isSaved,
  isApplied,
  onSave,
}: {
  key?: string;
  job: JobItem;
  isSaved: boolean;
  isApplied: boolean;
  onSave: (id: string) => void | Promise<void>;
}) => {
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const badge = getStatusBadge(job);
  const postedLabel = getPostedLabel(job.postedAt);

  const handleSave = () => {
    setBookmarkAnim(true);
    setTimeout(() => setBookmarkAnim(false), 600);
    onSave(job.id);
  };

  const handleApply = () => {
    const targetUrl = job.originalJobUrl || job.url;
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_8px_30px_rgba(15,23,42,0.10)]">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <CompanyAvatar company={job.company} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold leading-snug text-zinc-900 md:text-lg">
                {job.title}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-zinc-500">{job.company}</p>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
              {job.type}
            </span>

          </div>
        </div>
      </div>

      {/* Skills */}
      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Primary CTA */}
        <button
          id={`apply-btn-${job.id}`}
          onClick={handleApply}
          disabled={!(job.url || job.originalJobUrl)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Apply on Company Site
        </button>

        {/* Save */}
        <button
          id={`save-btn-${job.id}`}
          onClick={handleSave}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
            isSaved
              ? 'border-primary/30 bg-primary/8 text-primary'
              : 'border-zinc-200 text-zinc-700 hover:border-zinc-400'
          } ${bookmarkAnim ? 'scale-110' : 'scale-100'}`}
          aria-label={isSaved ? 'Unsave job' : 'Save job'}
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {isSaved ? 'Saved' : 'Save Job'}
        </button>

        {/* View Details / Company site */}
        {job.companyUrl && (
          <a
            href={job.companyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
          >
            <Globe className="h-3.5 w-3.5" />
            Visit Company
          </a>
        )}

        {/* Applied indicator */}
        {isApplied && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Applied
          </span>
        )}
      </div>
    </article>
  );
};

/* ─── Quick Stats Sidebar Widget ─────────────────────────── */
const QuickStats = ({
  saved, applied, interview, offers,
}: { saved: number; applied: number; interview: number; offers: number }) => {
  const items = [
    { label: 'Saved Jobs', value: saved, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Applied', value: applied, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Interviews', value: interview, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Offers', value: offers, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Quick Stats</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl ${item.bg} p-3`}>
            <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Job Type Filter Dropdown ─────────────────────────────── */
const jobTypeFilters = [
  'Full Time', 'Part Time', 'Contract', 'Internship',
  'Remote', 'Hybrid', 'Onsite', 'Easy Apply',
  'Recently Posted', 'Verified Company', 'Visa Sponsorship',
];

/* ══════════════════════════════════════════════════════════════
   Main Page Component
══════════════════════════════════════════════════════════════ */
export const JobFinderPage = ({ currentUser }: { currentUser: AuthUser | null }) => {

  const fallbackJobs: JobItem[] = [
    {
      id: 'local-0',
      title: 'Cloud Sales Executive',
      company: 'Google',
      location: 'Gurugram, India',
      type: 'Hybrid',
      salary: '₹18L – ₹28L per annum',
      match: 90,
      skills: ['B2B Sales', 'Cloud Computing', 'Client Relations'],
      url: 'https://careers.google.com/',
      companyUrl: 'https://google.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'local-0b',
      title: 'Account Executive',
      company: 'Microsoft',
      location: 'Hyderabad, India',
      type: 'Hybrid',
      salary: '₹15L – ₹24L per annum',
      match: 86,
      skills: ['Enterprise Sales', 'Negotiation', 'SaaS'],
      url: 'https://careers.microsoft.com/',
      companyUrl: 'https://microsoft.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
    },
    {
      id: 'local-1',
      title: 'Senior Frontend Engineer',
      company: 'Vercel',
      location: 'Remote',
      type: 'Remote',
      salary: '$140k – $180k per annum',
      match: 92,
      skills: ['React', 'Next.js', 'TypeScript', 'Performance'],
      url: 'https://vercel.com/careers',
      companyUrl: 'https://vercel.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: 'local-2',
      title: 'Product Designer',
      company: 'Stripe',
      location: 'Bengaluru, India',
      type: 'Hybrid',
      salary: '₹30L – ₹45L per annum',
      match: 88,
      skills: ['Figma', 'UX Research', 'Design Systems'],
      url: 'https://stripe.com/jobs',
      companyUrl: 'https://stripe.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: 'local-3',
      title: 'Growth Marketing Manager',
      company: 'Notion',
      location: 'Remote',
      type: 'Remote',
      salary: '$120k – $160k per annum',
      match: 81,
      skills: ['SEO', 'Lifecycle Marketing', 'Performance Ads'],
      url: 'https://www.notion.so/careers',
      companyUrl: 'https://notion.so',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 38).toISOString(),
    },
    {
      id: 'local-4',
      title: 'Data Analyst',
      company: 'Spotify',
      location: 'Remote',
      type: 'Remote',
      salary: '$100k – $140k per annum',
      match: 79,
      skills: ['SQL', 'A/B Testing', 'Python', 'Tableau'],
      url: 'https://www.lifeatspotify.com/',
      companyUrl: 'https://spotify.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    },
    {
      id: 'local-5',
      title: 'Backend Software Engineer',
      company: 'Netflix',
      location: 'Remote',
      type: 'Remote',
      salary: '$200k – $350k per annum',
      match: 85,
      skills: ['Java', 'Distributed Systems', 'Microservices'],
      url: 'https://jobs.netflix.com/',
      companyUrl: 'https://netflix.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'local-6',
      title: 'UI/UX Designer',
      company: 'Airbnb',
      location: 'Bengaluru, India',
      type: 'Hybrid',
      salary: '₹25L – ₹40L per annum',
      match: 83,
      skills: ['Figma', 'Motion Design', 'Prototyping'],
      url: 'https://careers.airbnb.com/',
      companyUrl: 'https://airbnb.com',
      postedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    },
  ];

  /* ── State ── */
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>(fallbackJobs);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, 'applied' | 'interview'>>({});
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const JOBS_PER_PAGE = 6;

  const savedJobsStorageKey = buildUserScopedStorageKey(SAVED_JOBS_STORAGE_KEY, currentUser?.id);
  const appliedJobsStorageKey = buildUserScopedStorageKey(APPLIED_JOBS_STORAGE_KEY, currentUser?.id);

  /* ── Persist / load ── */
  useEffect(() => {
    setAccessToken(getStoredAccessToken());
    try { setSavedJobs(JSON.parse(window.localStorage.getItem(savedJobsStorageKey) ?? '[]')); } catch { setSavedJobs([]); }
    try { setAppliedJobs(JSON.parse(window.localStorage.getItem(appliedJobsStorageKey) ?? '{}')); } catch { setAppliedJobs({}); }
  }, [savedJobsStorageKey, appliedJobsStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(savedJobsStorageKey, JSON.stringify(savedJobs));
  }, [savedJobs, savedJobsStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(appliedJobsStorageKey, JSON.stringify(appliedJobs));
  }, [appliedJobs, appliedJobsStorageKey]);

  /* ── Filter helpers ── */
  const postedIn24hOnly = activeFilters.has('Recently Posted');
  const workModeFilters = ['Remote', 'Hybrid', 'Onsite'];
  const employmentFilters = ['Full Time', 'Part Time', 'Contract', 'Internship'];

  const isWithinLast24Hours = (v?: string) => {
    if (!v) return false;
    return Date.now() - new Date(v).getTime() <= 864e5;
  };

  const jobMatchesFilters = (job: JobItem) => {
    const role = query.toLowerCase().trim();
    if (role && !`${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase().includes(role)) return false;
    if (location && !job.location.toLowerCase().includes(location.toLowerCase().trim())) return false;
    if (activeFilters.has('Remote') && !job.type.toLowerCase().includes('remote')) return false;
    if (activeFilters.has('Hybrid') && !job.type.toLowerCase().includes('hybrid')) return false;
    if (activeFilters.has('Onsite') && !job.type.toLowerCase().includes('onsite')) return false;
    if (postedIn24hOnly && !isWithinLast24Hours(job.postedAt)) return false;
    return true;
  };

  const normalizeLevelFilter = (value: string): JobFilters['experienceLevel'] => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['entry', 'fresher', 'junior', 'intern'].some((word) => normalized.includes(word))) return 'entry';
    if (['senior', 'sr'].some((word) => normalized.includes(word))) return 'senior';
    if (['lead', 'principal', 'manager'].some((word) => normalized.includes(word))) return 'lead';
    return 'mid';
  };

  const getEmploymentTypeFilter = (): JobFilters['employmentType'] => {
    if (activeFilters.has('Full Time')) return 'full_time';
    if (activeFilters.has('Part Time')) return 'part_time';
    if (activeFilters.has('Contract')) return 'contract';
    if (activeFilters.has('Internship')) return 'internship';
    return undefined;
  };

  const getRemoteTypeFilter = (): JobFilters['remoteType'] => {
    if (activeFilters.has('Remote')) return 'remote';
    if (activeFilters.has('Hybrid')) return 'hybrid';
    if (activeFilters.has('Onsite')) return 'onsite';
    return undefined;
  };

  /* ── Search ── */
  const searchJobs = async (page = 1) => {
    setIsLoading(true);
    setApiError(null);
    setCurrentPage(page);
    try {
      const filters: JobFilters = {
        keyword: query.trim() || undefined,
        location: location.trim() || undefined,
        remoteType: getRemoteTypeFilter(),
        employmentType: getEmploymentTypeFilter(),
        experienceLevel: normalizeLevelFilter(level),
        page,
        limit: JOBS_PER_PAGE,
      };
      const resp = await backendApi.listJobs(filters);
      
      const live = Array.isArray(resp.items) ? resp.items.map(mapBackendJobToUiJob) : [];
      setJobs(live.filter(jobMatchesFilters));
      setTotalJobs(resp.total);
    } catch (error) {
      const filtered = fallbackJobs.filter(jobMatchesFilters);
      setJobs(filtered.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE));
      setTotalJobs(filtered.length);
      setApiError(
        error instanceof Error
          ? `${error.message} Showing sample jobs instead.`
          : 'Unable to fetch live jobs. Showing sample jobs instead.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void searchJobs(1); }, []);
  useEffect(() => { void searchJobs(1); }, [activeFilters]);

  /* ── Actions ── */
  const toggleSaveJob = async (jobId: string) => {
    const isSaved = savedJobs.includes(jobId);
    if (isSaved) { setSavedJobs((p) => p.filter((id) => id !== jobId)); return; }
    setSavedJobs((p) => [...p, jobId]);
    if (jobId.startsWith('local-')) return;
    const token = accessToken ?? getStoredAccessToken();
    if (!token) { setApiError('Login to save jobs to your account.'); return; }
    try { await backendApi.saveJob(jobId, token); } catch { /* silent */ }
  };

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        if (workModeFilters.includes(label)) {
          workModeFilters.forEach((filter) => next.delete(filter));
        }
        if (employmentFilters.includes(label)) {
          employmentFilters.forEach((filter) => next.delete(filter));
        }
        next.add(label);
      }
      return next;
    });
  };

  /* ── Pagination ── */
  const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);
  const paginatedJobs = jobs;

  /* ── Stats ── */
  const interviewCount = Object.values(appliedJobs).filter((s) => s === 'interview').length;
  const appliedCount = Object.keys(appliedJobs).length;

  /* ── Visible filters (first 6 or all) ── */
  const visibleFilters = showAllFilters ? jobTypeFilters : jobTypeFilters.slice(0, 6);

  return (
    <>
      <Seo
        title="Job Finder | Browse & Apply to Top Jobs | Red Resumes"
        description="Discover thousands of job opportunities. Filter by role, location, and work mode. Apply directly on company sites."
      />
      <Section h1 title="Job Finder" kicker="Discover & apply faster">

        {/* ── Search Bar ── */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)] md:p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div className="relative">
              <label htmlFor="job-search-input" className="sr-only">Job title, keyword, or company</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="job-search-input"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-4 text-sm transition focus:border-primary focus:bg-white focus:outline-none"
                placeholder="Job title, keyword, or company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchJobs(1)}
              />
            </div>
            <div className="relative">
              <label htmlFor="job-location-input" className="sr-only">Job location</label>
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="job-location-input"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-4 text-sm transition focus:border-primary focus:bg-white focus:outline-none"
                placeholder="City, state, or remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchJobs(1)}
              />
            </div>
            <div className="relative">
              <label htmlFor="job-level-input" className="sr-only">Experience level</label>
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="job-level-input"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-4 text-sm transition focus:border-primary focus:bg-white focus:outline-none"
                placeholder="Experience level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchJobs(1)}
              />
            </div>
            <button
              id="job-search-btn"
              onClick={() => searchJobs(1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search Jobs
            </button>
          </div>

          {/* Filter chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-zinc-400">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </span>
            {visibleFilters.map((f) => (
              <FilterChip key={f} label={f} active={activeFilters.has(f)} onClick={() => toggleFilter(f)} />
            ))}
            <button
              onClick={() => setShowAllFilters((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-zinc-500"
            >
              {showAllFilters ? <X className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAllFilters ? 'Less' : 'More filters'}
            </button>
            {activeFilters.size > 0 && (
              <button
                onClick={() => setActiveFilters(new Set())}
                className="ml-auto text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Notice Banner ── */}
        {apiError && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            {apiError}
          </p>
        )}

        {/* ── Main Grid ── */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px] lg:gap-6">

          {/* Left: Job cards */}
          <div>
            {/* Results header */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-500">
                {isLoading ? 'Searching…' : `${jobs.length} jobs found`}
              </p>
              {!isLoading && jobs.length > 0 && (
                <p className="text-xs text-zinc-400">Page {currentPage} of {totalPages}</p>
              )}
            </div>

            <div className="space-y-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)
                : paginatedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSaved={savedJobs.includes(job.id)}
                      isApplied={!!appliedJobs[job.id]}
                      onSave={toggleSaveJob}
                    />
                  ))
              }
              {!isLoading && paginatedJobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
                  <p className="text-base font-bold text-zinc-900">No matching jobs found</p>
                  <p className="mt-1 text-sm text-zinc-500">Try clearing one filter or searching a broader keyword.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => searchJobs(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => searchJobs(p)}
                    className={`h-9 w-9 rounded-xl text-sm font-bold transition ${
                      p === currentPage
                        ? 'bg-primary text-white'
                        : 'border border-zinc-200 text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => searchJobs(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <aside className="space-y-4">

            {/* Application Tips */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Apply Smarter</p>
              <ul className="mt-3 space-y-3 text-sm text-zinc-600">
                {[
                  "Customize your resume for each role's keywords.",
                  'Apply within 24 hours of a job posting for higher visibility.',
                  'Follow up with a short email 5 days after applying.',
                  'Research the company before your interview.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">✓</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Career Tools</p>
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Build Your Resume', href: '/builder' },
                  { label: 'Create Cover Letter', href: '/cover-letter' },
                  { label: 'Practice Interviews', href: '/interview' },
                  { label: 'View Resume Templates', href: '/templates' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-white"
                  >
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
};
