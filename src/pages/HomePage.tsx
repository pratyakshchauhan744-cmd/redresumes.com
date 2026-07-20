import { Fragment, useState, useEffect } from 'react';
import { 
  Check, 
  ClipboardCheck, 
  Layers, 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  Star, 
  Wand2, 
  X, 
  Video, 
  Mic, 
  Volume2, 
  Bot, 
  Cpu, 
  Zap, 
  BarChart3, 
  ArrowRight,
  Lock,
  CheckCircle2,
  HelpCircle,
  Briefcase,
  Laptop,
  PenTool,
  GraduationCap
} from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TemplateCard } from '../components/TemplateCard';
import { TemplatePreviewScaler } from '../components/TemplatePreviewScaler';
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
  const [selectedRole, setSelectedRole] = useState<'freshers' | 'engineers' | 'designers' | 'experienced'>('engineers');
  const [showStickyCta, setShowStickyCta] = useState(false);
  const demoShareLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://redresumescom.vercel.app'}/r/example-resume`;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Templates mapping by role
  const roleTemplates = {
    freshers: ['fresher', 'minimal', 'academic'],
    engineers: ['technical', 'modern', 'startup', 'two-column'],
    designers: ['creative', 'designer'],
    experienced: ['professional', 'executive', 'consulting', 'corporate']
  };

  const rolesList = [
    { id: 'freshers', label: 'Freshers & Students', icon: GraduationCap },
    { id: 'engineers', label: 'Engineers', icon: Laptop },
    { id: 'designers', label: 'Designers & Creatives', icon: PenTool },
    { id: 'experienced', label: 'Experienced Professionals', icon: Briefcase },
  ] as const;

  const filteredTemplates = templates.filter(t => roleTemplates[selectedRole].includes(t.id));

  return (
    <div className="relative bg-white dark:bg-zinc-950 min-h-screen selection:bg-rose-500 selection:text-white">
      
      {/* Sticky Mobile CTA */}
      {showStickyCta && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 xl:hidden animate-fade-in-up">
          <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto px-4">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-50 truncate">RedResumes</p>
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">Free ATS builder + Premium AI interviews</p>
            </div>
            <button
              onClick={() => navigate('/builder')}
              className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition shrink-0"
            >
              Create resume free
            </button>
          </div>
        </div>
      )}

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24 border-b border-zinc-100 dark:border-zinc-900 bg-gradient-to-b from-zinc-50/50 via-white to-white dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/5 dark:bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-2 md:gap-16 items-center relative z-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[0.68rem] font-bold tracking-wider uppercase text-primary border border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Recruiter-Aware Platform
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-zinc-900 dark:text-white sm:text-5xl tracking-tight">
              Land More Interviews with a Recruiter-Approved Resume
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-lg">
              Free ATS resume builder with premium AI mock interviews. Fast, modern, and built to bypass filters so you get hired.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="shrink-0">
                <PrimaryButton label="Create resume free" onClick={() => navigate('/builder')} />
              </div>
              <div className="shrink-0">
                <SecondaryButton label="Practice mock interview" onClick={() => navigate('/interview/setup')} />
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              {[
                'ATS-friendly layouts',
                'Instantly export PDF',
                'AI-guided structure',
                'No card required'
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Visual Preview */}
          <div className="relative w-full flex items-center justify-center p-2 sm:p-4">
            {/* Background Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-rose-500/10 rounded-3xl blur-2xl opacity-40 pointer-events-none" />

            <div className="relative max-w-[420px] sm:max-w-[460px] hover:scale-[1.02] transition-all duration-300 pointer-events-auto">
              <img
                src="/hero-resumes-stack.png"
                alt="ATS Optimized Resume Templates Stack"
                loading="eager"
                data-darkreader-ignore="true"
                style={{ colorScheme: 'light' }}
                className="w-full h-auto object-contain"
              />

              {/* Floating Badges inside the frame */}
              {/* 92 ATS Score Badge */}
              <div className="absolute top-4 right-4 z-20 bg-emerald-500 text-white font-extrabold text-[10px] sm:text-xs px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full shadow-[0_4px_20px_rgba(16,185,129,0.4)] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>92 ATS Score</span>
              </div>
            </div>

            {/* Floating callouts positioned absolute relative to the outer container */}
            {/* Action Verbs Badge */}
            <div 
              style={{ animation: 'float-up-down 5s ease-in-out infinite' }}
              className="absolute bottom-[22%] -left-4 sm:left-4 z-20 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-2.5 sm:p-3 shadow-xl max-w-[130px] sm:max-w-[180px] pointer-events-none"
            >
              <p className="text-[9px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400">✓ Action Verbs Used</p>
              <p className="text-[8px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">"Optimized", "Scaled" bypass recruiter filters.</p>
            </div>

            {/* Metrics Included Badge */}
            <div 
              style={{ animation: 'float-down-up 5s ease-in-out infinite' }}
              className="absolute bottom-4 sm:bottom-8 -right-4 sm:right-4 z-20 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-2.5 sm:p-3 shadow-xl max-w-[130px] sm:max-w-[180px] pointer-events-none"
            >
              <p className="text-[9px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400">✓ Metrics Included</p>
              <p className="text-[8px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">Quantified bullet results grab attention.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 2. Trust Bar */}
      <section className="py-8 bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center">
            <div className="px-4 py-2">
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white">10,000+</p>
              <p className="mt-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Resumes built</p>
            </div>
            <div className="px-4 py-2 border-y sm:border-y-0 sm:border-x border-zinc-200/60 dark:border-zinc-800">
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white">4.9/5</p>
              <p className="mt-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Recruiter Rating ★★★★★</p>
            </div>
            <div className="px-4 py-2">
              <p className="text-3xl font-extrabold text-zinc-900 dark:text-white">87%</p>
              <p className="mt-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Interview Rate Lift</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Product Workflow Section */}
      <Section title="Structured path from blank page to hire" kicker="Career Workflow">
        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Build Resume',
              tier: 'Free',
              desc: 'Select a clean ATS template and fill details using guided prompt assistance.'
            },
            {
              step: '02',
              title: 'Improve ATS Score',
              tier: 'Free',
              desc: 'Scan formatting, spelling, and keywords to rank top of recruiter lists.'
            },
            {
              step: '03',
              title: 'Practice Interview',
              tier: 'Premium',
              desc: 'Simulate live company calls with voice feedback tailored to your exact resume.'
            },
            {
              step: '04',
              title: 'Apply Confidently',
              tier: 'Complete',
              desc: 'Submit PDF exports knowing you are fully prepared for behavioral questions.'
            }
          ].map((item) => (
            <div key={item.step} className="relative group rounded-2xl border border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-900/60 p-5 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <span className="text-3xl font-black text-zinc-200 dark:text-zinc-800 tracking-tight">{item.step}</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                  item.tier === 'Free' 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                    : item.tier === 'Premium' 
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                      : 'bg-zinc-500/10 text-zinc-500'
                }`}>
                  {item.tier}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Resume Builder Benefits (Free Tier) */}
      <section className="py-12 bg-zinc-50 dark:bg-zinc-900/20 border-y border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="md:flex md:items-center md:justify-between mb-8">
            <div className="max-w-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-xs">Free Tier features</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight text-zinc-900 dark:text-white md:text-3xl">
                100% Free Resume Builder. No hidden paywalls.
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Create recruiter-approved resumes without entering a credit card. Pay only when you choose to use advanced interview modules.
              </p>
            </div>
            <div className="mt-4 md:mt-0 shrink-0">
              <PrimaryButton label="Create resume free" onClick={() => navigate('/builder')} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: SlidersHorizontal,
                title: 'Drag-and-Drop Layouts',
                desc: 'Reorder experience blocks or structure section hierarchy in clicks.'
              },
              {
                icon: Wand2,
                title: 'AI Bullet-Point Assistant',
                desc: 'Optimize accomplishment bullets with stronger active recruiter verbs.'
              },
              {
                icon: Search,
                title: 'Job Match Analyzer',
                desc: 'Paste descriptions to check keywords alignment and close missing gaps.'
              },
              {
                icon: ClipboardCheck,
                title: 'PDF Resumes Export',
                desc: 'Download clean, parsed resumes styled to bypass tracking filters.'
              },
              {
                icon: Layers,
                title: 'QR Code & Web Links',
                desc: 'Share a digital version instantly with scannable layout features.'
              },
              {
                icon: Sparkles,
                title: 'Pre-filled Examples',
                desc: 'Accelerate writing with templates approved by tech recruiters.'
              }
            ].map((feature) => (
              <div key={feature.title} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-zinc-900 dark:text-white text-sm">{feature.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. AI Interview Simulator Benefits (Premium, Credit-based) */}
      <section className="relative overflow-hidden py-16 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
        <div className="absolute top-1/4 left-0 w-72 h-72 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-center">
            
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[0.68rem] font-bold tracking-wider uppercase text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
                  Premium Add-On
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                  Replicate Real Recruitment Screens with AI
                </h2>
                <p className="mt-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase">Uses Interview Credits</p>
                <p className="mt-4 text-sm leading-relaxed text-zinc-650 dark:text-zinc-400">
                  Writing the resume is step one. Real hiring happens on video. Our simulator acts as a Google Meet interview, using metrics extracted from your uploaded resume to target custom role questions.
                </p>
              </div>

              {/* Features Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Cpu,
                    title: "Resume-Tailored Qs",
                    desc: "Extracts achievements to test database depth or execution projects."
                  },
                  {
                    icon: Bot,
                    title: "Live Company Profiles",
                    desc: "Replicates technical bar from Google, Stripe, or YC startups."
                  },
                  {
                    icon: Zap,
                    title: "Pacing Analytics",
                    desc: "Measures words-per-minute speed and highlights speech hesitation."
                  },
                  {
                    icon: BarChart3,
                    title: "Performance Card",
                    desc: "Detailed coaching reports analyze clarity scorecards and metrics."
                  },
                ].map((item) => (
                  <div 
                    key={item.title} 
                    className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 shadow-sm transition-all duration-300"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-primary mb-3">
                      <item.icon className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{item.title}</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/interview/setup')}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-200"
                >
                  Practice mock interview
                  <ArrowRight className="w-4 h-4 text-rose-200" />
                </button>
              </div>
            </div>

            {/* Right: Mock Video Interface */}
            <div className="lg:col-span-7 relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-rose-500/10 rounded-3xl blur-2xl opacity-50 pointer-events-none" />

              <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
                
                {/* Header/Controls Bar */}
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium text-zinc-200">Google Meet - AI Simulator</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="bg-zinc-850 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-mono">08:14</span>
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
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center p-4">
                      <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur px-2 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-300 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Hiring Manager (Google)
                      </div>
                      
                      <div className="absolute top-2 right-2 z-10 bg-zinc-950/80 backdrop-blur p-1 rounded-full border border-zinc-800">
                        <Volume2 className="h-3 w-3 text-rose-500" />
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <div className="relative flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 border border-primary/20">
                          <Bot className="h-6 w-6 text-primary" />
                          <div className="absolute -inset-1.5 rounded-full border border-primary/20 animate-ping opacity-40" />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                          Speaking
                        </span>
                      </div>

                      {/* Live speech bubble */}
                      <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-zinc-800 rounded-lg p-2 shadow-lg text-[10px] leading-relaxed text-zinc-200">
                        <p className="font-bold text-primary mb-0.5">Interviewer:</p>
                        "Could you explain how you optimized the database connection pool in your scaling project?"
                      </div>
                    </div>

                    {/* Candidate Feed */}
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center p-4">
                      <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 backdrop-blur px-2 py-0.5 rounded border border-zinc-800 text-[9px] text-zinc-300 flex items-center gap-1.5">
                        <Video className="h-2.5 w-2.5 text-zinc-400" />
                        Candidate feed
                      </div>

                      <div className="absolute top-2 right-2 z-10 bg-zinc-950/80 backdrop-blur p-1 rounded-full border border-zinc-800">
                        <Mic className="h-3 w-3 text-emerald-400" />
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center relative overflow-hidden">
                          <svg className="w-8 h-8 text-emerald-500/40 animate-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                            <circle cx="50" cy="40" r="14" strokeWidth="1"/>
                            <circle cx="43" cy="35" r="1.2" fill="currentColor"/>
                            <circle cx="57" cy="35" r="1.2" fill="currentColor"/>
                            <path d="M43 45 Q50 50 57 45" strokeWidth="1"/>
                            <line x1="50" y1="26" x2="50" y2="15" strokeWidth="0.5"/>
                          </svg>
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500 flex items-center gap-1.5">
                          Presentation Clarity Scan
                        </span>
                      </div>

                      {/* Live response bubble */}
                      <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-zinc-800 rounded-lg p-2 shadow-lg text-[10px] leading-relaxed text-zinc-200">
                        <p className="font-bold text-emerald-400 mb-0.5">You:</p>
                        "Sure, we implemented Redis caching for the hot path and fine-tuned our pool size..."
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
                      
                      <div className="bg-zinc-950/50 border border-zinc-850 rounded-xl p-2.5">
                        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                          <span>Clarity Score</span>
                          <span className="font-bold text-emerald-400">94%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
                        </div>
                      </div>

                      <div className="bg-zinc-950/50 border border-zinc-850 rounded-xl p-2.5">
                        <div className="text-[10px] text-zinc-400 mb-0.5">Speech Pace</div>
                        <div className="text-sm font-bold text-zinc-200">125 WPM</div>
                        <div className="mt-1 inline-flex text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Optimal Range
                        </div>
                      </div>

                      <div className="bg-zinc-950/50 border border-zinc-850 rounded-xl p-2.5">
                        <div className="text-[10px] text-zinc-400 mb-0.5">Filler Words</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          Low (0.4%)
                        </div>
                      </div>

                    </div>
                    
                    <div className="text-[9px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-2.5">
                      💡 <strong>Suggestion:</strong> Keep detailed metrics in your explanation. Excellent job.
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
                  <button className="h-8 rounded-full bg-red-650 hover:bg-red-700 text-white text-xs font-bold px-4 transition shadow-md shadow-red-650/10">
                    End Session
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Free vs. Premium Comparison */}
      <Section title="Simple, Transparent Features Comparison" kicker="No Hidden Fees">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                  <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Platform Features</th>
                  <th className="px-6 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Free Tier</th>
                  <th className="px-6 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Premium / Add-Ons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                {[
                  { name: 'ATS Resume Builder & Customizer', free: true, premium: true },
                  { name: 'Export to Recruiter-Friendly PDF', free: true, premium: true },
                  { name: 'Professional Layout Templates', free: true, premium: true },
                  { name: 'AI Writing Prompts & Active Verb Hints', free: true, premium: true },
                  { name: 'Shareable Resume Public Link', free: true, premium: true },
                  { name: 'Resume Scannable QR Code Generator', free: true, premium: true },
                  { name: 'Job Match & Keyword Keyword Checks', free: true, premium: true },
                  { name: 'Personal Portfolio Web Link Generator', free: true, premium: true },
                  { name: 'AI Meet Mock Interview Simulation & Scoring', free: false, premium: 'Uses credits' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">{row.name}</td>
                    <td className="px-6 py-4 text-center">
                      {row.free ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" /> Free
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.premium === true ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5" /> Free
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          {row.premium}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 7. Resume Templates by Role */}
      <Section title="Pick a Template Tuned to Your Career Stage" kicker="Resume Templates">
        
        {/* Role tabs */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10">
          {rolesList.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedRole === role.id
                    ? 'bg-primary text-white shadow-md shadow-red-500/10'
                    : 'bg-zinc-100 hover:bg-zinc-150 text-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-350'
                }`}
              >
                <Icon className="h-4 w-4" />
                {role.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8">
          {filteredTemplates.map((cat) => (
            <Fragment key={cat.id}>
              <TemplateCard 
                template={cat} 
                onUseTemplate={useTemplateAndOpenBuilder} 
                onPreviewTemplate={openTemplatePreview} 
                compact 
              />
            </Fragment>
          ))}
        </div>
        <div className="mt-8 text-center">
          <SecondaryButton label="View all templates" onClick={() => navigate('/templates')} />
        </div>
      </Section>

      {/* 8. Testimonials / Proof */}
      <Section title="Helped professionals join top organizations" kicker="Verified outcomes">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              quote: "The ATS resume scanner pinpointed exactly why my application failed at the recruiter screen. Once I revised my bullet points with the AI assistant, I got 3 tech phone calls in a week.",
              author: "Deepak S.",
              title: "Software Engineer",
              rating: 5
            },
            {
              quote: "As a new graduate, I did not know how to handle behavioral interviews. Practicing with the AI simulator let me master my presentation pacing and remove filler words completely.",
              author: "Nisha M.",
              title: "Project Coordinator",
              rating: 5
            },
            {
              quote: "The corporate template helped me condense 10 years of experience into a clean format. Best of all, I exported the PDF without any credit card or hidden payment paywalls.",
              author: "Sarah K.",
              title: "Business Analyst",
              rating: 5
            }
          ].map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex gap-1 mb-4 text-amber-400">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-zinc-600 dark:text-zinc-300 text-sm italic leading-relaxed">
                  "{item.quote}"
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-zinc-900 dark:text-white text-xs">{item.author}</p>
                  <p className="text-zinc-400 dark:text-zinc-500 text-[10px] mt-0.5">{item.title}</p>
                </div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  ✓ Verified Hire
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 9. FAQ Section */}
      <Section title="Clear Answers to Common Questions" kicker="FAQ">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { 
              q: 'Is the RedResumes builder free?', 
              a: 'Yes. Customizing your resume, scanning keywords, and exporting as PDF is 100% free. No payment details are needed to save or export.' 
            },
            { 
              q: 'What requires interview credits?', 
              a: 'Only the premium voice-based AI mock interview simulator utilizes credits. Personal portfolio web generators are completely free.' 
            },
            { 
              q: 'How do I export my resume?', 
              a: 'When you are done editing inside the builder, click the "Download PDF" action to immediately save a recruiter-friendly file locally.' 
            },
            { 
              q: 'Will these templates pass ATS screens?', 
              a: 'Yes. Every template uses a clean single-column or standard multi-column structure without graphics, tables, or complex elements that block parser extraction.' 
            }
          ].map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6">
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm flex items-start gap-2">
                <HelpCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                {item.q}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2.5 pl-6 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Final CTA Banner */}
      <section className="py-12 md:py-20 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-rose-650 p-8 md:p-12 shadow-xl text-white">
            <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Ready to Secure Your Next Role?</h2>
              <p className="mt-4 text-base text-rose-100 leading-relaxed">
                Build your ATS resume for free, or practice your next hiring panel interview with premium AI simulator credits.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/builder')}
                  className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-zinc-900 shadow-md hover:bg-zinc-50 transition"
                >
                  Create resume free
                </button>
                <button
                  onClick={() => navigate('/interview/setup')}
                  className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold hover:bg-white/20 transition"
                >
                  Practice mock interview
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Template Preview Dialog */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/70 p-0 md:p-4" onClick={closeTemplatePreview}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-template-preview-title"
            className="flex h-full w-full max-w-5xl flex-col overflow-hidden border border-zinc-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.4)] dark:border-zinc-800 dark:bg-zinc-950 md:h-[92vh] md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="z-10 flex items-start justify-between gap-2 border-b border-zinc-200 bg-white/95 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/95 md:px-6 md:py-5">
              <div className="min-w-0 pt-1">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-zinc-400 md:text-xs md:tracking-[0.2em]">Full Resume Preview</p>
                <h2 id="home-template-preview-title" className="mt-1 truncate text-lg font-black tracking-tight text-zinc-900 dark:text-white md:text-2xl">{previewTemplate.name}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={zoomOutPreview}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-550 md:h-11 md:w-11 md:text-base"
                  aria-label="Zoom out"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={resetPreviewZoom}
                  className="h-9 rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-550 md:h-11 md:px-4 md:text-sm"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomInPreview}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-550 md:h-11 md:w-11 md:text-base"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={closeTemplatePreview}
                  autoFocus
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-250 text-zinc-550 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:text-white md:h-11 md:w-11"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-zinc-100 p-2 dark:bg-zinc-950 md:p-4">
              <div className="mx-auto h-full w-full max-w-5xl overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 md:p-4">
                <div className="mx-auto w-full min-w-[280px] max-w-[960px]">
                  <TemplatePreviewScaler zoom={previewZoom} pageWidth={960}>
                    <div className="rounded-lg border border-zinc-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                      <TemplateVisualPreview template={previewTemplate} />
                    </div>
                  </TemplatePreviewScaler>
                </div>
              </div>
            </div>
            <div className="z-10 grid gap-3 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex sm:flex-wrap md:p-6">
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
                className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-550"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Feature Dialog */}
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

            <p className="mt-4 text-zinc-600 dark:text-zinc-300">{activePremiumFeature.detail}</p>

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
