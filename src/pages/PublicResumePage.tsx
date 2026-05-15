import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, LoaderCircle } from 'lucide-react';
import { TemplatePreviewScaler } from '../components/TemplatePreviewScaler';
import { TemplateVisualPreview } from '../components/TemplateVisualPreview';
import { backendApi, type PublicResumeResponse } from '../lib/backendApi';
import { templates } from '../data/templates';
import type { TemplateResumeData } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

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
    certifications: toStringArray(value.certifications),
    languages: toStringArray(value.languages),
    hobbies: toStringArray(value.hobbies),
    achievements: toStringArray(value.achievements),
    volunteer: toStringArray(value.volunteer),
    customColumns: Array.isArray(value.customColumns)
      ? value.customColumns
          .filter(isObject)
          .map((item) => ({
            id: typeof item.id === 'string' ? item.id : `custom-${Math.random().toString(36).slice(2)}`,
            title: typeof item.title === 'string' ? item.title : '',
            content: typeof item.content === 'string' ? item.content : '',
          }))
      : [],
  };
};

export const PublicResumePage = () => {
  const { resumeId } = useParams();
  const [resume, setResume] = useState<PublicResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeId) {
      setError('Shared resume link is missing an ID.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    backendApi.getPublicResume(resumeId)
      .then(setResume)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load shared resume.'))
      .finally(() => setLoading(false));
  }, [resumeId]);

  const resumeData = useMemo(() => toResumeData(resume?.resumeData), [resume?.resumeData]);
  const template = templates.find((item) => item.id === resume?.templateId) ?? templates[0];

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
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Resume link unavailable</h1>
        <p className="mt-3 text-zinc-500">{error ?? 'This shared resume could not be opened.'}</p>
        <Link to="/builder" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
          Create a resume
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Shared resume</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{resumeData.fullName || 'Candidate Resume'}</h1>
            {resume.updatedAt && <p className="mt-1 text-sm text-zinc-500">Updated {new Date(resume.updatedAt).toLocaleDateString()}</p>}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 hover:border-primary hover:text-primary"
          >
            <Download className="h-4 w-4" />
            Print / save PDF
          </button>
        </div>

        <div className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <TemplatePreviewScaler pageWidth={760}>
            <TemplateVisualPreview template={template} data={resumeData} />
          </TemplatePreviewScaler>
        </div>
      </section>
    </div>
  );
};
