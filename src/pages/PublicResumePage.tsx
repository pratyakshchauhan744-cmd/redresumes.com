import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, LoaderCircle, Lock } from 'lucide-react';
import { TemplatePreviewScaler } from '../components/TemplatePreviewScaler';
import { TemplateVisualPreview } from '../components/TemplateVisualPreview';
import { backendApi, type PublicResumeResponse } from '../lib/backendApi';
import { readStoredUser } from '../lib/auth';
import { buildResumePdfHtmlFromElement, downloadResumePdfFromHtml } from '../lib/resumePdfDownload';
import { templates } from '../data/templates';
import type { TemplateResumeData } from '../types';
import { Seo } from '../components/Seo';

const LOCAL_PUBLIC_RESUMES_STORAGE_KEY = 'redresumes_local_public_resumes';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const getLocalPublicResume = (id: string): PublicResumeResponse | null => {
  try {
    const raw = window.localStorage.getItem(LOCAL_PUBLIC_RESUMES_STORAGE_KEY);
    if (!raw) return null;
    const records = JSON.parse(raw) as unknown;
    if (!isObject(records)) return null;
    const record = records[id];
    if (!isObject(record)) return null;
    return {
      id: typeof record.id === 'string' ? record.id : id,
      slug: typeof record.slug === 'string' ? record.slug : id,
      templateId: typeof record.templateId === 'string' ? record.templateId : 'modern',
      resumeData: record.resumeData,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    };
  } catch {
    return null;
  }
};

const toResumeData = (value: unknown): TemplateResumeData | null => {
  if (!isObject(value)) return null;

  return {
    fullName: typeof value.fullName === 'string' ? value.fullName : '',
    jobTitle: typeof value.jobTitle === 'string' ? value.jobTitle : '',
    email: typeof value.email === 'string' ? value.email : '',
    phone: typeof value.phone === 'string' ? value.phone : '',
    location: typeof value.location === 'string' ? value.location : '',
    profileLink: typeof value.profileLink === 'string' ? value.profileLink : '',
    summary: typeof value.summary === 'string' ? value.summary : '',
    skills: toStringArray(value.skills),
    educationItems: Array.isArray(value.educationItems)
      ? value.educationItems
          .filter(isObject)
          .map((item) => ({
            degree: typeof item.degree === 'string' ? item.degree : '',
            school: typeof item.school === 'string' ? item.school : '',
            year: typeof item.year === 'string' ? item.year : '',
          }))
      : undefined,
    educationDegree: typeof value.educationDegree === 'string' ? value.educationDegree : '',
    educationSchool: typeof value.educationSchool === 'string' ? value.educationSchool : '',
    educationYear: typeof value.educationYear === 'string' ? value.educationYear : '',
    bullets: toStringArray(value.bullets),
    experiences: Array.isArray(value.experiences)
      ? value.experiences
          .filter(isObject)
          .map((item) => ({
            title: typeof item.title === 'string' ? item.title : '',
            dates: typeof item.dates === 'string' ? item.dates : '',
            bullets: typeof item.bullets === 'string' ? item.bullets : '',
          }))
      : [],
    projects: toStringArray(value.projects),
    projectsDisplay: value.projectsDisplay === 'paragraph' || (!value.projectsDisplay && toStringArray(value.projects).length <= 1) ? 'paragraph' : 'list',
    certifications: toStringArray(value.certifications),
    languages: toStringArray(value.languages),
    hobbies: toStringArray(value.hobbies),
    achievements: toStringArray(value.achievements),
    volunteer: toStringArray(value.volunteer),
    listStyle: value.listStyle === 'number' ? 'number' : 'bullet',
    customColumns: Array.isArray(value.customColumns)
      ? value.customColumns
          .filter(isObject)
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : `custom-${Math.random().toString(36).slice(2)}`,
            title: typeof item.title === 'string' ? item.title : '',
            content: typeof item.content === 'string' ? item.content : '',
          }))
      : [],
    photoDataUrl: typeof value.photoDataUrl === 'string' ? value.photoDataUrl : '',
    sectionSelectionOrder: Array.isArray(value.sectionSelectionOrder)
      ? value.sectionSelectionOrder.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
};

