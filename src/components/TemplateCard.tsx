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
    <div className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white p-4 md:p-5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-2 hover:border-zinc-300 hover:shadow-[0_28px_80px_rgba(15,23,42,0.16)]">
      <div className={`relative overflow-hidden rounded-[26px] border border-zinc-200 p-3 ${tone.shell} ${compact ? 'h-40' : 'h-52 sm:h-56'}`}>
        <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 sm:right-4 sm:top-4">
          <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] shadow-sm sm:px-3 sm:text-[0.68rem] ${tone.chip}`}>
            {template.tag}
          </span>
        </div>
        <div className={`relative h-full w-full overflow-hidden rounded-[20px] border border-white/80 ${tone.preview} shadow-[0_20px_44px_rgba(15,23,42,0.12)]`}>
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
      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="min-w-0 text-[1.45rem] leading-[0.95] font-black tracking-[-0.05em] text-zinc-950 sm:text-[1.7rem] md:text-[2.15rem]">
              {template.name}
            </h3>
            <p className="mt-3 max-w-[18ch] text-[0.95rem] font-medium leading-[1.4] tracking-[-0.02em] text-zinc-500 md:text-[1rem]">
              {template.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPreviewTemplate?.(template)}
            className={`shrink-0 rounded-2xl px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${tone.accent} bg-white/85 shadow-sm md:text-xs`}
          >
            Preview
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {traits.map((trait) => (
            <span key={trait} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[0.72rem] font-semibold text-zinc-600">
              {trait}
            </span>
          ))}
        </div>
        <button
          onClick={() => onUseTemplate(template)}
          className="mt-auto pt-6 text-left"
        >
          <span className="inline-flex items-center rounded-full bg-primary px-5 py-3 text-[0.98rem] font-extrabold tracking-[-0.03em] text-white shadow-[0_14px_30px_rgba(177,18,23,0.24)] transition group-hover:translate-x-0.5">
            Use template
          </span>
        </button>
      </div>
    </div>
  );
};
