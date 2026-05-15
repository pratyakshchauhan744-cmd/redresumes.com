import { Fragment, useState } from 'react';
import { Check, ClipboardCheck, Layers, Search, SlidersHorizontal, Sparkles, Star, Wand2, X } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateVisualPreview } from '../components/TemplateVisualPreview';
import { templates } from '../data/templates';
import { premiumFeatures } from '../data/premiumFeatures';
import type { PremiumFeatureItem, TemplateItem } from '../types';
import { useNavigate } from 'react-router-dom';

export const HomePage = ({
  onUseTemplate,
}: {

  onUseTemplate: (template: TemplateItem) => void;
}) => {
  const navigate = useNavigate();
  const [activePremiumFeature, setActivePremiumFeature] = useState<PremiumFeatureItem | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const demoShareLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://redresumescom.vercel.app'}/r/example-resume`;

  const openPremiumFeature = (feature: PremiumFeatureItem) => {
    setActivePremiumFeature(feature);
  };

  const openTemplatePreview = (template: TemplateItem) => {
    setPreviewTemplate(template);
    setPreviewZoom(1);
  };
  const useTemplateAndOpenBuilder = (template: TemplateItem) => {
    onUseTemplate(template);
    navigate(`/builder?template=${encodeURIComponent(template.id)}`);
  };

  const closeTemplatePreview = () => {
    setPreviewTemplate(null);
    setPreviewZoom(1);
  };

  const zoomInPreview = () => setPreviewZoom((z) => Math.min(2.3, Number((z + 0.1).toFixed(2))));
  const zoomOutPreview = () => setPreviewZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))));
  const resetPreviewZoom = () => setPreviewZoom(1);

  const closePremiumFeature = () => {
    setActivePremiumFeature(null);
  };

  const handlePremiumAction = async () => {
    if (!activePremiumFeature) return;

    if (activePremiumFeature.id === 'resume-shareable-link' || activePremiumFeature.id === 'qr-code-resume') {
      closePremiumFeature();
      navigate('/builder');
      return;
    }

    closePremiumFeature();
    navigate(`/${activePremiumFeature.targetPage}`);
  };

  return (
    <div>
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 md:gap-12 md:py-20 md:items-center">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-xs md:tracking-[0.2em]">Professional Resume Builder</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-zinc-900 sm:text-4xl md:mt-4 md:text-5xl">
            Create a professional resume in minutes
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600 md:mt-4 md:text-lg">
            ATS-friendly resumes, beautiful templates, PDF download, and AI-powered writing help.
          </p>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap md:mt-8 md:gap-4">
            <PrimaryButton label="Create Resume" onClick={() => navigate('/builder')} />
            <SecondaryButton label="View Templates" onClick={() => navigate('/templates')} />
            <SecondaryButton label="Find Jobs" onClick={() => navigate('/job-finder')} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-zinc-500 md:mt-8 md:gap-4">
            {['ATS-friendly resumes', 'Easy customization', 'PDF export', 'Cover letters', 'AI suggestions', 'Recruiter-approved layouts'].map((item) => (
              <div key={item} className="flex min-w-0 items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 md:rounded-3xl md:p-8">
          <div className="rounded-xl border border-zinc-100 bg-white p-4 md:rounded-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900">Resume Preview</h3>
                <p className="text-xs text-zinc-500">Optimized for ATS + recruiters</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 md:px-3">92 ATS Score</span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-4 w-2/3 bg-zinc-100 rounded"></div>
              <div className="h-3 w-full bg-zinc-100 rounded"></div>
              <div className="h-3 w-5/6 bg-zinc-100 rounded"></div>
              <div className="h-3 w-4/6 bg-zinc-100 rounded"></div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-zinc-500">
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">AI Summary</div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">Job Match</div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">Skills</div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">Export PDF</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <Section title="How it works" kicker="Simple steps">
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {[
          { title: 'Choose a template', desc: 'Pick a layout that fits your role and industry.' },
          { title: 'Fill in your details', desc: 'Guided sections with AI suggestions.' },
          { title: 'Download and apply', desc: 'Export PDF and start applying.' },
        ].map((step, idx) => (
          <div key={step.title} className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <div className="text-sm font-semibold text-primary">Step {idx + 1}</div>
            <h3 className="text-lg font-bold text-zinc-900 mt-2">{step.title}</h3>
            <p className="text-zinc-500 mt-2">{step.desc}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Templates preview" kicker="Pick your style">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {templates.slice(0, 8).map((cat) => (
          <Fragment key={cat.id}>
            <TemplateCard template={cat} onUseTemplate={useTemplateAndOpenBuilder} onPreviewTemplate={openTemplatePreview} compact />
          </Fragment>
        ))}
      </div>
    </Section>

    <Section title="Features that make the difference" kicker="Built for outcomes">
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {
          [
            { icon: SlidersHorizontal, title: 'Drag-and-drop sections', desc: 'Reorder and organize with ease.' },
            { icon: Wand2, title: 'AI bullet-point writer', desc: 'Stronger impact with better verbs.' },
            { icon: Sparkles, title: 'Skills suggestions', desc: 'Role-relevant skills surfaced instantly.' },
            { icon: Search, title: 'Job description matching', desc: 'See keyword match and gaps.' },
            { icon: Layers, title: 'Multiple resume versions', desc: 'Tailor for each role with one click.' },
            { icon: ClipboardCheck, title: 'Resume score / ATS score', desc: 'Clear signals to improve fast.' },
          ]
        .map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <feature.icon className="h-5 w-5 text-primary md:h-6 md:w-6" />
            <h3 className="mt-3 font-semibold text-zinc-900">{feature.title}</h3>
            <p className="text-sm text-zinc-500 mt-2">{feature.desc}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Premium features" kicker="Upgrade">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {premiumFeatures.map((item) => (
          <button
            key={item.title}
            onClick={() => openPremiumFeature(item)}
            className="rounded-2xl border border-zinc-100 bg-white p-4 text-left transition hover:border-zinc-300 md:p-6"
          >
            <h3 className="font-semibold text-zinc-900">{item.title}</h3>
            <p className="text-sm text-zinc-500 mt-2">{item.desc}</p>
            <span className="mt-4 inline-flex text-sm font-semibold text-primary">Learn more</span>
          </button>
        ))}
      </div>
    </Section>

    <Section title="Trusted by job seekers" kicker="Results">
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {[
          { stat: '1.2M+', label: 'Resumes created' },
          { stat: '87%', label: 'Interview rate lift' },
          { stat: '4.9/5', label: 'Average rating' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <div className="text-2xl font-extrabold text-zinc-900 md:text-3xl">{item.stat}</div>
            <p className="text-zinc-500 mt-2">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:mt-8 md:grid-cols-3 md:gap-6">
        {[
          '"Clean, ATS-friendly, and helped me land interviews fast."',
          '"The AI suggestions made my bullets so much stronger."',
          '"Templates are sleek and recruiter-approved."',
        ].map((quote) => (
          <div key={quote} className="rounded-2xl border border-zinc-100 bg-white p-4 text-sm text-zinc-600 md:p-6">
            {quote}
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <Star className="w-4 h-4 text-primary" /> Verified user
            </div>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Frequently asked questions" kicker="FAQ">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {
          [
            { q: 'Is it free?', a: 'Yes. You can build one resume for free with basic templates.' },
            { q: 'Can I download in PDF?', a: 'Yes. PDF export is included in every plan.' },
            { q: 'Is it ATS-friendly?', a: 'All templates are tested for ATS parsing.' },
            { q: 'Can I create multiple resumes?', a: 'Premium users can create unlimited versions.' },
            { q: 'Can I edit later?', a: 'Yes. Your documents are saved to your dashboard.' },
          ]
        .map((item) => (
          <div key={item.q} className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <h3 className="font-semibold text-zinc-900">{item.q}</h3>
            <p className="text-sm text-zinc-500 mt-2">{item.a}</p>
          </div>
        ))}
      </div>
    </Section>

    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-stretch justify-between gap-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-5 md:flex-row md:items-center md:gap-6 md:rounded-3xl md:p-10">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 md:text-2xl">Ready to build a better resume?</h3>
            <p className="text-zinc-600 mt-2">Create, optimize, and apply with confidence.</p>
          </div>
          <PrimaryButton label="Start for free" onClick={() => navigate('/builder')} />
        </div>
      </div>
    </section>
    {previewTemplate && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/70 p-0 md:p-4" onClick={closeTemplatePreview}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-template-preview-title"
          className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-zinc-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.4)] md:h-[92vh] md:rounded-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="z-10 flex items-start justify-between gap-2 border-b border-zinc-200 bg-white/95 px-3 py-3 md:px-6 md:py-5">
            <div className="min-w-0 pt-1">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-zinc-400 md:text-xs md:tracking-[0.2em]">Full Resume Preview</p>
              <h3 id="home-template-preview-title" className="mt-1 truncate text-lg font-black tracking-tight text-zinc-900 md:text-2xl">{previewTemplate.name}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              <button
                type="button"
                onClick={zoomOutPreview}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 md:h-11 md:w-11 md:text-base"
                aria-label="Zoom out"
              >
                -
              </button>
              <button
                type="button"
                onClick={resetPreviewZoom}
                className="h-9 rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-500 md:h-11 md:px-4 md:text-sm"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomInPreview}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 md:h-11 md:w-11 md:text-base"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={closeTemplatePreview}
                autoFocus
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:text-zinc-900 md:h-11 md:w-11"
                aria-label="Close preview"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-zinc-100 p-2 md:p-4">
            <div className="mx-auto h-full w-full max-w-5xl overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 md:p-4">
              <div className="mx-auto w-full min-w-[280px] max-w-[960px]">
                <div className="rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                  <TemplateVisualPreview template={previewTemplate} />
                </div>
              </div>
            </div>
          </div>
          <div className="z-10 grid gap-3 border-t border-zinc-200 bg-white p-4 sm:flex sm:flex-wrap md:p-6">
            <button
              onClick={() => {
                useTemplateAndOpenBuilder(previewTemplate);
                closeTemplatePreview();
              }}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Use this template
            </button>
            <button
              onClick={closeTemplatePreview}
              className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    {activePremiumFeature && (
      <div className="fixed inset-0 z-[70] bg-black/40 px-4 py-6 flex items-center justify-center" onClick={closePremiumFeature}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-feature-title"
          className="w-full max-w-xl rounded-2xl bg-white border border-zinc-200 p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Premium feature</p>
              <h3 id="premium-feature-title" className="text-2xl font-bold text-zinc-900 mt-2">{activePremiumFeature.title}</h3>
            </div>
            <button
              onClick={closePremiumFeature}
              autoFocus
              className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
              aria-label="Close feature dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-zinc-600">{activePremiumFeature.detail}</p>

          {activePremiumFeature.id === 'resume-shareable-link' && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="text-zinc-500">Demo share link</p>
              <p className="mt-1 font-medium text-zinc-900 break-all">{demoShareLink}</p>
            </div>
          )}

          {activePremiumFeature.id === 'qr-code-resume' && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="text-zinc-500">QR destination preview</p>
              <p className="mt-1 font-medium text-zinc-900 break-all">{demoShareLink}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handlePremiumAction}
              className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition"
            >
              {activePremiumFeature.id === 'resume-shareable-link' || activePremiumFeature.id === 'qr-code-resume'
                ? 'Open in builder'
                : 'Open feature'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
