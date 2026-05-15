import type { TemplateItem } from '../types';
import { templateCardTone, templateQuickTraits } from '../data/templates';

export const TemplateCard = ({
  template,
  onUseTemplate,
  onPreviewTemplate,
  compact = false,
}: {
  template: TemplateItem;
  onUseTemplate: (template: TemplateItem) => void;
  onPreviewTemplate?: (template: TemplateItem) => void;
  compact?: boolean;
}) => {
  const tone = templateCardTone[template.id] ?? {
    accent: 'text-primary',
    shell: 'bg-[linear-gradient(160deg,#fff7f7_0%,#f8fafc_100%)]',
    chip: 'border-primary/10 bg-primary/5 text-primary',
    preview: 'bg-white',
  };
  const traits = templateQuickTraits[template.id] ?? ['Readable layout', 'Recruiter-friendly'];

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:rounded-[32px] md:p-5">
      <div className={`relative overflow-hidden rounded-2xl border border-zinc-200 p-2.5 md:rounded-[26px] md:p-3 ${tone.shell} ${compact ? 'h-36 sm:h-40' : 'h-44 sm:h-56'}`}>
        <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:right-4 sm:top-4">
          <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] shadow-sm sm:px-3 sm:text-[0.68rem] ${tone.chip}`}>
            {template.tag}
          </span>
        </div>
        <div className={`relative h-full w-full overflow-hidden rounded-xl border border-white/80 md:rounded-[20px] ${tone.preview} shadow-[0_12px_30px_rgba(15,23,42,0.1)] md:shadow-[0_20px_44px_rgba(15,23,42,0.12)]`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/10" />
          <img
            src={template.image}
            alt={`${template.name} template preview`}
            loading="lazy"
            decoding="async"
            width={640}
            height={420}
            sizes={compact ? '(max-width: 768px) 80vw, 320px' : '(max-width: 768px) 90vw, 420px'}
            className="h-full w-full object-contain p-2 transition duration-500 group-hover:scale-[1.06]"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col md:mt-5">
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="min-w-0 text-[1.35rem] leading-none font-black tracking-tight text-zinc-950 sm:text-[1.7rem] md:text-[2.15rem] md:tracking-[-0.05em]">
              {template.name}
            </h3>
            <p className="mt-2 max-w-none text-sm font-medium leading-6 text-zinc-500 md:mt-3 md:max-w-[18ch] md:text-[1rem] md:tracking-[-0.02em]">
              {template.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPreviewTemplate?.(template)}
            className={`shrink-0 rounded-xl bg-white/85 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.14em] shadow-sm md:rounded-2xl md:text-xs ${tone.accent}`}
          >
            Preview
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
          {traits.map((trait) => (
            <span key={trait} className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[0.68rem] font-semibold text-zinc-600 md:px-3 md:py-1.5 md:text-[0.72rem]">
              {trait}
            </span>
          ))}
        </div>
        <button
          onClick={() => onUseTemplate(template)}
          className="mt-auto pt-4 text-left md:pt-6"
        >
          <span className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(177,18,23,0.2)] transition group-hover:translate-x-0.5 sm:w-auto md:px-5 md:py-3 md:text-[0.98rem] md:tracking-[-0.03em]">
            Use template
          </span>
        </button>
      </div>
    </div>
  );
};
