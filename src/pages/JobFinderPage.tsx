import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, ExternalLink, Bookmark, LoaderCircle, Building2, BriefcaseBusiness, Check, Send, X } from 'lucide-react';
import { backendApi, mapBackendJobToUiJob, type AuthUser, type JobFilters } from '../lib/backendApi';
import { Section } from '../components/Section';
import { buildUserScopedStorageKey, getStoredAccessToken, SAVED_JOBS_STORAGE_KEY, APPLIED_JOBS_STORAGE_KEY } from '../lib/auth';
import type { JobItem } from '../types';
import { useNavigate } from 'react-router-dom';

export const JobFinderPage = ({ currentUser }: { currentUser: AuthUser | null }) => {
  const navigate = useNavigate();
  const fallbackJobs: JobItem[] = [
    {
      id: 'local-0',
      title: 'Business Development Executive',
      company: 'GrowthBridge Consulting',
      companyUrl: 'https://www.growthbridgeconsulting.com',
      location: 'Noida, India',
      type: 'Onsite',
      salary: 'Rs 8 L - Rs 12 L',
      match: 90,
      skills: ['Lead Generation', 'Client Outreach', 'Negotiation'],
      url: 'https://www.growthbridgeconsulting.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'local-0b',
      title: 'Business Development Associate',
      company: 'ScaleAxis Technologies',
      companyUrl: 'https://www.scaleaxis.com',
      location: 'Gurugram, India',
      type: 'Hybrid',
      salary: 'Rs 7 L - Rs 10 L',
      match: 86,
      skills: ['Sales Pipeline', 'B2B', 'Communication'],
      url: 'https://www.scaleaxis.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
    },
    {
      id: 'local-1',
      title: 'Senior Frontend Engineer',
      company: 'ArcScale Labs',
      companyUrl: 'https://www.arcscale.com',
      location: 'Bengaluru, India',
      type: 'Remote',
      salary: 'Rs 18 L - Rs 26 L',
      match: 92,
      skills: ['React', 'TypeScript', 'Design Systems'],
      url: 'https://www.arcscale.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: 'local-2',
      title: 'Product Designer',
      company: 'VelocityOS',
      companyUrl: 'https://www.velocityos.com',
      location: 'Mumbai, India',
      type: 'Hybrid',
      salary: 'Rs 12 L - Rs 18 L',
      match: 88,
      skills: ['Figma', 'UX Research', 'Prototyping'],
      url: 'https://www.velocityos.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: 'local-3',
      title: 'Growth Marketing Manager',
      company: 'Northline Commerce',
      companyUrl: 'https://www.northlinecommerce.com',
      location: 'Delhi, India',
      type: 'Onsite',
      salary: 'Rs 14 L - Rs 20 L',
      match: 81,
      skills: ['SEO', 'Lifecycle', 'Performance Ads'],
      url: 'https://www.northlinecommerce.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 38).toISOString(),
    },
    {
      id: 'local-4',
      title: 'Data Analyst',
      company: 'Quorix Health',
      companyUrl: 'https://www.quorixhealth.com',
      location: 'Hyderabad, India',
      type: 'Remote',
      salary: 'Rs 9 L - Rs 14 L',
      match: 79,
      skills: ['SQL', 'Power BI', 'Python'],
      url: 'https://www.quorixhealth.com/careers',
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    },
  ];

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [atsReadyOnly, setAtsReadyOnly] = useState(false);
  const [postedIn24hOnly, setPostedIn24hOnly] = useState(false);
  const [salaryListedOnly, setSalaryListedOnly] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>(fallbackJobs);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, 'applied' | 'interview'>>({});
  const [activeJob, setActiveJob] = useState<JobItem | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState<string | null>(null);
  const savedJobsStorageKey = buildUserScopedStorageKey(SAVED_JOBS_STORAGE_KEY, currentUser?.id);
  const appliedJobsStorageKey = buildUserScopedStorageKey(APPLIED_JOBS_STORAGE_KEY, currentUser?.id);

  useEffect(() => {
    setAccessToken(getStoredAccessToken());
    const saved = window.localStorage.getItem(savedJobsStorageKey);
    const applied = window.localStorage.getItem(appliedJobsStorageKey);
    try {
      setSavedJobs(saved ? JSON.parse(saved) : []);
    } catch {
      setSavedJobs([]);
    }
    try {
      setAppliedJobs(applied ? JSON.parse(applied) : {});
    } catch {
      setAppliedJobs({});
    }
  }, [savedJobsStorageKey, appliedJobsStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(savedJobsStorageKey, JSON.stringify(savedJobs));
  }, [savedJobs, savedJobsStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(appliedJobsStorageKey, JSON.stringify(appliedJobs));
  }, [appliedJobs, appliedJobsStorageKey]);

  const parseExperienceRange = (value: string) => {
    const cleaned = value.toLowerCase().trim();
    if (!cleaned) return null;
    const rangeMatch = cleaned.match(/(\d+)\s*[-to]+\s*(\d+)/);
    if (rangeMatch) {
      return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
    }
    const singleMatch = cleaned.match(/(\d+)/);
    if (singleMatch) {
      const year = Number(singleMatch[1]);
      return { min: year, max: year + 1 };
    }
    return null;
  };

  const mapExperienceLevel = (value: string): JobFilters['experienceLevel'] | undefined => {
    const cleaned = value.toLowerCase().trim();
    if (!cleaned) return undefined;
    if (cleaned.includes('0') || cleaned.includes('1') || cleaned.includes('entry') || cleaned.includes('intern')) return 'entry';
    if (cleaned.includes('2') || cleaned.includes('3') || cleaned.includes('4') || cleaned.includes('mid')) return 'mid';
    if (cleaned.includes('5') || cleaned.includes('6') || cleaned.includes('senior')) return 'senior';
    if (cleaned.includes('7') || cleaned.includes('8') || cleaned.includes('9') || cleaned.includes('lead') || cleaned.includes('manager'))
      return 'lead';
    return undefined;
  };

  const detectExperienceFromText = (value: string) => {
    const text = value.toLowerCase();
    if (text.includes('intern')) return 0;
    if (text.includes('junior')) return 1;
    if (text.includes('mid') || text.includes('associate')) return 3;
    if (text.includes('senior')) return 5;
    if (text.includes('lead') || text.includes('principal') || text.includes('manager')) return 7;
    return 3;
  };

  const normalizedLocationText = (value: string) => value.toLowerCase().trim();

  const locationMatches = (requestedLocation: string, jobLocation: string) => {
    const request = normalizedLocationText(requestedLocation);
    const locationText = normalizedLocationText(jobLocation);
    if (!request) return true;
    if (locationText.includes(request)) return true;

    if (request === 'india') {
      return ['india', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'pune', 'chennai', 'remote'].some((token) =>
        locationText.includes(token),
      );
    }

    return false;
  };

  const isWithinLast24Hours = (value?: string) => {
    if (!value) return false;
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= 1000 * 60 * 60 * 24;
  };

  const jobMatchesFilters = (job: JobItem, roleFilter: string, locationFilter: string, experienceRange: { min: number; max: number } | null) => {
    const role = roleFilter.toLowerCase().trim();
    const roleText = `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase();
    const roleMatch = role ? roleText.includes(role) : true;
    const locationMatch = locationMatches(locationFilter, job.location);
    const experienceMatch = experienceRange
      ? (() => {
          const estimatedYears = detectExperienceFromText(`${job.title} ${job.skills.join(' ')}`);
          return estimatedYears >= experienceRange.min && estimatedYears <= experienceRange.max + 2;
        })()
      : true;
    const remoteMatch = remoteOnly ? job.type.toLowerCase().includes('remote') || job.location.toLowerCase().includes('remote') : true;
    const atsMatch = atsReadyOnly ? job.match >= 80 : true;
    const postedMatch = postedIn24hOnly ? isWithinLast24Hours(job.postedAt) : true;
    const salaryMatch = salaryListedOnly ? job.salary !== 'Competitive' : true;
    return roleMatch && locationMatch && experienceMatch && remoteMatch && atsMatch && postedMatch && salaryMatch;
  };

  const mergeById = (jobList: JobItem[]) => {
    const seen = new Set<string>();
    return jobList.filter((job) => {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const searchJobs = async () => {
    setIsLoading(true);
    setApiError(null);
    const expRange = parseExperienceRange(level);
    try {
      const backendFilters: JobFilters = {
        keyword: query.trim() || undefined,
        location: location.trim() || undefined,
        remoteType: remoteOnly ? 'remote' : undefined,
        experienceLevel: mapExperienceLevel(level),
        salaryMin: salaryListedOnly ? 1 : undefined,
        page: 1,
        limit: 24,
      };

      const response = await backendApi.listJobs(backendFilters);
      const backendJobs = Array.isArray(response.items) ? response.items.map(mapBackendJobToUiJob) : [];
      const filteredLive = mergeById(backendJobs).filter((job) => jobMatchesFilters(job, query, location, expRange));
      const filteredCurated = fallbackJobs.filter((job) => jobMatchesFilters(job, query, location, expRange));
      const blended = mergeById([...filteredLive, ...filteredCurated]).slice(0, 16);

      if (blended.length === 0) {
        const relaxedLive = mergeById(backendJobs).filter((job) => jobMatchesFilters(job, query, '', null));
        const relaxedCurated = fallbackJobs.filter((job) => jobMatchesFilters(job, query, '', null));
        const closestMatches = mergeById([...relaxedLive, ...relaxedCurated]).slice(0, 16);

        if (closestMatches.length > 0) {
          setApiError('No exact results found. Showing closest matches.');
          setJobs(closestMatches);
        } else {
          setApiError('No exact results found. Showing recommended jobs.');
          setJobs(fallbackJobs);
        }
      } else {
        if (filteredLive.length === 0) {
          setApiError('Backend returned limited matches for this filter. Showing blended results.');
        } else {
          setApiError(null);
        }
        setJobs(blended);
      }
    } catch {
      const filteredCurated = fallbackJobs.filter((job) => jobMatchesFilters(job, query, location, expRange));
      setApiError(null);
      setJobs(filteredCurated.length > 0 ? filteredCurated : fallbackJobs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void searchJobs();
  }, []);

  useEffect(() => {
    void searchJobs();
  }, [remoteOnly, atsReadyOnly, postedIn24hOnly, salaryListedOnly]);

  const toggleSaveJob = async (jobId: string) => {
    const isSaved = savedJobs.includes(jobId);

    if (isSaved) {
      setSavedJobs((prev) => prev.filter((id) => id !== jobId));
      return;
    }

    if (jobId.startsWith('local-')) {
      setSavedJobs((prev) => [...prev, jobId]);
      setApiError('Saved locally. This demo job is not part of backend data.');
      return;
    }

    const token = accessToken ?? getStoredAccessToken();
    if (!token) {
      setApiError('Please login first to save jobs to your account.');
      return;
    }

    try {
      await backendApi.saveJob(jobId, token);
      setSavedJobs((prev) => [...prev, jobId]);
      setApiError(null);
    } catch (saveError) {
      setApiError(saveError instanceof Error ? saveError.message : 'Failed to save job');
    }
  };

  const openApplyModal = (job: JobItem) => {
    setActiveJob(job);
    setApplySuccessMessage(null);
    setApiError(null);
    setShowApplyModal(true);
  };

  const closeApplyModal = () => {
    setShowApplyModal(false);
    setActiveJob(null);
    setIsApplying(false);
    setApplySuccessMessage(null);
  };

  const submitApplication = async () => {
    if (!activeJob) return;
    setIsApplying(true);
    setApiError(null);
    setApplySuccessMessage(null);

    if (activeJob.id.startsWith('local-')) {
      setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'applied' }));
      setApplySuccessMessage(`Application submitted for ${activeJob.title} at ${activeJob.company}.`);
      setIsApplying(false);
      return;
    }

    const token = accessToken ?? getStoredAccessToken();
    if (!token) {
      setApiError('Please login first to apply from your account.');
      setIsApplying(false);
      return;
    }

    try {
      await backendApi.applyToJob(activeJob.id, token);
      setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'applied' }));
      setApplySuccessMessage(`Application submitted for ${activeJob.title} at ${activeJob.company}.`);
    } catch (applyError) {
      setApiError(applyError instanceof Error ? applyError.message : 'Failed to apply');
      setIsApplying(false);
      return;
    }
    setIsApplying(false);
  };

  const interviewCount = Object.values(appliedJobs).filter((status) => status === 'interview').length;
  const appliedCount = Object.keys(appliedJobs).length;

  return (
    <Section title="Job finder" kicker="Find and apply faster">
      <div className="rounded-[30px] border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff8f8_45%,#f7fafc_100%)] p-6 shadow-[0_20px_54px_rgba(15,23,42,0.08)] md:p-8">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Role or keyword (e.g., Product Manager)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Experience level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <button
            onClick={searchJobs}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search Jobs
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { label: 'Remote only', active: remoteOnly, toggle: () => setRemoteOnly((v) => !v) },
            { label: 'ATS-ready fit', active: atsReadyOnly, toggle: () => setAtsReadyOnly((v) => !v) },
            { label: 'Applied in last 24h', active: postedIn24hOnly, toggle: () => setPostedIn24hOnly((v) => !v) },
            { label: 'Salary listed', active: salaryListedOnly, toggle: () => setSalaryListedOnly((v) => !v) },
          ].map((filterItem) => (
            <button
              key={filterItem.label}
              onClick={filterItem.toggle}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filterItem.active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Filter className="h-3.5 w-3.5" /> {filterItem.label}
            </button>
          ))}
        </div>
        {apiError && <p className="mt-4 text-sm font-medium text-amber-700">{apiError}</p>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">{job.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                    {job.companyUrl ? (
                      <a
                        href={job.companyUrl}
                        target="_self"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Building2 className="h-4 w-4" /> {job.company} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" /> {job.company}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>
                    <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="h-4 w-4" /> {job.type}</span>
                  </div>
                </div>
                <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {job.match}% Match
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-600">{skill}</span>
                ))}
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  {job.salary}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => openApplyModal(job)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Apply</button>
                {job.url && (
                  <a
                    href={job.url}
                    target="_self"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:border-emerald-300"
                  >
                    Apply on Company Site
                  </a>
                )}
                <button
                  onClick={() => toggleSaveJob(job.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
                >
                  <Bookmark className="h-4 w-4" />
                  {savedJobs.includes(job.id) ? 'Saved' : 'Save'}
                </button>
                <button onClick={() => navigate('/builder')} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Tailor Resume
                </button>
                <button onClick={() => navigate('/cover-letter')} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Generate Cover Letter
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Pipeline</p>
            <h3 className="mt-2 text-xl font-extrabold text-zinc-900">Application Tracker</h3>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Saved', value: savedJobs.length },
                { label: 'Applied', value: appliedCount },
                { label: 'Interview', value: interviewCount },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-black text-zinc-900">{item.value}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-bold text-zinc-900">AI Suggestions</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Add React Native to increase matches by 9%.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Update summary for leadership roles.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Create a remote-focused resume variant.</li>
            </ul>
            <button onClick={() => navigate('/builder')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Optimize Resume <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showApplyModal && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">One-click apply</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{activeJob.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{activeJob.company} - {activeJob.location}</p>
              </div>
              <button onClick={closeApplyModal} className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:text-zinc-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-600">
              {applySuccessMessage
                ? 'Your application has been recorded in the tracker for this role.'
                : 'Apply directly from here and update your tracker without downloading any text files.'}
            </div>
            {applySuccessMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                {applySuccessMessage}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={submitApplication}
                disabled={isApplying || !!applySuccessMessage}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying ? 'Applying...' : applySuccessMessage ? 'Applied' : 'Apply now'}
              </button>
              <button
                onClick={() => {
                  setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'interview' }));
                  closeApplyModal();
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
              >
                Mark as Interview
              </button>
              {activeJob.url && (
                <a href={activeJob.url} target="_self" className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Open Job Posting
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
};
