import { Fragment, useState } from 'react';
import { X } from 'lucide-react';
import { Section } from '../components/Section';
import { TemplateCard } from '../components/TemplateCard';
import { TemplatePreviewScaler } from '../components/TemplatePreviewScaler';
import { TemplateVisualPreview } from '../components/TemplateVisualPreview';
import { templates } from '../data/templates';
import type { TemplateItem } from '../types';
import { useNavigate } from 'react-router-dom';
import { Seo } from '../components/Seo';

export const TemplatesPage = ({ onUseTemplate }: { onUseTemplate: (template: TemplateItem) => void }) => {
  const navigate = useNavigate();
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const useTemplateAndOpenBuilder = (template: TemplateItem) => {
    onUseTemplate(template);
    navigate(`/builder?template=${encodeURIComponent(template.id)}`);
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setPreviewZoom(1);
  };

  const openPreview = (template: TemplateItem) => {
    setPreviewTemplate(template);
    setPreviewZoom(1);
  };

  const handleZoomIn = () => setPreviewZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))));
  const handleZoomOut = () => setPreviewZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))));
  const handleZoomReset = () => setPreviewZoom(1);

  return (
    <>
      <Seo
        title="Resume Templates | Professional & ATS-Ready | Red Resumes"
        description="Browse our hand-crafted collection of modern, professional, and creative resume templates. Optimized for applicant tracking systems."
      />
      <Section h1 title="Resume templates" kicker="Templates">
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-[linear-gradient(135deg,#fff_0%,#fff8f8_52%,#f8fafc_100%)] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-[linear-gradient(135deg,#18181b_0%,#111217_52%,#09090b_100%)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.24)] md:mb-10 md:rounded-[32px] md:p-8 md:shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary md:text-xs md:tracking-[0.24em]">Curated Library</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600 md:mt-4 md:text-lg md:leading-8">
                Browse recruiter-friendly layouts for every stage, from first-job applications to leadership roles. Each preview
                reflects the actual document feel, so picking a template feels closer to choosing a finished product.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center md:gap-3">
              {[
                { value: String(templates.length), label: 'Layouts' },
                { value: 'ATS', label: 'Ready' },
                { value: 'PDF', label: 'Export' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white/90 px-2 py-3 dark:border-zinc-700 dark:bg-zinc-900/80 md:rounded-[22px] md:px-4 md:py-5">
                  <div className="text-xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl md:tracking-[-0.06em]">{item.value}</div>
                  <div className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300 md:text-[0.72rem] md:tracking-[0.2em]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
          {templates.map((tpl) => (
            <Fragment key={tpl.id}>
              <TemplateCard template={tpl} onUseTemplate={useTemplateAndOpenBuilder} onPreviewTemplate={openPreview} />
            </Fragment>
          ))}
        </div>

        {previewTemplate && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/78 p-0 md:p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="templates-preview-title"
              className="flex h-full w-full flex-col overflow-hidden border-zinc-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.4)] dark:border-zinc-800 dark:bg-zinc-950 md:h-[95vh] md:max-w-[96vw] md:rounded-3xl md:border"
            >
              <div className="z-10 flex items-start justify-between gap-2 border-b border-zinc-200 bg-white/95 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/95 md:px-6 md:py-5">
                <div className="min-w-0 pt-1">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-zinc-400 md:text-xs md:tracking-[0.2em]">Full Resume Preview</p>
                  <h2 id="templates-preview-title" className="mt-1 truncate text-lg font-black tracking-tight text-zinc-900 md:mt-2 md:text-2xl">{previewTemplate.name}</h2>
                </div>
              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 md:h-11 md:w-11 md:text-base"
                  aria-label="Zoom out"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="h-9 rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 md:h-11 md:px-4 md:text-sm"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 md:h-11 md:w-11 md:text-base"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  autoFocus
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:text-white md:h-11 md:w-11"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-zinc-100 px-2 py-2 dark:bg-zinc-950 md:px-6 md:py-4">
              <div className="h-full overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 md:p-4">
                <div className="mx-auto w-full min-w-[280px] max-w-[1040px]">
                  <TemplatePreviewScaler zoom={previewZoom} pageWidth={960}>
                    <div className="rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                      <TemplateVisualPreview template={previewTemplate} />
                    </div>
                  </TemplatePreviewScaler>
                </div>
              </div>
            </div>

            <div className="z-10 grid gap-3 border-t border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex sm:flex-wrap md:px-6 md:pb-6">
              <button
                onClick={() => {
                  useTemplateAndOpenBuilder(previewTemplate);
                  closePreview();
                }}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Use this template
              </button>
              <button
                onClick={closePreview}
                className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
    </>
  );
};
