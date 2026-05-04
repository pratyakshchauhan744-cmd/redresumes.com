import { Fragment, useState } from 'react';
import { X } from 'lucide-react';
import { Section } from '../components/Section';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateResumePage } from '../components/TemplateResumePage';
import { templates } from '../data/templates';
import type { TemplateItem } from '../types';
import { useNavigate } from 'react-router-dom';

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
    <Section title="Resume templates" kicker="Templates">
      <div className="mb-10 rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,#fff_0%,#fff8f8_52%,#f8fafc_100%)] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Curated Library</p>
            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Browse recruiter-friendly layouts for every stage, from first-job applications to leadership roles. Each preview
              reflects the actual document feel, so picking a template feels closer to choosing a finished product.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { value: String(templates.length), label: 'Layouts' },
              { value: 'ATS', label: 'Ready' },
              { value: 'PDF', label: 'Export' },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-zinc-200 bg-white/90 px-4 py-5">
                <div className="text-2xl font-black tracking-[-0.06em] text-zinc-950">{item.value}</div>
                <div className="mt-1 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-zinc-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((tpl) => (
          <Fragment key={tpl.id}>
            <TemplateCard template={tpl} onUseTemplate={useTemplateAndOpenBuilder} onPreviewTemplate={openPreview} />
          </Fragment>
        ))}
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/78 p-0 md:p-4">
          <div className="flex h-full w-full flex-col border-zinc-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.4)] md:h-[95vh] md:max-w-[96vw] md:rounded-3xl md:border">
            <div className="flex items-start justify-between gap-4">
              <div className="px-5 pt-5 md:px-6 md:pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Full Resume Preview</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{previewTemplate.name}</h3>
              </div>
              <div className="flex items-center gap-2 px-5 pt-5 md:px-6 md:pt-6">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:text-zinc-900"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-hidden rounded-none border-y border-zinc-200 bg-zinc-100 px-2 py-3 md:mx-6 md:rounded-2xl md:border md:px-3">
              <div className="h-full overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mx-auto flex w-full min-w-fit justify-center">
                  <div
                    className="rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
                    style={{ width: `${Math.round(960 * previewZoom)}px` }}
                  >
                    <TemplateResumePage template={previewTemplate} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-5 py-4 md:px-6 md:pb-6">
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
                className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
};
