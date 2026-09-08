import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { RoleGuideResumeData } from '../../data/roleGuides';

export const RoleGuideResumeMockup = ({
  roleSlug,
  roleTitle,
  resumeData,
}: {
  roleSlug: string;
  roleTitle: string;
  resumeData: RoleGuideResumeData;
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleUseTemplate = () => {
    navigate(`/builder?example=${encodeURIComponent(roleSlug)}`);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(resumeData.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="resume-example" className="space-y-6 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
            {roleTitle} Resume Example
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Interactive, ATS-compliant sample resume layout. Adapt and edit in the builder.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-500" />}
            <span>{copied ? 'Summary Copied' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={handleUseTemplate}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-98"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Use This Template</span>
          </button>
        </div>
      </div>

      {/* Styled Paper Resume Mockup */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-300 bg-white p-6 sm:p-10 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {/* Floating Top-Right Action Banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            ATS Tested &bull; 95/100 Score
          </span>

          <button
            onClick={handleUseTemplate}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline dark:text-red-400"
          >
            <span>Open in Interactive Editor</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Structured Resume Content */}
        <article className="space-y-6 font-sans text-zinc-800 dark:text-zinc-200">
          {/* Header Section */}
          <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
            <h3 className="text-2xl font-black tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
              {resumeData.name}
            </h3>
            <p className="mt-1 text-sm font-bold text-primary dark:text-red-400">
              {resumeData.jobTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{resumeData.location}</span>
              <span>&bull;</span>
              <span>{resumeData.phone}</span>
              <span>&bull;</span>
              <span className="text-zinc-700 dark:text-zinc-300">{resumeData.email}</span>
              {resumeData.profileLink && (
                <>
                  <span>&bull;</span>
                  <span className="text-primary hover:underline">{resumeData.profileLink}</span>
                </>
              )}
            </div>
          </header>

          {/* Summary */}
          <section className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
              Professional Summary
            </h4>
            <p className="text-xs leading-relaxed text-zinc-700 sm:text-sm dark:text-zinc-300">
              {resumeData.summary}
            </p>
          </section>

          {/* Work Experience */}
          <section className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
              Professional Experience
            </h4>
            <div className="space-y-4">
              {resumeData.experience.map((exp, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {exp.title} &mdash; <span className="font-semibold text-zinc-700 dark:text-zinc-300">{exp.company}</span>
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {exp.dates}
                    </span>
                  </div>
                  <ul className="space-y-1 pl-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 list-disc">
                    {exp.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="leading-relaxed">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          <section className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
              Core Skills &amp; Competencies
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {resumeData.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
              Education
            </h4>
            <div className="space-y-1.5">
              {resumeData.education.map((edu, idx) => (
                <div key={idx} className="flex flex-wrap items-baseline justify-between gap-1 text-xs sm:text-sm">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {edu.degree} &mdash; <span className="font-normal text-zinc-600 dark:text-zinc-400">{edu.school}</span>
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{edu.year}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Projects & Certifications (if present) */}
          {((resumeData.projects && resumeData.projects.length > 0) || (resumeData.certifications && resumeData.certifications.length > 0)) && (
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              {resumeData.projects && resumeData.projects.length > 0 && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
                    Notable Projects
                  </h4>
                  {resumeData.projects.map((proj, pIdx) => (
                    <div key={pIdx} className="text-xs text-zinc-600 dark:text-zinc-300">
                      <strong className="text-zinc-900 dark:text-zinc-100">{proj.title}:</strong> {proj.description}
                    </div>
                  ))}
                </section>
              )}

              {resumeData.certifications && resumeData.certifications.length > 0 && (
                <section className="space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary dark:text-red-400">
                    Certifications
                  </h4>
                  <ul className="list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
                    {resumeData.certifications.map((cert, cIdx) => (
                      <li key={cIdx}>{cert}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </article>

        {/* Bottom Bar within Mockup */}
        <div className="mt-8 rounded-xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/60">
          <button
            onClick={handleUseTemplate}
            className="inline-flex items-center gap-2 font-bold text-primary hover:text-red-700 text-sm dark:text-red-400"
          >
            <span>Click here to customize and download this {roleTitle} resume in PDF</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