export const PublicResumePage = () => {
  const { resumeId } = useParams();
  const [resume, setResume] = useState<PublicResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pdfDownloadLoading, setPdfDownloadLoading] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);
  const isLoggedIn = Boolean(readStoredUser());

  useEffect(() => {
    if (!resumeId) {
      setError('Shared resume link is missing an ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const localResume = getLocalPublicResume(resumeId);
    if (localResume) {
      setResume(localResume);
      setLoading(false);
      return;
    }

    backendApi.getPublicResume(resumeId)
      .then(setResume)
      .catch((err) => {
        const fallbackLocalResume = getLocalPublicResume(resumeId);
        if (fallbackLocalResume) {
          setResume(fallbackLocalResume);
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load shared resume.');
      })
      .finally(() => setLoading(false));
  }, [resumeId]);

  const resumeData = useMemo(() => toResumeData(resume?.resumeData), [resume?.resumeData]);
  const template = templates.find((item) => item.id === resume?.templateId) ?? templates[0];

  const handlePrintClick = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (pdfDownloadLoading) return;

    const resumeElement = document.querySelector<HTMLElement>('.public-resume-print-area .template-visual-preview');
    if (!resumeElement) {
      setPdfDownloadError('Unable to find resume preview. Please refresh and try again.');
      return;
    }

    const fileSlug = (resumeData?.fullName || resume?.slug || 'resume')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'resume';
    const fileName = `${fileSlug}-${template.id}-resume.pdf`;

    setPdfDownloadLoading(true);
    setPdfDownloadError(null);
    try {
      await downloadResumePdfFromHtml(buildResumePdfHtmlFromElement(resumeElement, fileName), fileName);
    } catch (err) {
      setPdfDownloadError(err instanceof Error ? err.message : 'Unable to generate PDF. Please try again.');
    } finally {
      setPdfDownloadLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-5 py-4 text-sm font-semibold text-zinc-600 shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          Loading shared resume...
        </div>
      </div>
    );
  }

  if (error || !resumeData) {
    return (
      <>
        <Seo title="Resume Unavailable | Red Resumes" description="This shared resume link is no longer active or could not be found." />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Resume link unavailable</h1>
          <p className="mt-3 text-zinc-500">{error ?? 'This shared resume could not be opened.'}</p>
          <Link to="/builder" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
            Create a resume
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo
        title={`${resumeData.fullName || 'Candidate Resume'} | Shared via Red Resumes`}
        description={`View ${resumeData.fullName || 'the candidate'}'s professional resume on Red Resumes. ATS-optimized layout with detailed skills, experience, and certifications.`}
      />
      <div className="public-resume-page bg-zinc-50">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="no-print mb-5 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Shared resume</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{resumeData.fullName || 'Candidate Resume'}</h1>
            {resume.updatedAt && <p className="mt-1 text-sm text-zinc-500">Updated {new Date(resume.updatedAt).toLocaleDateString()}</p>}
          </div>
          <button
            type="button"
            onClick={handlePrintClick}
            disabled={pdfDownloadLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfDownloadLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfDownloadLoading ? 'Downloading' : 'Download PDF'}
          </button>
        </div>
        {pdfDownloadError && <p className="no-print mb-4 text-sm font-semibold text-red-600">{pdfDownloadError}</p>}

        <div className="public-resume-print-shell overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="public-resume-print-area">
          <TemplatePreviewScaler pageWidth={760}>
            <TemplateVisualPreview template={template} data={resumeData} sectionOrder={resumeData?.sectionSelectionOrder} />
          </TemplatePreviewScaler>
          </div>
        </div>
      </section>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}>
          <div
            className="mx-4 w-full max-w-sm animate-[fadeInScale_0.25s_ease] rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="mt-5 text-center text-xl font-extrabold tracking-tight text-zinc-900 text-lg">Sign in to download</h2>
            <p className="mt-2 text-center text-sm leading-6 text-zinc-500">
              Create a free account or sign in to download this resume as PDF.
            </p>
            <Link
              to="/login"
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(177,18,23,0.22)] transition hover:opacity-90"
            >
              Sign in / Create account
            </Link>
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="mt-3 w-full rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
