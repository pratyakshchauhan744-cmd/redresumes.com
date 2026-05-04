import { Fragment, useState } from 'react';
import { Check, ClipboardCheck, Layers, Search, SlidersHorizontal, Sparkles, Star, Wand2, X } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateResumePage } from '../components/TemplateResumePage';
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
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const demoShareLink = 'https://redresumes.com/r/alex-morgan-ats';

  const openPremiumFeature = (feature: PremiumFeatureItem) => {
    setActivePremiumFeature(feature);
    setCopiedShareLink(false);
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
    setCopiedShareLink(false);
  };

  const handlePremiumAction = async () => {
    if (!activePremiumFeature) return;

    if (activePremiumFeature.id === 'resume-shareable-link') {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(demoShareLink);
          setCopiedShareLink(true);
        }
      } catch {
        setCopiedShareLink(false);
      }
      return;
    }

    closePremiumFeature();
    navigate(`/${activePremiumFeature.targetPage}`);
  };

  return (
    <div>
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Professional Resume Builder</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 mt-4">
            Create a professional resume in minutes
          </h1>
          <p className="text-zinc-600 mt-4 text-lg">
            ATS-friendly resumes, beautiful templates, PDF download, and AI-powered writing help.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <PrimaryButton label="Create Resume" onClick={() => navigate('/builder')} />
            <SecondaryButton label="View Templates" onClick={() => navigate('/templates')} />
            <SecondaryButton label="Find Jobs" onClick={() => navigate('/job-finder')} />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-zinc-500">
            {['ATS-friendly resumes', 'Easy customization', 'PDF export', 'Cover letters', 'AI suggestions', 'Recruiter-approved layouts'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-8">
          <div className="bg-white rounded-2xl p-6 border border-zinc-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">Resume Preview</h3>
                <p className="text-xs text-zinc-500">Optimized for ATS + recruiters</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-600">92 ATS Score</span>
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
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { title: 'Choose a template', desc: 'Pick a layout that fits your role and industry.' },
          { title: 'Fill in your details', desc: 'Guided sections with AI suggestions.' },
          { title: 'Download and apply', desc: 'Export PDF and start applying.' },
        ].map((step, idx) => (
          <div key={step.title} className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <div className="text-sm font-semibold text-primary">Step {idx + 1}</div>
            <h3 className="text-lg font-bold text-zinc-900 mt-2">{step.title}</h3>
            <p className="text-zinc-500 mt-2">{step.desc}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Templates preview" kicker="Pick your style">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {templates.slice(0, 8).map((cat) => (
          <Fragment key={cat.id}>
            <TemplateCard template={cat} onUseTemplate={useTemplateAndOpenBuilder} onPreviewTemplate={openTemplatePreview} compact />
          </Fragment>
        ))}
      </div>
    </Section>

    <Section title="Features that make the difference" kicker="Built for outcomes">
      <div className="grid md:grid-cols-3 gap-6">
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
          <div key={feature.title} className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <feature.icon className="w-6 h-6 text-primary" />
            <h3 className="font-semibold text-zinc-900 mt-3">{feature.title}</h3>
            <p className="text-sm text-zinc-500 mt-2">{feature.desc}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Premium features" kicker="Upgrade">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {premiumFeatures.map((item) => (
          <button
            key={item.title}
            onClick={() => openPremiumFeature(item)}
            className="border border-zinc-100 rounded-2xl p-6 bg-white text-left hover:border-zinc-300 transition"
          >
            <h3 className="font-semibold text-zinc-900">{item.title}</h3>
            <p className="text-sm text-zinc-500 mt-2">{item.desc}</p>
            <span className="mt-4 inline-flex text-sm font-semibold text-primary">Learn more</span>
          </button>
        ))}
      </div>
    </Section>

    <Section title="Trusted by job seekers" kicker="Results">
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { stat: '1.2M+', label: 'Resumes created' },
          { stat: '87%', label: 'Interview rate lift' },
          { stat: '4.9/5', label: 'Average rating' },
        ].map((item) => (
          <div key={item.label} className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <div className="text-3xl font-extrabold text-zinc-900">{item.stat}</div>
            <p className="text-zinc-500 mt-2">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-6">
        {[
          '"Clean, ATS-friendly, and helped me land interviews fast."',
          '"The AI suggestions made my bullets so much stronger."',
          '"Templates are sleek and recruiter-approved."',
        ].map((quote) => (
          <div key={quote} className="border border-zinc-100 rounded-2xl p-6 bg-white text-sm text-zinc-600">
            {quote}
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <Star className="w-4 h-4 text-primary" /> Verified user
            </div>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Frequently asked questions" kicker="FAQ">
      <div className="grid md:grid-cols-2 gap-6">
        {
          [
            { q: 'Is it free?', a: 'Yes. You can build one resume for free with basic templates.' },
            { q: 'Can I download in PDF?', a: 'Yes. PDF export is included in every plan.' },
            { q: 'Is it ATS-friendly?', a: 'All templates are tested for ATS parsing.' },
            { q: 'Can I create multiple resumes?', a: 'Premium users can create unlimited versions.' },
            { q: 'Can I edit later?', a: 'Yes. Your documents are saved to your dashboard.' },
          ]
        .map((item) => (
          <div key={item.q} className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <h3 className="font-semibold text-zinc-900">{item.q}</h3>
            <p className="text-sm text-zinc-500 mt-2">{item.a}</p>
          </div>
        ))}
      </div>
    </Section>

    <section className="py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="border border-zinc-100 rounded-3xl p-10 bg-zinc-50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">Ready to build a better resume?</h3>
            <p className="text-zinc-600 mt-2">Create, optimize, and apply with confidence.</p>
          </div>
          <PrimaryButton label="Start for free" onClick={() => navigate('/builder')} />
        </div>
      </div>
    </section>
    {previewTemplate && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/70 p-4" onClick={closeTemplatePreview}>
        <div
          className="w-full max-w-5xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_30px_100px_rgba(15,23,42,0.4)] md:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Full Resume Preview</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{previewTemplate.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={zoomOutPreview}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
              >
                -
              </button>
              <button
                type="button"
                onClick={resetPreviewZoom}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
              >
                {Math.round(previewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomInPreview}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
              >
                +
              </button>
              <button
                type="button"
                onClick={closeTemplatePreview}
                className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:text-zinc-900"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="mx-auto max-h-[70vh] w-full max-w-5xl overflow-auto rounded-xl border border-zinc-200 bg-white p-2">
              <div className="mx-auto rounded-lg border border-zinc-200 bg-white" style={{ width: `${Math.round(960 * previewZoom)}px` }}>
                <TemplateResumePage template={previewTemplate} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
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
          className="w-full max-w-xl rounded-2xl bg-white border border-zinc-200 p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Premium feature</p>
              <h3 className="text-2xl font-bold text-zinc-900 mt-2">{activePremiumFeature.title}</h3>
            </div>
            <button
              onClick={closePremiumFeature}
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
              {activePremiumFeature.id === 'resume-shareable-link'
                ? copiedShareLink
                  ? 'Link copied'
                  : 'Copy share link'
                : 'Open feature'}
            </button>
            <button
              onClick={() => {
                closePremiumFeature();
                navigate('/pricing');
              }}
              className="border border-zinc-300 text-zinc-900 px-5 py-2.5 rounded-full text-sm font-semibold hover:border-zinc-900 transition"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
