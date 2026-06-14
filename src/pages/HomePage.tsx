import { Fragment, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Check, ClipboardCheck, Layers, Search, SlidersHorizontal, Sparkles, Star, Wand2, X, Video, Mic, Volume2, Bot, Cpu, Zap, BarChart3 } from 'lucide-react';
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
      <Helmet>
        <title>RedResumes — Free ATS Resume Builder</title>
      </Helmet>
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
                <h2 className="font-semibold text-zinc-900">Resume Preview</h2>
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

    <section className="relative overflow-hidden py-16 bg-gradient-to-b from-white via-zinc-50/50 to-white dark:from-zinc-950 dark:via-zinc-900/30 dark:to-zinc-950">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-0 w-72 h-72 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-center">
          
          {/* Left: Text Details & Info */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[0.68rem] font-bold tracking-wider uppercase text-primary border border-rose-100 shadow-sm dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                AI Interview Simulator
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Practice Speaking to Top Hiring Managers
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                Don't just write a resume—practice presenting it. Our Google Meet-style simulation replicates live interviews, analyzing your speech patterns, pacing, and answers dynamically based on your target role and resume details.
              </p>
            </div>

            {/* Features Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Cpu,
                  title: "Resume-Tailored",
                  desc: "AI extracts achievements from your resume to generate relevant question paths."
                },
                {
                  icon: Bot,
                  title: "Company Simulation",
                  desc: "Practice with custom interview styles for Google, Meta, Stripe, or YC startups."
                },
                {
                  icon: Zap,
                  title: "Stress Interview Mode",
                  desc: "Toggle stress settings to practice staying calm under challenging follow-ups."
                },
                {
                  icon: BarChart3,
                  title: "Detailed Report",
                  desc: "Get scorecards, transcript analysis, clarity checks, and actionable coaching tips."
                },
              ].map((item) => (
                <div 
                  key={item.title} 
                  className="group relative rounded-2xl border border-zinc-150/70 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/50 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20 text-primary mb-3">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{item.title}</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/interview/setup')}
                className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-200"
              >
                Try Practice Interview
                <Sparkles className="w-4 h-4 text-rose-200 animate-pulse" />
              </button>
            </div>
          </div>

          {/* Right: Premium Mock Video Interface */}
          <div className="lg:col-span-7 relative">
            {/* Background Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-rose-500/10 rounded-3xl blur-2xl opacity-50 pointer-events-none" />

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
              
              {/* Header/Controls Bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-medium text-zinc-200">Google Meet - Mock Interview Room</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono">08:14</span>
                  <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                    REC
                  </span>
                </div>
              </div>

              {/* Flex Row Container containing Feeds & Copilot Sidebar */}
              <div className="flex flex-col sm:flex-row bg-zinc-950 flex-1 min-h-[280px]">
                
                {/* Video Feeds Grid (left-side) */}
                <div className="flex-1 p-3 grid gap-3 grid-cols-2">
                  
                  {/* Interviewer feed */}
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/50 flex flex-col items-center justify-center p-4">
                    {/* Status Indicator */}
                    <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur px-2 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-300 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Hiring Manager (Google)
                    </div>
                    
                    {/* Speaker waveform indicator */}
                    <div className="absolute top-2 right-2 z-10 bg-zinc-950/80 backdrop-blur p-1 rounded-full border border-zinc-800">
                      <Volume2 className="h-3 w-3 text-primary" />
                    </div>

                    {/* AI Recruiter Visual representation */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 border border-primary/20">
                        <Bot className="h-6 w-6 text-primary" />
                        {/* Animated waves */}
                        <div className="absolute -inset-1.5 rounded-full border border-primary/20 animate-ping opacity-40" />
                        <div className="absolute -inset-3 rounded-full border border-primary/10 animate-[ping_2s_infinite] opacity-20" />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                        Speaking
                        <span className="flex items-end gap-0.5 h-2">
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_300ms] h-1/2" />
                          <span className="w-0.5 bg-primary rounded-full animate-[bounce_0.8s_infinite_200ms] h-3/4" />
                        </span>
                      </span>
                    </div>

                    {/* Live speech bubble */}
                    <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-zinc-800/80 rounded-lg p-2 shadow-lg text-[10px] leading-relaxed text-zinc-200">
                      <p className="font-bold text-primary mb-0.5">Interviewer:</p>
                      "Could you explain how you optimized the database connection pool in your scaling project?"
                    </div>
                  </div>

                  {/* Candidate Feed */}
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-900/50 flex flex-col items-center justify-center p-4">
                    {/* Status Indicator */}
                    <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur px-2 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-300 flex items-center gap-1.5">
                      <Video className="h-2.5 w-2.5 text-zinc-400" />
                      You (Candidate)
                    </div>

                    {/* Mic Indicator */}
                    <div className="absolute top-2 right-2 z-10 bg-zinc-950/80 backdrop-blur p-1 rounded-full border border-zinc-800">
                      <Mic className="h-3 w-3 text-emerald-400" />
                    </div>

                    {/* Candidate visual representation: Face landmarks scanning grid */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center relative overflow-hidden">
                        <svg className="w-8 h-8 text-emerald-500/40 animate-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                          <circle cx="50" cy="40" r="14" strokeWidth="1"/>
                          <circle cx="43" cy="35" r="1.2" fill="currentColor"/>
                          <circle cx="57" cy="35" r="1.2" fill="currentColor"/>
                          <path d="M43 45 Q50 50 57 45" strokeWidth="1"/>
                          <line x1="50" y1="26" x2="50" y2="15" strokeWidth="0.5"/>
                          <circle cx="50" cy="15" r="1.5" fill="currentColor"/>
                          <circle cx="25" cy="40" r="1.5" fill="currentColor"/>
                          <circle cx="75" cy="40" r="1.5" fill="currentColor"/>
                          <circle cx="50" cy="65" r="1.5" fill="currentColor"/>
                          <line x1="50" y1="40" x2="50" y2="65" strokeWidth="0.5"/>
                        </svg>
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Scanning Presentation Clarity
                      </span>
                    </div>

                    {/* Live response bubble */}
                    <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-zinc-800/80 rounded-lg p-2 shadow-lg text-[10px] leading-relaxed text-zinc-200">
                      <p className="font-bold text-emerald-400 mb-0.5">You:</p>
                      "Sure, we implemented Redis caching for the hot path and fine-tuned our pool size to prevent spikes..."
                    </div>
                  </div>

                </div>

                {/* AI Copilot Side Dashboard panel */}
                <div className="w-full sm:w-48 border-t sm:border-t-0 sm:border-l border-zinc-800 bg-zinc-900/40 p-4 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <span>AI Analysis</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live
                    </span>
                  </div>

                  <div className="space-y-3 flex-1">
                    
                    {/* Clarity Score Card */}
                    <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-2.5">
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Clarity Score</span>
                        <span className="font-bold text-emerald-400">94%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
                      </div>
                    </div>

                    {/* Speech Pace */}
                    <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-2.5">
                      <div className="text-[10px] text-zinc-400 mb-0.5">Speech Pace</div>
                      <div className="text-sm font-bold text-zinc-200">125 WPM</div>
                      <div className="mt-1 inline-flex text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        Optimal Range
                      </div>
                    </div>

                    {/* Confidence Check */}
                    <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-2.5">
                      <div className="text-[10px] text-zinc-400 mb-0.5">Clarity Rating</div>
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Excellent
                      </div>
                    </div>

                  </div>
                  
                  {/* Small recommendation */}
                  <div className="text-[9px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-2.5">
                    💡 **AI Suggestion:** Keep detailed metrics in your explanation. Good job so far!
                  </div>
                </div>

              </div>

              {/* Bottom Meeting Controls Bar */}
              <div className="bg-zinc-900/90 border-t border-zinc-800 px-4 py-3 flex items-center justify-center gap-4">
                <button aria-label="Mute mic" className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 border border-zinc-700/50 transition">
                  <Mic className="h-4 w-4" />
                </button>
                <button aria-label="Stop video" className="h-8 w-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 border border-zinc-700/50 transition">
                  <Video className="h-4 w-4" />
                </button>
                <button className="h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 transition shadow-md shadow-red-600/10">
                  End Practice
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>

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
          { stat: '500+', label: 'Resumes created' },
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
            { q: 'Is RedResumes completely free?', a: 'Yes. RedResumes is 100% free to use. You can build, edit, and download your resume as a PDF without paying anything or entering a credit card.' },
            { q: 'Does RedResumes pass ATS (applicant tracking systems)?', a: 'Yes. Every template is built with clean, ATS-friendly formatting — no tables, graphics, or unusual fonts that confuse ATS scanners used by recruiters.' },
            { q: 'How long does it take to build a resume?', a: 'Most users finish a polished resume in under 15 minutes using our AI-powered writing assistant and pre-filled templates.' },
            { q: 'Do I need to create an account?', a: 'No account or sign-up required. Start building immediately and download your resume when you\'re ready.' },
          ]
        .map((item) => (
          <div key={item.q} className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <h3 className="font-semibold text-zinc-900">{item.q}</h3>
            <p className="text-sm text-zinc-500 mt-2">{item.a}</p>
          </div>
        ))}
      </div>
    </Section>

    <section aria-label="About RedResumes" className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold leading-tight text-zinc-900 md:text-4xl">About RedResumes</h2>
        <div className="mt-6 md:mt-10 rounded-2xl border border-zinc-100 bg-white p-6 md:p-8 text-zinc-600 leading-relaxed text-sm shadow-sm">
          <p>
            RedResumes is a free online resume builder designed to help job seekers create
            ATS-friendly resumes quickly and without design expertise. Users fill in their
            work history, education, and skills through a guided step-by-step interface,
            then choose from professionally designed templates optimized for applicant
            tracking systems. An AI writing assistant suggests bullet points and professional
            summary language based on the user's experience and target role. Finished resumes
            can be exported as PDF files and submitted directly to job listings on platforms
            like LinkedIn, Indeed, and Glassdoor. Unlike many resume builders that require a
            paid subscription to download the finished document, RedResumes provides PDF
            export free of charge, making it a cost-accessible option for job seekers at
            any career stage.
          </p>
        </div>
      </div>
    </section>

    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-stretch justify-between gap-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-5 md:flex-row md:items-center md:gap-6 md:rounded-3xl md:p-10">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 md:text-2xl">Ready to build a better resume?</h2>
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
              <h2 id="home-template-preview-title" className="mt-1 truncate text-lg font-black tracking-tight text-zinc-900 md:text-2xl">{previewTemplate.name}</h2>
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
              <h2 id="premium-feature-title" className="text-2xl font-bold text-zinc-900 mt-2">{activePremiumFeature.title}</h2>
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
