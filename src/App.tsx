import { Fragment, useEffect, useRef, useState, type ChangeEvent, type ReactNode, type SVGProps } from 'react';
import {
  Check,
  ChevronRight,
  FileText,
  Layout,
  Sparkles,
  Star,
  User,
  Mail,
  BookOpen,
  Layers,
  CreditCard,
  Users,
  LifeBuoy,
  Search,
  TrendingUp,
  ClipboardCheck,
  Wand2,
  SlidersHorizontal,
  BriefcaseBusiness,
  Building2,
  MapPin,
  Send,
  Filter,
  Bookmark,
  LoaderCircle,
  X,
  ArrowLeft,
} from 'lucide-react';
import professionalImg from './assets/templates/professional.svg';
import modernImg from './assets/templates/modern.svg';
import minimalImg from './assets/templates/minimal.svg';
import creativeImg from './assets/templates/creative.svg';
import fresherImg from './assets/templates/fresher.svg';
import executiveImg from './assets/templates/executive.svg';
import technicalImg from './assets/templates/technical.svg';
import twoColumnImg from './assets/templates/two-column.svg';
import consultingImg from './assets/templates/consulting.svg';
import startupImg from './assets/templates/startup.svg';
import corporateImg from './assets/templates/corporate.svg';
import academicImg from './assets/templates/academic.svg';
import salesImg from './assets/templates/sales.svg';
import designerImg from './assets/templates/designer.svg';
import productImg from './assets/templates/product.svg';
import operationsImg from './assets/templates/operations.svg';
import financeImg from './assets/templates/finance.svg';
import { backendApi, mapBackendJobToUiJob, type JobFilters } from './lib/backendApi';

// --- Types ---

type Page =
  | 'home'
  | 'builder'
  | 'templates'
  | 'cover-letter'
  | 'pricing'
  | 'examples'
  | 'job-finder'
  | 'blog'
  | 'blog-post'
  | 'login'
  | 'dashboard'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'admin';

interface TemplateItem {
  id: string;
  name: string;
  desc: string;
  tag: string;
  image: string;
}

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  match: number;
  skills: string[];
  url?: string;
  postedAt?: string;
}

interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  readTime: string;
  updated: string;
  sections: Array<{
    heading: string;
    points: string[];
  }>;
}

interface PremiumFeatureItem {
  id: 'portfolio-website-generator' | 'resume-shareable-link' | 'qr-code-resume' | 'multi-language-resumes';
  title: string;
  desc: string;
  detail: string;
  targetPage: Page;
}

const ACCESS_TOKEN_STORAGE_KEY = 'redresumes_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'redresumes_refresh_token';
const USER_STORAGE_KEY = 'redresumes_user';

const templates: TemplateItem[] = [
  { id: 'professional', name: 'Professional', desc: 'Classic ATS-friendly format', tag: 'Most popular', image: professionalImg },
  { id: 'modern', name: 'Modern', desc: 'Clean, balanced layout', tag: 'Clean layout', image: modernImg },
  { id: 'minimal', name: 'Minimal', desc: 'Elegant typography-first', tag: 'ATS-first', image: minimalImg },
  { id: 'creative', name: 'Creative', desc: 'Great for design roles', tag: 'Designer-ready', image: creativeImg },
  { id: 'fresher', name: 'Fresher', desc: 'Perfect for new grads', tag: 'New grads', image: fresherImg },
  { id: 'executive', name: 'Executive', desc: 'Leadership-ready layout', tag: 'Leadership', image: executiveImg },
  { id: 'technical', name: 'Technical', desc: 'Engineering-heavy focus', tag: 'Engineering', image: technicalImg },
  { id: 'two-column', name: 'Two-column', desc: 'Compact information density', tag: 'Compact', image: twoColumnImg },
  { id: 'consulting', name: 'Consulting', desc: 'Case interview style', tag: 'Strategy', image: consultingImg },
  { id: 'startup', name: 'Startup', desc: 'Bold profile-first layout', tag: 'Trendy', image: startupImg },
  { id: 'corporate', name: 'Corporate', desc: 'Structured enterprise style', tag: 'Enterprise', image: corporateImg },
  { id: 'academic', name: 'Academic', desc: 'Research and publication focus', tag: 'Research', image: academicImg },
  { id: 'sales', name: 'Sales', desc: 'Achievement and metrics spotlight', tag: 'Revenue-first', image: salesImg },
  { id: 'designer', name: 'Designer', desc: 'Visual hierarchy with personality', tag: 'Portfolio-ready', image: designerImg },
  { id: 'product', name: 'Product', desc: 'Product thinking and impact flow', tag: 'PM pick', image: productImg },
  { id: 'operations', name: 'Operations', desc: 'Process and execution format', tag: 'Execution', image: operationsImg },
  { id: 'finance', name: 'Finance', desc: 'Conservative and detail-oriented', tag: 'Analytical', image: financeImg },
];

const blogArticles: BlogArticle[] = [
  {
    slug: 'ats-friendly-resume',
    title: 'How to make an ATS-friendly resume',
    excerpt: 'Get your resume parsed correctly and ranked higher with ATS-safe structure and keywords.',
    readTime: '8 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Start with a clean structure',
        points: [
          'Use one-column layout for most roles and avoid complex tables.',
          'Stick to standard headings: Summary, Experience, Education, Skills.',
          'Use consistent date format, ideally `MMM YYYY`.',
        ],
      },
      {
        heading: 'Use job-specific keywords naturally',
        points: [
          'Mirror exact terms from the job description in your bullets.',
          'Place keywords in context, not as a keyword dump block.',
          'Prioritize skills that are repeated multiple times in the posting.',
        ],
      },
      {
        heading: 'Write impact-driven bullets',
        points: [
          'Start each bullet with a strong action verb.',
          'Include numbers: percentages, revenue, time saved, volume handled.',
          'Keep bullets short, specific, and role relevant.',
        ],
      },
      {
        heading: 'Final ATS checklist',
        points: [
          'Export as PDF if formatting remains intact; otherwise use DOCX.',
          'Avoid headers/footers for critical contact details.',
          'Run a quick match check before every application.',
        ],
      },
    ],
  },
  {
    slug: 'best-resume-format-freshers',
    title: 'Best resume format for freshers',
    excerpt: 'Choose the right fresher format to highlight potential, projects, and internships.',
    readTime: '7 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Use a skills-forward resume',
        points: [
          'Keep summary concise with role target and key strengths.',
          'Move skills and projects above experience when experience is limited.',
          'Show practical outcomes from internships and coursework.',
        ],
      },
      {
        heading: 'What to prioritize as a fresher',
        points: [
          'Projects with real tools and measurable results.',
          'Internships, volunteer work, campus leadership.',
          'Certifications tied to the target role.',
        ],
      },
      {
        heading: 'Common fresher mistakes',
        points: [
          'Overly long objective statement.',
          'Generic claims without proof.',
          'Cluttered design that hurts readability.',
        ],
      },
    ],
  },
  {
    slug: 'resume-headline-examples',
    title: 'Resume headline examples',
    excerpt: 'Create strong, role-specific headlines that grab recruiter attention in seconds.',
    readTime: '6 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'What makes a great headline',
        points: [
          'Role + years + core specialization + top achievement.',
          'Keep it under 12 words for fast scanning.',
          'Use role language recruiters search for.',
        ],
      },
      {
        heading: 'Headline formulas',
        points: [
          '“Senior Data Analyst | SQL, Python | Reduced reporting time 45%”',
          '“Frontend Developer | React + TypeScript | Built high-converting UI systems”',
          '“HR Generalist | Hiring & Ops | Scaled hiring across 3 regions”',
        ],
      },
      {
        heading: 'Optimization tips',
        points: [
          'Adjust headline per job family.',
          'Avoid vague words like hardworking or dedicated.',
          'Validate fit with JD keywords before applying.',
        ],
      },
    ],
  },
  {
    slug: 'professional-summary-examples',
    title: 'Professional summary examples',
    excerpt: 'Write summaries that balance clarity, credibility, and outcomes in 3-4 lines.',
    readTime: '7 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Summary structure',
        points: [
          'Line 1: current role and specialization.',
          'Line 2: top strengths and tools.',
          'Line 3: impact statement with measurable result.',
        ],
      },
      {
        heading: 'Example framework',
        points: [
          '“Product marketer with 4+ years in SaaS growth.”',
          '“Expert in lifecycle, paid acquisition, and messaging optimization.”',
          '“Improved trial-to-paid conversion by 22% across two products.”',
        ],
      },
      {
        heading: 'Make it job-specific',
        points: [
          'Swap tools and priorities based on JD.',
          'Keep only relevant wins.',
          'Remove generic personality lines.',
        ],
      },
    ],
  },
  {
    slug: 'best-skills-on-resume',
    title: 'Best skills to put on a resume',
    excerpt: 'Select skills that improve ATS matching and make your profile instantly relevant.',
    readTime: '8 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Choose skills by role intent',
        points: [
          'Prioritize hard skills first for technical and operational roles.',
          'Add only high-signal soft skills with proof in experience bullets.',
          'Group skills into categories for scannability.',
        ],
      },
      {
        heading: 'How many skills to include',
        points: [
          '10 to 18 targeted skills is a strong range.',
          'Avoid long unstructured tag clouds.',
          'Keep top 5 role-critical skills near the top.',
        ],
      },
      {
        heading: 'Skill quality check',
        points: [
          'Can you prove each skill with a project or bullet?',
          'Is it requested in the target JD?',
          'Does it differentiate you from average applicants?',
        ],
      },
    ],
  },
  {
    slug: 'resume-vs-cv',
    title: 'Resume vs CV',
    excerpt: 'Understand when to use a resume vs CV based on geography, role type, and context.',
    readTime: '6 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Core difference',
        points: [
          'Resume is concise and role-targeted.',
          'CV is comprehensive and often longer.',
          'Resume is common for industry jobs; CV for academic/research paths.',
        ],
      },
      {
        heading: 'Where it differs by region',
        points: [
          'US/Canada: resume is standard for most job applications.',
          'Some regions use CV as the default term for resume-like documents.',
          'Always check local expectations and job posting language.',
        ],
      },
      {
        heading: 'Best practice',
        points: [
          'Maintain one master document, generate role-specific versions.',
          'Keep your industry resume to one or two pages.',
          'Use a full CV only when explicitly requested.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-write-cover-letter',
    title: 'How to write a cover letter',
    excerpt: 'Write cover letters that sound personal, relevant, and specific to each opportunity.',
    readTime: '9 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Simple winning structure',
        points: [
          'Opening: role, motivation, and company fit.',
          'Middle: one or two relevant achievements.',
          'Closing: confident CTA and appreciation.',
        ],
      },
      {
        heading: 'What to personalize',
        points: [
          'Use the company’s product, challenge, or mission as context.',
          'Mirror role priorities from the JD.',
          'Show direct alignment, not generic admiration.',
        ],
      },
      {
        heading: 'Final quality pass',
        points: [
          'Keep to around 200-300 words.',
          'Check tone: professional and confident.',
          'Avoid repeating the resume line by line.',
        ],
      },
    ],
  },
  {
    slug: 'resume-mistakes-to-avoid',
    title: 'Resume mistakes to avoid',
    excerpt: 'Avoid the most common resume errors that reduce response rate and interview calls.',
    readTime: '7 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Top formatting mistakes',
        points: [
          'Crowded layout with inconsistent spacing.',
          'Too many fonts or decorative elements.',
          'Missing hierarchy between section headings and body text.',
        ],
      },
      {
        heading: 'Content mistakes',
        points: [
          'Responsibilities listed without impact.',
          'Overly generic summary and skills.',
          'Irrelevant older experience taking prime space.',
        ],
      },
      {
        heading: 'Application mistakes',
        points: [
          'Same resume for every job.',
          'No keyword optimization for target role.',
          'No final proofreading before submission.',
        ],
      },
    ],
  },
  {
    slug: 'best-action-verbs-for-resume',
    title: 'Best action verbs for resume',
    excerpt: 'Use stronger verbs to make your achievements clearer, sharper, and more persuasive.',
    readTime: '6 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Why action verbs matter',
        points: [
          'They make ownership and initiative explicit.',
          'They improve perceived impact and clarity.',
          'They reduce passive and vague phrasing.',
        ],
      },
      {
        heading: 'High-impact verb categories',
        points: [
          'Leadership: led, directed, mentored, scaled.',
          'Execution: built, delivered, implemented, optimized.',
          'Analysis: analyzed, forecasted, evaluated, diagnosed.',
        ],
      },
      {
        heading: 'Better bullet rewrite pattern',
        points: [
          'Verb + what you did + how + measurable result.',
          'Example: “Optimized onboarding flow, reducing drop-off by 19%.”',
          'Keep each bullet one clear idea with one clear outcome.',
        ],
      },
    ],
  },
];

const premiumFeatures: PremiumFeatureItem[] = [
  {
    id: 'portfolio-website-generator',
    title: 'Portfolio website generator',
    desc: 'Turn your resume into a live personal site.',
    detail: 'Publish your resume as a clean personal website with your profile, projects, and contact details.',
    targetPage: 'builder',
  },
  {
    id: 'resume-shareable-link',
    title: 'Resume shareable link',
    desc: 'Create a public URL to send instantly.',
    detail: 'Generate a public link for quick recruiter sharing without downloading files each time.',
    targetPage: 'dashboard',
  },
  {
    id: 'qr-code-resume',
    title: 'QR code resume',
    desc: 'Add a scannable QR to any version.',
    detail: 'Create a QR code connected to your latest resume so recruiters can open it in one scan.',
    targetPage: 'builder',
  },
  {
    id: 'multi-language-resumes',
    title: 'Multi-language resumes',
    desc: 'Translate and localize for global roles.',
    detail: 'Build localized resume versions for different regions and role markets from one base profile.',
    targetPage: 'builder',
  },
];

// --- Shared UI ---

const Section = ({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) => (
  <section className="py-16">
    <div className="max-w-7xl mx-auto px-6">
      {kicker && <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">{kicker}</p>}
      <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mt-3">{title}</h2>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

const PrimaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="bg-primary text-white px-6 py-3 rounded-full font-semibold shadow-sm hover:opacity-90 transition"
  >
    {label}
  </button>
);

const SecondaryButton = ({ label, onClick }: { label: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="border border-zinc-300 text-zinc-900 px-6 py-3 rounded-full font-semibold hover:border-zinc-900 transition"
  >
    {label}
  </button>
);

const TemplateCard = ({
  template,
  onUseTemplate,
  compact = false,
}: {
  template: TemplateItem;
  onUseTemplate: (template: TemplateItem) => void;
  compact?: boolean;
}) => (
  <div className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-zinc-200 bg-white p-4 md:p-5 shadow-[0_16px_44px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-2 hover:border-zinc-300 hover:shadow-[0_28px_80px_rgba(15,23,42,0.14)]">
    <div className={`relative overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-50 ${compact ? 'h-36' : 'h-44'}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/35 to-transparent opacity-80 transition duration-300 group-hover:opacity-100" />
      <img
        src={template.image}
        alt={`${template.name} template preview`}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
      />
    </div>
    <div className="mt-5 flex flex-1 flex-col">
      <h3 className="min-w-0 text-[1.85rem] leading-[0.95] font-black tracking-[-0.055em] text-zinc-950 md:text-[2rem]">
        {template.name}
      </h3>
      <p className="mt-3 max-w-[16ch] text-[0.92rem] font-medium leading-[1.35] tracking-[-0.02em] text-zinc-500 md:text-[0.98rem]">
        {template.desc}
      </p>
      <span className="mt-4 inline-flex w-fit rounded-full border border-primary/10 bg-primary/5 px-3.5 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-primary">
        {template.tag}
      </span>
      <button
        onClick={() => onUseTemplate(template)}
        className="mt-auto pt-7 text-left text-[1.02rem] font-extrabold tracking-[-0.03em] text-primary transition group-hover:translate-x-0.5"
      >
        Use template
      </button>
    </div>
  </div>
);

const Header = ({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) => (
  <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-zinc-100">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <button onClick={() => onNavigate('home')} className="text-xl font-extrabold tracking-tight text-zinc-900">
        RedResumes
      </button>
      <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-600">
        {[
          { id: 'home', label: 'Home' },
          { id: 'templates', label: 'Templates' },
          { id: 'job-finder', label: 'Job Finder' },
          { id: 'examples', label: 'Examples' },
          { id: 'pricing', label: 'Pricing' },
          { id: 'blog', label: 'Blog' },
          { id: 'login', label: 'Login' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Page)}
            className={currentPage === item.id ? 'text-zinc-900' : 'hover:text-zinc-900'}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="hidden md:flex items-center gap-3">
        <SecondaryButton label="View Templates" onClick={() => onNavigate('templates')} />
        <PrimaryButton label="Create Resume" onClick={() => onNavigate('builder')} />
      </div>
      <button className="md:hidden p-2 border border-zinc-200 rounded-full">
        <Layout className="w-5 h-5" />
      </button>
    </div>
  </header>
);

const Footer = ({ onNavigate }: { onNavigate: (page: Page) => void }) => (
  <footer className="border-t border-zinc-100 bg-white">
    <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10 text-sm">
      <div>
        <h3 className="text-lg font-bold text-zinc-900">RedResumes</h3>
        <p className="text-zinc-500 mt-2">Build resumes that are clear, ATS-friendly, and recruiter-ready.</p>
      </div>
      <div className="space-y-2">
        <p className="text-zinc-900 font-semibold">Product</p>
        <button onClick={() => onNavigate('builder')} className="block text-zinc-500 hover:text-zinc-900">Resume Builder</button>
        <button onClick={() => onNavigate('job-finder')} className="block text-zinc-500 hover:text-zinc-900">Job Finder</button>
        <button onClick={() => onNavigate('cover-letter')} className="block text-zinc-500 hover:text-zinc-900">Cover Letter Builder</button>
        <button onClick={() => onNavigate('templates')} className="block text-zinc-500 hover:text-zinc-900">Templates</button>
        <button onClick={() => onNavigate('pricing')} className="block text-zinc-500 hover:text-zinc-900">Pricing</button>
      </div>
      <div className="space-y-2">
        <p className="text-zinc-900 font-semibold">Company</p>
        <button onClick={() => onNavigate('blog')} className="block text-zinc-500 hover:text-zinc-900">Blog</button>
        <button onClick={() => onNavigate('examples')} className="block text-zinc-500 hover:text-zinc-900">Resume Examples</button>
        <button onClick={() => onNavigate('contact')} className="block text-zinc-500 hover:text-zinc-900">Contact</button>
        <button onClick={() => onNavigate('dashboard')} className="block text-zinc-500 hover:text-zinc-900">Dashboard</button>
      </div>
      <div className="space-y-2">
        <p className="text-zinc-900 font-semibold">Legal</p>
        <button onClick={() => onNavigate('privacy')} className="block text-zinc-500 hover:text-zinc-900">Privacy Policy</button>
        <button onClick={() => onNavigate('terms')} className="block text-zinc-500 hover:text-zinc-900">Terms of Service</button>
        <button onClick={() => onNavigate('admin')} className="block text-zinc-500 hover:text-zinc-900">Admin Panel</button>
      </div>
    </div>
    <div className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-400">(c) 2026 RedResumes.com</div>
  </footer>
);

// --- Pages ---

const HomePage = ({
  onNavigate,
  onUseTemplate,
}: {
  onNavigate: (page: Page) => void;
  onUseTemplate: (template: TemplateItem) => void;
}) => {
  const [activePremiumFeature, setActivePremiumFeature] = useState<PremiumFeatureItem | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const demoShareLink = 'https://redresumes.com/r/alex-morgan-ats';

  const openPremiumFeature = (feature: PremiumFeatureItem) => {
    setActivePremiumFeature(feature);
    setCopiedShareLink(false);
  };

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
    onNavigate(activePremiumFeature.targetPage);
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
            <PrimaryButton label="Create Resume" onClick={() => onNavigate('builder')} />
            <SecondaryButton label="View Templates" onClick={() => onNavigate('templates')} />
            <SecondaryButton label="Find Jobs" onClick={() => onNavigate('job-finder')} />
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
            <TemplateCard template={cat} onUseTemplate={onUseTemplate} compact />
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
          <PrimaryButton label="Start for free" onClick={() => onNavigate('builder')} />
        </div>
      </div>
    </section>
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
                onNavigate('pricing');
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

const ResumeBuilderPage = ({
  selectedTemplate,
  selectedExample,
}: {
  selectedTemplate: TemplateItem;
  selectedExample: string | null;
}) => {
  interface ExperienceItem {
    title: string;
    dates: string;
    bullets: string;
  }

  const sectionItems = [
    { id: 'contact', label: 'Contact' },
    { id: 'photo', label: 'Photo' },
    { id: 'date-place', label: 'Date & Place' },
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'languages', label: 'Languages' },
    { id: 'hobbies', label: 'Hobbies' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'volunteer', label: 'Volunteer' },
  ] as const;
  type SectionId = (typeof sectionItems)[number]['id'];

  const [activeSection, setActiveSection] = useState<SectionId>('contact');
  const [fullName, setFullName] = useState('Alex Morgan');
  const [jobTitle, setJobTitle] = useState(selectedExample || 'Senior Product Manager');
  const [email, setEmail] = useState('alexmorgan@email.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [location, setLocation] = useState('New York, NY');
  const [profileLink, setProfileLink] = useState('linkedin.com/in/alexmorgan');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [importantPlace, setImportantPlace] = useState('');
  const [summary, setSummary] = useState('Product leader with 8+ years of experience building growth-focused digital products, leading cross-functional teams, and improving user conversion through data-driven decisions.');
  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    {
      title: 'Senior Product Manager - Acme Corp',
      dates: 'Jan 2022 - Present',
      bullets: 'Led product roadmap for 2 B2B tools, improving activation by 21%.\nCollaborated with design and engineering to launch 6 major features.\nReduced onboarding friction, cutting support tickets by 34%.',
    },
  ]);
  const [skillsInput, setSkillsInput] = useState('Product Strategy, Analytics, Roadmapping, Leadership, SQL, Stakeholder Management');
  const [educationDegree, setEducationDegree] = useState('B.Tech in Computer Science');
  const [educationSchool, setEducationSchool] = useState('National Institute of Technology');
  const [educationYear, setEducationYear] = useState('2018 - 2022');
  const [projectsInput, setProjectsInput] = useState('Built a resume scoring tool using React and Node.js.\nCreated an analytics dashboard to track job applications.');
  const [certificationsInput, setCertificationsInput] = useState('Google Data Analytics, AWS Cloud Practitioner');
  const [languagesInput, setLanguagesInput] = useState('English, Hindi');
  const [hobbiesInput, setHobbiesInput] = useState('Reading, Running, Chess');
  const [achievementsInput, setAchievementsInput] = useState('Won hackathon among 120+ teams.\nImproved product conversion by 21% in previous role.');
  const [volunteerInput, setVolunteerInput] = useState('Mentored students in resume writing and interview prep.');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [premiumActionMessage, setPremiumActionMessage] = useState<string | null>(null);
  const [selectedPremiumLanguage, setSelectedPremiumLanguage] = useState<'English' | 'Hindi' | 'Spanish' | 'French'>('English');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedExample) {
      setJobTitle(selectedExample);
    }
  }, [selectedExample]);

  const parsedSkills = skillsInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedProjects = projectsInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const parsedCertifications = certificationsInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedLanguages = languagesInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedHobbies = hobbiesInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedAchievements = achievementsInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const parsedVolunteer = volunteerInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const datePlaceText = [
    importantDate.trim() ? `Date: ${importantDate.trim()}` : '',
    importantPlace.trim() ? `Place: ${importantPlace.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  const resumeSlug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'candidate';
  const resumeShareLink = `https://redresumes.com/r/${resumeSlug}-${selectedTemplate.id}`;
  const summaryByLanguage: Record<'English' | 'Hindi' | 'Spanish' | 'French', string> = {
    English: summary,
    Hindi: 'डेटा-आधारित निर्णयों के साथ उत्पाद विकास और क्रॉस-फंक्शनल टीम नेतृत्व में 8+ वर्षों का अनुभवी प्रोडक्ट लीडर।',
    Spanish: 'Lider de producto con mas de 8 anos de experiencia impulsando crecimiento con equipos multifuncionales y decisiones basadas en datos.',
    French: 'Responsable produit avec plus de 8 ans d experience en croissance produit, leadership inter-equipes et decisions guidees par les donnees.',
  };
  const templateThemeById: Record<string, { accent: string; headingBg: string; font: string; layout: 'single' | 'two-column' }> = {
    professional: { accent: '#991b1b', headingBg: '#f8fafc', font: 'Inter, Arial, sans-serif', layout: 'single' },
    modern: { accent: '#2563eb', headingBg: '#eff6ff', font: 'Inter, Arial, sans-serif', layout: 'single' },
    minimal: { accent: '#111827', headingBg: '#fafafa', font: 'Georgia, serif', layout: 'single' },
    creative: { accent: '#ea580c', headingBg: '#fff7ed', font: 'Inter, Arial, sans-serif', layout: 'two-column' },
    fresher: { accent: '#16a34a', headingBg: '#f0fdf4', font: 'Inter, Arial, sans-serif', layout: 'single' },
    executive: { accent: '#0f172a', headingBg: '#f1f5f9', font: 'Inter, Arial, sans-serif', layout: 'single' },
    technical: { accent: '#1d4ed8', headingBg: '#eff6ff', font: 'Inter, Arial, sans-serif', layout: 'two-column' },
    'two-column': { accent: '#0f172a', headingBg: '#f8fafc', font: 'Inter, Arial, sans-serif', layout: 'two-column' },
    consulting: { accent: '#b45309', headingBg: '#fffbeb', font: 'Inter, Arial, sans-serif', layout: 'single' },
    startup: { accent: '#0f766e', headingBg: '#ecfeff', font: 'Inter, Arial, sans-serif', layout: 'single' },
    corporate: { accent: '#1e3a8a', headingBg: '#eff6ff', font: 'Inter, Arial, sans-serif', layout: 'single' },
    academic: { accent: '#334155', headingBg: '#f8fafc', font: 'Georgia, serif', layout: 'single' },
    sales: { accent: '#be123c', headingBg: '#fff1f2', font: 'Inter, Arial, sans-serif', layout: 'single' },
    designer: { accent: '#c2410c', headingBg: '#fff7ed', font: 'Inter, Arial, sans-serif', layout: 'two-column' },
    product: { accent: '#4338ca', headingBg: '#eef2ff', font: 'Inter, Arial, sans-serif', layout: 'single' },
    operations: { accent: '#0f172a', headingBg: '#f8fafc', font: 'Inter, Arial, sans-serif', layout: 'two-column' },
    finance: { accent: '#0f766e', headingBg: '#f0fdfa', font: 'Georgia, serif', layout: 'single' },
  };
  const currentTheme = templateThemeById[selectedTemplate.id] || templateThemeById.professional;

  const focusSection = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`builder-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateExperience = (index: number, key: keyof ExperienceItem, value: string) => {
    setExperiences((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addAnotherExperience = () => {
    setExperiences((prev) => [...prev, { title: '', dates: '', bullets: '' }]);
  };

  const duplicateExperienceSection = () => {
    setExperiences((prev) => {
      const source = prev[prev.length - 1] || { title: '', dates: '', bullets: '' };
      return [...prev, { ...source }];
    });
  };

  const openPreviewPanel = () => {
    document.getElementById('builder-live-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const generatePortfolioHtml = () => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeName = escapeHtml(fullName || 'Your Name');
    const safeRole = escapeHtml(jobTitle || 'Professional');
    const safeSummary = escapeHtml(summary || 'Add your professional summary from the resume builder.');
    const safeEmail = escapeHtml(email || 'your@email.com');
    const safePhone = escapeHtml(phone || '-');
    const safeLocation = escapeHtml(location || '-');
    const safeProfile = escapeHtml(profileLink || '-');
    const safeDatePlace = escapeHtml(datePlaceText || '');
    const educationSummary = escapeHtml([educationDegree, educationSchool].filter(Boolean).join(' - ') || 'Add your education details');
    const educationYears = escapeHtml(educationYear || 'Years not specified');
    const accent = currentTheme.accent;

    const skillChips = (parsedSkills.slice(0, 14).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join(''))
      || '<span class="chip muted">Add skills in builder</span>';
    const languageChips = (parsedLanguages.map((language) => `<span class="chip chip-soft">${escapeHtml(language)}</span>`).join(''))
      || '<span class="chip chip-soft muted">No languages added</span>';
    const hobbyChips = (parsedHobbies.map((hobby) => `<span class="chip chip-soft">${escapeHtml(hobby)}</span>`).join(''))
      || '<span class="chip chip-soft muted">No hobbies added</span>';
    const certList = (parsedCertifications.map((cert) => `<li>${escapeHtml(cert)}</li>`).join('')) || '<li>No certifications added</li>';

    const projectsMarkup = parsedProjects.slice(0, 6).map((project, index) => `
      <article class="glass card">
        <p class="eyebrow">Project ${index + 1}</p>
        <h3>${escapeHtml(project.split(' ').slice(0, 7).join(' ') || `Project ${index + 1}`)}</h3>
        <p>${escapeHtml(project)}</p>
      </article>
    `).join('') || `
      <article class="glass card">
        <p class="eyebrow">Project</p>
        <h3>Add your featured projects</h3>
        <p>Use the Projects section in the resume builder to auto-fill this portfolio area.</p>
      </article>
    `;

    const experienceMarkup = experiences.slice(0, 4).map((exp) => {
      const title = escapeHtml(exp.title || 'Experience title');
      const dates = escapeHtml(exp.dates || 'Dates');
      const bullets = exp.bullets
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('') || '<li>Add measurable work impact points.</li>';

      return `
        <article class="timeline-item">
          <div class="dot"></div>
          <div class="timeline-content">
            <h3>${title}</h3>
            <p class="meta">${dates}</p>
            <ul>${bullets}</ul>
          </div>
        </article>
      `;
    }).join('');

    return `
      <html>
        <head>
          <title>${safeName} | Portfolio</title>
          <style>
            :root {
              --accent: ${accent};
              --ink: #0f172a;
              --muted: #475569;
              --line: #d7deea;
              --surface: rgba(255, 255, 255, 0.72);
            }
            html { scroll-behavior: smooth; }
            body {
              margin: 0;
              font-family: Inter, Arial, sans-serif;
              color: var(--ink);
              background: radial-gradient(circle at 10% 0%, rgba(59,130,246,0.14), transparent 28%),
                          radial-gradient(circle at 90% 10%, rgba(236,72,153,0.12), transparent 24%),
                          linear-gradient(145deg, #f8fbff 0%, #f7f7ff 42%, #f8fafc 100%);
            }
            .blob {
              position: fixed;
              width: 280px;
              height: 280px;
              border-radius: 999px;
              filter: blur(36px);
              opacity: 0.22;
              z-index: 0;
              pointer-events: none;
            }
            .blob.one { top: 20px; left: -60px; background: #0ea5e9; }
            .blob.two { right: -70px; top: 190px; background: #f43f5e; }
            .blob.three { left: 40%; bottom: -80px; background: #8b5cf6; }
            .wrap {
              position: relative;
              z-index: 1;
              max-width: 1080px;
              margin: 0 auto;
              padding: 26px 22px 70px;
            }
            .glass {
              background: var(--surface);
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255, 255, 255, 0.9);
              box-shadow: 0 14px 50px rgba(15, 23, 42, 0.08);
            }
            .nav {
              position: sticky;
              top: 16px;
              z-index: 20;
              border-radius: 18px;
              padding: 10px 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 16px;
            }
            .logo {
              font-size: 13px;
              font-weight: 800;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: #334155;
            }
            .nav-links {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            }
            .nav-links a {
              text-decoration: none;
              color: #334155;
              font-size: 13px;
              font-weight: 600;
              padding: 6px 10px;
              border-radius: 999px;
            }
            .nav-links a:hover { background: rgba(148, 163, 184, 0.18); }
            .hero {
              border-radius: 28px;
              padding: 34px 30px;
              margin-top: 8px;
            }
            .hero-grid {
              display: grid;
              grid-template-columns: 1.4fr 0.8fr;
              gap: 20px;
              align-items: center;
            }
            .identity {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .avatar {
              width: 88px;
              height: 88px;
              border-radius: 18px;
              object-fit: cover;
              border: 1px solid var(--line);
              box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
            }
            h1 {
              margin: 0;
              font-size: 44px;
              line-height: 1;
              letter-spacing: -0.03em;
            }
            .role {
              margin-top: 8px;
              color: #334155;
              font-size: 18px;
              font-weight: 600;
            }
            .summary {
              margin-top: 18px;
              line-height: 1.75;
              color: var(--muted);
              max-width: 70ch;
            }
            .meta {
              margin-top: 14px;
              color: #334155;
              font-size: 14px;
              line-height: 1.8;
            }
            .hero-actions {
              display: grid;
              gap: 12px;
            }
            .btn {
              text-decoration: none;
              border-radius: 999px;
              font-size: 14px;
              font-weight: 700;
              padding: 11px 16px;
              text-align: center;
              border: 1px solid transparent;
            }
            .btn-primary {
              background: var(--accent);
              color: white;
            }
            .btn-secondary {
              border-color: var(--line);
              color: #1e293b;
              background: white;
            }
            .stats {
              margin-top: 20px;
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
            }
            .stat {
              border-radius: 16px;
              padding: 14px;
              text-align: center;
            }
            .stat strong {
              display: block;
              font-size: 22px;
              letter-spacing: -0.03em;
            }
            .stat span {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #64748b;
            }
            section { margin-top: 24px; }
            .section-title {
              margin: 0 0 14px;
              font-size: 24px;
              letter-spacing: -0.02em;
            }
            .two-col {
              display: grid;
              gap: 16px;
              grid-template-columns: 1.25fr 0.75fr;
            }
            .card {
              border-radius: 20px;
              padding: 20px;
            }
            .eyebrow {
              margin: 0 0 8px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.16em;
              color: #64748b;
              font-weight: 700;
            }
            .chip-wrap {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .chip {
              display: inline-block;
              border: 1px solid var(--line);
              border-radius: 999px;
              padding: 7px 11px;
              font-size: 12px;
              font-weight: 600;
              background: white;
            }
            .chip-soft { background: rgba(241, 245, 249, 0.9); }
            .chip.muted { color: #94a3b8; }
            ul { margin: 0; padding-left: 18px; color: #334155; line-height: 1.7; }
            .timeline { position: relative; margin-left: 10px; }
            .timeline:before {
              content: "";
              position: absolute;
              top: 6px;
              bottom: 6px;
              left: 8px;
              width: 2px;
              background: linear-gradient(to bottom, var(--accent), #cbd5e1);
            }
            .timeline-item {
              position: relative;
              padding-left: 34px;
              margin-bottom: 18px;
            }
            .dot {
              position: absolute;
              top: 5px;
              left: 2px;
              width: 14px;
              height: 14px;
              border-radius: 999px;
              background: var(--accent);
              box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.95);
            }
            .timeline-content h3 {
              margin: 0;
              font-size: 17px;
              letter-spacing: -0.02em;
            }
            .timeline-content .meta {
              margin: 3px 0 8px;
              color: #64748b;
              font-size: 13px;
            }
            .project-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
            }
            .project-grid h3 { margin: 0 0 8px; font-size: 18px; letter-spacing: -0.02em; }
            .project-grid p { margin: 0; color: #475569; line-height: 1.65; font-size: 14px; }
            .footer-cta {
              margin-top: 24px;
              border-radius: 22px;
              padding: 22px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
            }
            .footer-cta h3 {
              margin: 0;
              font-size: 24px;
              letter-spacing: -0.02em;
            }
            .footer-cta p { margin: 6px 0 0; color: #475569; }
            @media (max-width: 900px) {
              .hero-grid { grid-template-columns: 1fr; }
              .stats { grid-template-columns: 1fr; }
              .two-col { grid-template-columns: 1fr; }
              .project-grid { grid-template-columns: 1fr; }
              h1 { font-size: 34px; }
              .footer-cta { flex-direction: column; align-items: flex-start; }
            }
          </style>
        </head>
        <body>
          <div class="blob one"></div>
          <div class="blob two"></div>
          <div class="blob three"></div>
          <div class="wrap">
            <nav class="nav glass">
              <div class="logo">${safeName}</div>
              <div class="nav-links">
                <a href="#Home">Home</a>
                <a href="#Experience">Experience</a>
                <a href="#Educations">Educations</a>
                <a href="#Projects">Projects</a>
                <a href="#Contact">Contact</a>
              </div>
            </nav>

            <section class="hero glass" id="Home">
              <div class="hero-grid">
                <div>
                  <div class="identity">
                    ${photoDataUrl ? `<img class="avatar" src="${escapeHtml(photoDataUrl)}" alt="Profile photo" />` : ''}
                    <div>
                      <h1>${safeName}</h1>
                      <p class="role">${safeRole}</p>
                    </div>
                  </div>
                  <p class="summary">${safeSummary}</p>
                  <p class="meta">${safeEmail} | ${safePhone} | ${safeLocation}</p>
                  <p class="meta">${safeProfile}</p>
                  ${safeDatePlace ? `<p class="meta">${safeDatePlace}</p>` : ''}
                </div>
                <div class="hero-actions">
                  <a class="btn btn-primary" href="mailto:${safeEmail}">Hire Me</a>
                  <a class="btn btn-secondary" href="#Projects">View Projects</a>
                  <a class="btn btn-secondary" href="#Contact">Contact</a>
                </div>
              </div>
              <div class="stats">
                <div class="glass stat"><strong>${parsedSkills.length || 0}</strong><span>Skills</span></div>
                <div class="glass stat"><strong>${experiences.length || 0}</strong><span>Experience Roles</span></div>
                <div class="glass stat"><strong>${parsedProjects.length || 0}</strong><span>Projects</span></div>
              </div>
            </section>

            <section id="Experience">
              <h2 class="section-title">Experience</h2>
              <div class="glass card">
                <div class="timeline">
                  ${experienceMarkup || '<p>No experience added yet.</p>'}
                </div>
              </div>
            </section>

            <section id="Educations">
              <h2 class="section-title">Educations</h2>
              <div class="two-col">
                <article class="glass card">
                  <p class="eyebrow">Education</p>
                  <h3>${educationSummary}</h3>
                  <p class="meta">${educationYears}</p>
                </article>
                <article class="glass card">
                  <p class="eyebrow">Certifications</p>
                  <ul>${certList}</ul>
                </article>
              </div>
            </section>

            <section id="Projects">
              <h2 class="section-title">Featured Projects</h2>
              <div class="project-grid">
                ${projectsMarkup}
              </div>
            </section>

            <section>
              <h2 class="section-title">Skills, Languages and Hobbies</h2>
              <div class="two-col">
                <article class="glass card">
                  <p class="eyebrow">Top Skills</p>
                  <div class="chip-wrap">${skillChips}</div>
                </article>
                <article class="glass card">
                  <p class="eyebrow">Languages</p>
                  <div class="chip-wrap">${languageChips}</div>
                  <p class="eyebrow" style="margin-top:14px;">Hobbies</p>
                  <div class="chip-wrap">${hobbyChips}</div>
                </article>
              </div>
            </section>

            <section class="footer-cta glass" id="Contact">
              <div>
                <h3>Let’s build something impactful</h3>
                <p>Available for roles, freelance work, and collaborations.</p>
              </div>
              <a class="btn btn-primary" href="mailto:${safeEmail}">Email ${safeName}</a>
            </section>
          </div>
        </body>
      </html>
    `;
  };

  const openPortfolioWebsitePreview = () => {
    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) return;
    popup.document.write(generatePortfolioHtml());
    popup.document.close();
  };

  const downloadPortfolioWebsiteHtml = () => {
    const html = generatePortfolioHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resumeSlug}-portfolio.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handlePremiumFeatureInBuilder = async (featureId: PremiumFeatureItem['id']) => {
    setPremiumActionMessage(null);

    if (featureId === 'portfolio-website-generator') {
      openPortfolioWebsitePreview();
      setPremiumActionMessage('Portfolio website preview opened in a new tab.');
      return;
    }

    if (featureId === 'resume-shareable-link') {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(resumeShareLink);
          setShareLinkCopied(true);
          setPremiumActionMessage('Resume shareable link copied.');
        } else {
          setShareLinkCopied(false);
          setPremiumActionMessage('Clipboard access is not available in this browser.');
        }
      } catch {
        setShareLinkCopied(false);
        setPremiumActionMessage('Unable to copy link. Please copy it manually from the preview box.');
      }
      return;
    }

    if (featureId === 'qr-code-resume') {
      const popup = window.open('', '_blank', 'width=600,height=700');
      if (!popup) return;
      const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(resumeShareLink)}`;
      popup.document.write(`
        <html>
          <head>
            <title>Resume QR Code</title>
            <style>
              body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #111827; }
              .wrap { padding: 30px; max-width: 480px; margin: 0 auto; text-align: center; }
              .card { border: 1px solid #e5e7eb; border-radius: 16px; background: white; padding: 24px; }
              img { border-radius: 12px; border: 1px solid #e5e7eb; }
              p { color: #4b5563; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <div class="card">
                <h2>QR code resume</h2>
                <p>Scan this QR to open your latest shareable resume.</p>
                <img src="${qrCodeSrc}" alt="Resume QR code" width="280" height="280" />
                <p style="margin-top: 14px; word-break: break-all;">${resumeShareLink}</p>
              </div>
            </div>
          </body>
        </html>
      `);
      popup.document.close();
      setPremiumActionMessage('QR code generated in a new tab.');
      return;
    }

    if (featureId === 'multi-language-resumes') {
      const translated = summaryByLanguage[selectedPremiumLanguage];
      setSummary(translated);
      if (!parsedLanguages.includes(selectedPremiumLanguage)) {
        const nextLanguages = [...parsedLanguages, selectedPremiumLanguage].filter(Boolean).join(', ');
        setLanguagesInput(nextLanguages);
      }
      setPremiumActionMessage(`Summary localized to ${selectedPremiumLanguage}.`);
    }
  };

  const downloadResumePdf = () => {
    const popup = window.open('', '_blank', 'width=1000,height=900');
    if (!popup) return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const skillsMarkup = parsedSkills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('');
    const expMarkup = experiences
      .map((item) => {
        const bulletMarkup = item.bullets
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('');
        return `
          <div class="item">
            <h3>${escapeHtml(item.title || 'Experience title')}</h3>
            <p class="meta">${escapeHtml(item.dates || 'Dates')}</p>
            <ul>${bulletMarkup}</ul>
          </div>
        `;
      })
      .join('');
    const projectMarkup = parsedProjects.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const certificationMarkup = parsedCertifications.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const languageMarkup = parsedLanguages.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const hobbiesMarkup = parsedHobbies.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const achievementMarkup = parsedAchievements.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const volunteerMarkup = parsedVolunteer.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

    popup.document.write(`
      <html>
        <head>
          <title>${escapeHtml(fullName)} Resume</title>
          <style>
            body { font-family: ${currentTheme.font}; margin: 32px; color: #111827; line-height: 1.4; }
            .sheet { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
            .header { background: ${currentTheme.headingBg}; border-bottom: 1px solid #e5e7eb; padding: 24px; }
            .content { padding: 24px; }
            h1 { margin: 0; font-size: 30px; }
            h2 { margin: 28px 0 10px; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; color: ${currentTheme.accent}; }
            .sub { color: #6b7280; margin-top: 6px; font-size: 14px; }
            .meta { color: #6b7280; font-size: 12px; margin: 3px 0 6px; }
            .item { margin-bottom: 14px; }
            ul { margin: 0; padding-left: 18px; }
            .tag { display: inline-block; margin: 0 6px 6px 0; padding: 4px 10px; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; }
            .grid { display: grid; grid-template-columns: ${currentTheme.layout === 'two-column' ? '0.8fr 1.4fr' : '1fr'}; gap: 20px; }
            .side { background: ${currentTheme.layout === 'two-column' ? currentTheme.headingBg : 'transparent'}; padding: ${currentTheme.layout === 'two-column' ? '14px' : '0'}; border-radius: 8px; }
            .profile-photo { width: 74px; height: 74px; border-radius: 10px; object-fit: cover; border: 1px solid #e5e7eb; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              ${photoDataUrl ? `<img class="profile-photo" src="${escapeHtml(photoDataUrl)}" alt="Profile photo" />` : ''}
              <h1>${escapeHtml(fullName || 'Your Name')}</h1>
              <p class="sub">${escapeHtml(jobTitle || '')}</p>
              <p class="sub">${escapeHtml(email)} | ${escapeHtml(phone)} | ${escapeHtml(location)}</p>
              <p class="sub">${escapeHtml(profileLink)}</p>
              ${datePlaceText ? `<p class="sub">${escapeHtml(datePlaceText)}</p>` : ''}
            </div>
            <div class="content grid">
              <div class="side">
                <h2>Skills</h2>
                <div>${skillsMarkup || '<p class="sub">No skills added</p>'}</div>
                <h2>Education</h2>
                <p><strong>${escapeHtml(educationDegree)}</strong><br/>${escapeHtml(educationSchool)} (${escapeHtml(educationYear)})</p>
                <h2>Languages</h2>
                <ul>${languageMarkup || '<li>Not specified</li>'}</ul>
                <h2>Hobbies</h2>
                <ul>${hobbiesMarkup || '<li>Not specified</li>'}</ul>
                <h2>Certifications</h2>
                <ul>${certificationMarkup || '<li>Not specified</li>'}</ul>
              </div>
              <div>
                <h2>Summary</h2>
                <p>${escapeHtml(summary)}</p>
                <h2>Experience</h2>
                ${expMarkup}
                <h2>Projects</h2>
                <ul>${projectMarkup || '<li>Not specified</li>'}</ul>
                <h2>Achievements</h2>
                <ul>${achievementMarkup || '<li>Not specified</li>'}</ul>
                <h2>Volunteer</h2>
                <ul>${volunteerMarkup || '<li>Not specified</li>'}</ul>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Resume Builder</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mt-2">Build your resume</h1>
            {selectedExample && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full">
                Viewing example: {selectedExample}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <SecondaryButton label="Preview" onClick={openPreviewPanel} />
            <PrimaryButton label="Download PDF" onClick={downloadResumePdf} />
          </div>
        </div>

        <div className="mt-10 grid lg:grid-cols-[220px_1fr_380px] gap-6">
          <aside className="border border-zinc-100 rounded-2xl p-4 bg-zinc-50 h-fit">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Sections</p>
            <div className="mt-4 space-y-2 text-sm">
              {sectionItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => focusSection(item.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border transition ${
                    activeSection === item.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-zinc-100 bg-white text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <div id="builder-section-contact" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Contact Information</h2>
              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Full name" />
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Job title" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Email" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Phone" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Location" />
                <input value={profileLink} onChange={(e) => setProfileLink(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="LinkedIn / Portfolio" />
              </div>
            </div>

            <div id="builder-section-photo" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Photo</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center">
                  {photoDataUrl ? (
                    <img src={photoDataUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                  />
                  {photoDataUrl && (
                    <button onClick={handleRemovePhoto} className="mt-2 text-xs font-semibold text-primary">
                      Remove photo
                    </button>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">Upload one profile photo for resume preview and PDF.</p>
                </div>
              </div>
            </div>

            <div id="builder-section-date-place" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Date & Place</h2>
              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                <input
                  type="date"
                  value={importantDate}
                  onChange={(e) => setImportantDate(e.target.value)}
                  className="border border-zinc-200 rounded-lg px-3 py-2"
                />
                <input
                  value={importantPlace}
                  onChange={(e) => setImportantPlace(e.target.value)}
                  className="border border-zinc-200 rounded-lg px-3 py-2"
                  placeholder="Place"
                />
              </div>
            </div>

            <div id="builder-section-summary" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Professional Summary</h2>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-28"
                placeholder="Write a short summary about your experience and impact."
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {['Professional', 'Confident', 'Simple', 'Executive'].map((tone) => (
                  <span key={tone} className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-500">{tone}</span>
                ))}
              </div>
            </div>

            <div id="builder-section-premium" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Upgrade</p>
              <h2 className="font-semibold text-zinc-900 mt-2">Premium tools inside builder</h2>
              <p className="text-sm text-zinc-500 mt-2">Use all premium features directly while editing your resume.</p>

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                {premiumFeatures.map((feature) => (
                  <div key={feature.id} className="rounded-xl border border-zinc-200 p-4 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{feature.desc}</p>

                    {feature.id === 'multi-language-resumes' && (
                      <select
                        value={selectedPremiumLanguage}
                        onChange={(event) => setSelectedPremiumLanguage(event.target.value as 'English' | 'Hindi' | 'Spanish' | 'French')}
                        className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {(['English', 'Hindi', 'Spanish', 'French'] as const).map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={() => handlePremiumFeatureInBuilder(feature.id)}
                      className="mt-3 text-sm font-semibold text-primary"
                    >
                      {feature.id === 'resume-shareable-link'
                        ? shareLinkCopied
                          ? 'Link copied'
                          : 'Copy share link'
                        : feature.id === 'qr-code-resume'
                          ? 'Generate QR code'
                          : feature.id === 'multi-language-resumes'
                            ? 'Apply selected language'
                            : 'Generate portfolio site'}
                    </button>
                    {feature.id === 'portfolio-website-generator' && (
                      <button
                        onClick={downloadPortfolioWebsiteHtml}
                        className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                      >
                        Download portfolio HTML
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200 p-3 text-sm bg-white">
                <p className="text-zinc-500">Live shareable URL</p>
                <p className="mt-1 break-all text-zinc-900">{resumeShareLink}</p>
              </div>
              {premiumActionMessage && <p className="mt-3 text-sm text-primary font-medium">{premiumActionMessage}</p>}
            </div>

            <div id="builder-section-experience" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Work Experience</h2>
              <div className="mt-4 space-y-4 text-sm">
                {experiences.map((exp, index) => (
                  <div key={`${index}-${exp.title}`} className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/40">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Experience {index + 1}</p>
                    <div className="mt-3 space-y-3">
                      <input value={exp.title} onChange={(e) => updateExperience(index, 'title', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 w-full bg-white" placeholder="Company and role" />
                      <input value={exp.dates} onChange={(e) => updateExperience(index, 'dates', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 w-full bg-white" placeholder="Dates" />
                      <textarea
                        value={exp.bullets}
                        onChange={(e) => updateExperience(index, 'bullets', e.target.value)}
                        className="border border-zinc-200 rounded-lg px-3 py-2 w-full h-24 bg-white"
                        placeholder="Describe impact in bullet points"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={addAnotherExperience} className="text-xs font-semibold text-primary">+ Add another experience</button>
                <button onClick={duplicateExperienceSection} className="text-xs font-semibold text-zinc-500">Duplicate section</button>
              </div>
            </div>

            <div id="builder-section-skills" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Skills</h2>
              <input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Comma-separated skills"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {parsedSkills.length > 0 ? parsedSkills.map((skill) => (
                  <span key={skill} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{skill}</span>
                )) : (
                  <span className="text-zinc-400">Add skills to preview them live.</span>
                )}
              </div>
            </div>

            <div id="builder-section-education" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Education</h2>
              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                <input value={educationDegree} onChange={(e) => setEducationDegree(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Degree" />
                <input value={educationSchool} onChange={(e) => setEducationSchool(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="School / University" />
                <input value={educationYear} onChange={(e) => setEducationYear(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Years" />
              </div>
            </div>

            <div id="builder-section-projects" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Projects</h2>
              <textarea value={projectsInput} onChange={(e) => setProjectsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="One project per line" />
            </div>

            <div id="builder-section-certifications" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Certifications</h2>
              <input value={certificationsInput} onChange={(e) => setCertificationsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" placeholder="Comma-separated certifications" />
            </div>

            <div id="builder-section-languages" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Languages</h2>
              <input value={languagesInput} onChange={(e) => setLanguagesInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" placeholder="Comma-separated languages" />
            </div>

            <div id="builder-section-hobbies" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Hobbies</h2>
              <input
                value={hobbiesInput}
                onChange={(e) => setHobbiesInput(e.target.value)}
                className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Comma-separated hobbies"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {parsedHobbies.length > 0 ? parsedHobbies.map((hobby) => (
                  <span key={hobby} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{hobby}</span>
                )) : (
                  <span className="text-zinc-400">Add hobbies to preview them live.</span>
                )}
              </div>
            </div>

            <div id="builder-section-achievements" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Achievements</h2>
              <textarea value={achievementsInput} onChange={(e) => setAchievementsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="One achievement per line" />
            </div>

            <div id="builder-section-volunteer" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Volunteer</h2>
              <textarea value={volunteerInput} onChange={(e) => setVolunteerInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="Volunteer work details" />
            </div>
          </div>

          <div className="space-y-6">
            <div id="builder-live-preview" className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <h2 className="font-semibold text-zinc-900">Live Preview</h2>
              <div className="mt-4 border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Template</span>
                  <span className="font-semibold text-zinc-900">{selectedTemplate.name}</span>
                </div>
                <div
                  className={`mt-3 rounded-lg border border-zinc-200 overflow-hidden bg-white ${currentTheme.layout === 'two-column' ? 'grid grid-cols-[0.9fr_1.5fr]' : ''}`}
                  style={{ fontFamily: currentTheme.font }}
                >
                  <div className={`${currentTheme.layout === 'two-column' ? 'p-3' : 'hidden'}`} style={{ background: currentTheme.headingBg }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: currentTheme.accent }}>Skills</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {parsedSkills.slice(0, 5).map((skill) => (
                        <span key={skill} className="px-2 py-1 rounded border border-zinc-300 text-[10px]">{skill}</span>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: currentTheme.accent }}>Education</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{educationDegree}</p>
                  </div>
                  <div>
                    <div className="p-3 border-b border-zinc-200" style={{ background: currentTheme.headingBg }}>
                      <div className="flex items-center gap-3 text-sm font-semibold text-zinc-900">
                        {photoDataUrl ? (
                          <img src={photoDataUrl} alt="Profile" className="w-10 h-10 rounded-md object-cover border border-zinc-200" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span>{fullName || 'Your name'}</span>
                      </div>
                      <p className="text-xs text-zinc-500">{jobTitle || 'Target role'}</p>
                      <p className="mt-1 text-[11px] text-zinc-500 break-all">{email || 'email@example.com'} • {phone || 'phone'} • {location || 'location'}</p>
                      <p className="mt-1 text-[11px] text-zinc-500 break-all">{profileLink || 'linkedin.com/in/yourprofile'}</p>
                      {datePlaceText && <p className="mt-1 text-[11px] text-zinc-500">{datePlaceText}</p>}
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: currentTheme.accent }}>Summary</p>
                      <p className="mt-1 text-xs text-zinc-600 line-clamp-4">{summary}</p>
                      {experiences.slice(0, 2).map((exp, idx) => (
                        <div key={`preview-exp-${idx}`} className="mt-3 text-[11px] text-zinc-600">
                          <p className="font-semibold text-zinc-700">{exp.title || 'Experience title'}</p>
                          <p className="text-zinc-500">{exp.dates || 'Dates'}</p>
                          <ul className="mt-1 list-disc pl-4 space-y-1">
                            {exp.bullets.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 2).map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <div className="mt-3 space-y-1 text-[11px] text-zinc-600">
                        {parsedProjects[0] && <p><span className="font-semibold text-zinc-700">Project:</span> {parsedProjects[0]}</p>}
                        {parsedCertifications[0] && <p><span className="font-semibold text-zinc-700">Certification:</span> {parsedCertifications[0]}</p>}
                        {parsedLanguages[0] && <p><span className="font-semibold text-zinc-700">Languages:</span> {parsedLanguages.join(', ')}</p>}
                        {parsedHobbies[0] && <p><span className="font-semibold text-zinc-700">Hobbies:</span> {parsedHobbies.join(', ')}</p>}
                        {parsedAchievements[0] && <p><span className="font-semibold text-zinc-700">Achievement:</span> {parsedAchievements[0]}</p>}
                        {parsedVolunteer[0] && <p><span className="font-semibold text-zinc-700">Volunteer:</span> {parsedVolunteer[0]}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500">
                <div className="border border-zinc-200 rounded-lg p-3">Font: Inter</div>
                <div className="border border-zinc-200 rounded-lg p-3">Layout: Single column</div>
                <div className="border border-zinc-200 rounded-lg p-3">Spacing: Normal</div>
                <div className="border border-zinc-200 rounded-lg p-3">Color: Classic</div>
              </div>
            </div>

          <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">ATS Checker</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-500">Score 88</span>
            </div>
            <ul className="mt-3 text-sm text-zinc-500 space-y-2">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Keywords matched: 14/18</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Action verbs strong</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Contact info present</li>
              <li className="flex items-center gap-2 text-zinc-400">- Consider quantifying impact</li>
            </ul>
          </div>

          <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <h3 className="font-semibold text-zinc-900">AI Writing Assistant</h3>
            <p className="text-sm text-zinc-500 mt-2">Improve bullets or generate a stronger summary.</p>
            <div className="mt-4 flex gap-2 text-xs">
              {['Rewrite summary', 'Improve bullets', 'Suggest action verbs'].map((item) => (
                <span key={item} className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-500">{item}</span>
              ))}
            </div>
          </div>

          <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <h3 className="font-semibold text-zinc-900">Job Description Match</h3>
            <div className="mt-2 text-sm text-zinc-500">Match rate: 76%</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {['Product analytics', 'SQL', 'Roadmapping', 'Stakeholder management'].map((kw) => (
                <span key={kw} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{kw}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const TemplatesPage = ({ onUseTemplate }: { onUseTemplate: (template: TemplateItem) => void }) => (
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
          <TemplateCard template={tpl} onUseTemplate={onUseTemplate} />
        </Fragment>
      ))}
    </div>
  </Section>
);

const CoverLetterPage = () => (
  <Section title="Cover letter builder" kicker="Cover letters">
    <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Select resume</h3>
        <div className="mt-4 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-500">VP Marketing Resume</div>
        <h3 className="font-semibold text-zinc-900 mt-6">Template</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {['Formal', 'Modern', 'Executive', 'Creative'].map((tpl) => (
            <div key={tpl} className="border border-zinc-100 rounded-xl p-3 text-sm text-zinc-500 bg-zinc-50">{tpl}</div>
          ))}
        </div>
        <h3 className="font-semibold text-zinc-900 mt-6">Editor</h3>
        <textarea className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 h-40" placeholder="Write your cover letter here..." />
        <div className="mt-4 flex gap-3">
          <PrimaryButton label="Generate from JD" />
          <SecondaryButton label="Save version" />
        </div>
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Preview</h3>
        <div className="mt-4 border border-zinc-100 rounded-xl p-6 bg-zinc-50 space-y-3">
          <div className="h-3 w-2/3 bg-white rounded"></div>
          <div className="h-3 w-full bg-white rounded"></div>
          <div className="h-3 w-5/6 bg-white rounded"></div>
          <div className="h-3 w-4/6 bg-white rounded"></div>
        </div>
        <button className="mt-6 text-sm font-semibold text-primary">Download PDF</button>
      </div>
    </div>
  </Section>
);

const PricingPage = () => (
  <Section title="Simple pricing" kicker="Pricing">
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Free</h3>
        <p className="text-3xl font-extrabold mt-3">$0</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-500">
          <li>1 resume</li>
          <li>Limited templates</li>
          <li>Basic PDF export</li>
        </ul>
        <PrimaryButton label="Start free" />
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Premium</h3>
        <p className="text-3xl font-extrabold mt-3">$19 / mo</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-500">
          <li>Unlimited resumes</li>
          <li>All templates</li>
          <li>AI rewrite + ATS checker</li>
          <li>Cover letter builder</li>
          <li>Job match feature</li>
        </ul>
        <PrimaryButton label="Upgrade" />
      </div>
    </div>
  </Section>
);

const ExamplesPage = ({ onViewExample }: { onViewExample: (role: string) => void }) => (
  <Section title="Resume examples" kicker="Examples">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {
        [
          'Software Engineer',
          'Digital Marketer',
          'Sales Manager',
          'Graphic Designer',
          'HR Executive',
          'Accountant',
          'Data Analyst',
          'Teacher',
          'Nurse',
          'Fresher / Internship',
          'Senior-level',
          'Executive',
        ]
      .map((role) => (
        <div key={role} className="border border-zinc-100 rounded-2xl p-6 bg-white hover:shadow-sm transition-shadow">
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-900">{role}</h3>
            <p className="text-sm text-zinc-500">Editable example with ATS tips.</p>
            <button onClick={() => onViewExample(role)} className="text-sm font-semibold text-primary">
              View example
            </button>
          </div>
        </div>
      ))}
    </div>
  </Section>
);

const BlogPage = ({ onReadArticle }: { onReadArticle: (article: BlogArticle) => void }) => (
  <Section title="Resources" kicker="Blog">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {
        blogArticles.map((article) => (
        <div key={article.slug} className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Guide</p>
          <h3 className="font-semibold text-zinc-900 mt-2">{article.title}</h3>
          <p className="text-sm text-zinc-500 mt-2">{article.excerpt}</p>
          <button onClick={() => onReadArticle(article)} className="mt-4 text-sm font-semibold text-primary">Read more</button>
        </div>
      ))}
    </div>
  </Section>
);

const BlogPostPage = ({ article, onBack }: { article: BlogArticle; onBack: () => void }) => (
  <Section title={article.title} kicker="Blog article">
    <button
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
    >
      <ArrowLeft className="h-4 w-4" /> Back to resources
    </button>
    <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-7 md:p-10 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        <span>{article.readTime}</span>
        <span className="h-1 w-1 rounded-full bg-zinc-300" />
        <span>{article.updated}</span>
      </div>
      <p className="mt-5 text-lg leading-8 text-zinc-600">{article.excerpt}</p>
      <div className="mt-8 space-y-8">
        {article.sections.map((section) => (
          <article key={section.heading}>
            <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900">{section.heading}</h3>
            <ul className="mt-4 space-y-3 text-zinc-600">
              {section.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  </Section>
);

const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [email, setEmail] = useState('candidate@example.com');
  const [password, setPassword] = useState('Password@123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await backendApi.login({ email, password });
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refreshToken);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      onLoginSuccess();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10">
        <div className="border border-zinc-100 rounded-2xl p-8 bg-white">
          <h2 className="text-3xl font-extrabold text-zinc-900">Welcome back</h2>
          <p className="text-zinc-500 mt-2">Sign in to access your resumes and cover letters.</p>
          <div className="mt-6 space-y-3">
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <button
              onClick={signIn}
              disabled={isSubmitting}
              className="bg-primary text-white px-6 py-3 rounded-full font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
        <div className="border border-zinc-100 rounded-2xl p-8 bg-zinc-50">
          <h3 className="font-semibold text-zinc-900">Why professionals choose RedResumes</h3>
          <ul className="mt-4 space-y-3 text-sm text-zinc-500">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> ATS-friendly templates</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> AI writing suggestions</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Unlimited versions</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

const JobFinderPage = ({ onNavigate }: { onNavigate: (page: Page) => void }) => {
  const fallbackJobs: JobItem[] = [
    {
      id: 'local-1',
      title: 'Senior Frontend Engineer',
      company: 'ArcScale Labs',
      location: 'Bengaluru, India',
      type: 'Remote',
      salary: '$55k - $78k',
      match: 92,
      skills: ['React', 'TypeScript', 'Design Systems'],
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: 'local-2',
      title: 'Product Designer',
      company: 'VelocityOS',
      location: 'Mumbai, India',
      type: 'Hybrid',
      salary: '$38k - $52k',
      match: 88,
      skills: ['Figma', 'UX Research', 'Prototyping'],
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: 'local-3',
      title: 'Growth Marketing Manager',
      company: 'Northline Commerce',
      location: 'Delhi, India',
      type: 'Onsite',
      salary: '$42k - $60k',
      match: 81,
      skills: ['SEO', 'Lifecycle', 'Performance Ads'],
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 38).toISOString(),
    },
    {
      id: 'local-4',
      title: 'Data Analyst',
      company: 'Quorix Health',
      location: 'Hyderabad, India',
      type: 'Remote',
      salary: '$30k - $44k',
      match: 79,
      skills: ['SQL', 'Power BI', 'Python'],
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    },
  ];

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [atsReadyOnly, setAtsReadyOnly] = useState(false);
  const [postedIn24hOnly, setPostedIn24hOnly] = useState(false);
  const [salaryListedOnly, setSalaryListedOnly] = useState(false);
  const [jobs, setJobs] = useState<JobItem[]>(fallbackJobs);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, 'applied' | 'interview'>>({});
  const [activeJob, setActiveJob] = useState<JobItem | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));
    const saved = window.localStorage.getItem('redresumes_saved_jobs');
    const applied = window.localStorage.getItem('redresumes_applied_jobs');
    if (saved) {
      setSavedJobs(JSON.parse(saved));
    }
    if (applied) {
      setAppliedJobs(JSON.parse(applied));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('redresumes_saved_jobs', JSON.stringify(savedJobs));
  }, [savedJobs]);

  useEffect(() => {
    window.localStorage.setItem('redresumes_applied_jobs', JSON.stringify(appliedJobs));
  }, [appliedJobs]);

  const parseExperienceRange = (value: string) => {
    const cleaned = value.toLowerCase().trim();
    if (!cleaned) return null;
    const rangeMatch = cleaned.match(/(\d+)\s*[-to]+\s*(\d+)/);
    if (rangeMatch) {
      return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
    }
    const singleMatch = cleaned.match(/(\d+)/);
    if (singleMatch) {
      const year = Number(singleMatch[1]);
      return { min: year, max: year + 1 };
    }
    return null;
  };

  const mapExperienceLevel = (value: string): JobFilters['experienceLevel'] | undefined => {
    const cleaned = value.toLowerCase().trim();
    if (!cleaned) return undefined;
    if (cleaned.includes('0') || cleaned.includes('1') || cleaned.includes('entry') || cleaned.includes('intern')) return 'entry';
    if (cleaned.includes('2') || cleaned.includes('3') || cleaned.includes('4') || cleaned.includes('mid')) return 'mid';
    if (cleaned.includes('5') || cleaned.includes('6') || cleaned.includes('senior')) return 'senior';
    if (cleaned.includes('7') || cleaned.includes('8') || cleaned.includes('9') || cleaned.includes('lead') || cleaned.includes('manager'))
      return 'lead';
    return undefined;
  };

  const detectExperienceFromText = (value: string) => {
    const text = value.toLowerCase();
    if (text.includes('intern')) return 0;
    if (text.includes('junior')) return 1;
    if (text.includes('mid') || text.includes('associate')) return 3;
    if (text.includes('senior')) return 5;
    if (text.includes('lead') || text.includes('principal') || text.includes('manager')) return 7;
    return 3;
  };

  const normalizedLocationText = (value: string) => value.toLowerCase().trim();

  const locationMatches = (requestedLocation: string, jobLocation: string) => {
    const request = normalizedLocationText(requestedLocation);
    const locationText = normalizedLocationText(jobLocation);
    if (!request) return true;
    if (locationText.includes(request)) return true;

    if (request === 'india') {
      return ['india', 'bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'pune', 'chennai', 'remote'].some((token) =>
        locationText.includes(token),
      );
    }

    return false;
  };

  const isWithinLast24Hours = (value?: string) => {
    if (!value) return false;
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= 1000 * 60 * 60 * 24;
  };

  const jobMatchesFilters = (job: JobItem, roleFilter: string, locationFilter: string, experienceRange: { min: number; max: number } | null) => {
    const role = roleFilter.toLowerCase().trim();
    const roleText = `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase();
    const roleMatch = role ? roleText.includes(role) : true;
    const locationMatch = locationMatches(locationFilter, job.location);
    const experienceMatch = experienceRange
      ? (() => {
          const estimatedYears = detectExperienceFromText(`${job.title} ${job.skills.join(' ')}`);
          return estimatedYears >= experienceRange.min && estimatedYears <= experienceRange.max + 2;
        })()
      : true;
    const remoteMatch = remoteOnly ? job.type.toLowerCase().includes('remote') || job.location.toLowerCase().includes('remote') : true;
    const atsMatch = atsReadyOnly ? job.match >= 80 : true;
    const postedMatch = postedIn24hOnly ? isWithinLast24Hours(job.postedAt) : true;
    const salaryMatch = salaryListedOnly ? job.salary !== 'Competitive' : true;
    return roleMatch && locationMatch && experienceMatch && remoteMatch && atsMatch && postedMatch && salaryMatch;
  };

  const mergeById = (jobList: JobItem[]) => {
    const seen = new Set<string>();
    return jobList.filter((job) => {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const searchJobs = async () => {
    setIsLoading(true);
    setApiError(null);
    const expRange = parseExperienceRange(level);
    try {
      const backendFilters: JobFilters = {
        keyword: query.trim() || undefined,
        location: location.trim() || undefined,
        remoteType: remoteOnly ? 'remote' : undefined,
        experienceLevel: mapExperienceLevel(level),
        salaryMin: salaryListedOnly ? 1 : undefined,
        page: 1,
        limit: 24,
      };

      const response = await backendApi.listJobs(backendFilters);
      const backendJobs = Array.isArray(response.items) ? response.items.map(mapBackendJobToUiJob) : [];
      const filteredLive = mergeById(backendJobs).filter((job) => jobMatchesFilters(job, query, location, expRange));
      const filteredCurated = fallbackJobs.filter((job) => jobMatchesFilters(job, query, location, expRange));
      const blended = mergeById([...filteredLive, ...filteredCurated]).slice(0, 16);

      if (blended.length === 0) {
        setApiError('No exact results with current filters. Try removing one or more chips.');
        setJobs([]);
      } else {
        if (filteredLive.length === 0) {
          setApiError('Backend returned limited matches for this filter. Showing blended results.');
        } else {
          setApiError(null);
        }
        setJobs(blended);
      }
    } catch {
      const filteredCurated = fallbackJobs.filter((job) => jobMatchesFilters(job, query, location, expRange));
      setApiError('Backend is unavailable right now. Showing curated results.');
      setJobs(filteredCurated.length > 0 ? filteredCurated : fallbackJobs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void searchJobs();
  }, []);

  useEffect(() => {
    void searchJobs();
  }, [remoteOnly, atsReadyOnly, postedIn24hOnly, salaryListedOnly]);

  const toggleSaveJob = async (jobId: string) => {
    const isSaved = savedJobs.includes(jobId);

    if (isSaved) {
      setSavedJobs((prev) => prev.filter((id) => id !== jobId));
      return;
    }

    if (jobId.startsWith('local-')) {
      setSavedJobs((prev) => [...prev, jobId]);
      setApiError('Saved locally. This demo job is not part of backend data.');
      return;
    }

    const token = accessToken ?? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!token) {
      setApiError('Please login first to save jobs to your account.');
      return;
    }

    try {
      await backendApi.saveJob(jobId, token);
      setSavedJobs((prev) => [...prev, jobId]);
      setApiError(null);
    } catch (saveError) {
      setApiError(saveError instanceof Error ? saveError.message : 'Failed to save job');
    }
  };

  const openApplyModal = (job: JobItem) => {
    setActiveJob(job);
    setShowApplyModal(true);
  };

  const closeApplyModal = () => {
    setShowApplyModal(false);
    setActiveJob(null);
  };

  const downloadTextFile = (fileName: string, content: string) => {
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportApplicationPack = async () => {
    if (!activeJob) return;
    const resumeContent = `Resume Draft\n\nCandidate: Your Name\nTarget Role: ${activeJob.title}\nCompany: ${activeJob.company}\nLocation: ${activeJob.location}\n\nTop Skills:\n- ${activeJob.skills.join('\n- ')}\n`;
    const coverContent = `Cover Letter Draft\n\nDear Hiring Manager,\n\nI am excited to apply for the ${activeJob.title} role at ${activeJob.company}. I bring relevant experience in ${activeJob.skills.join(', ')}.\n\nSincerely,\nYour Name\n`;
    downloadTextFile(`resume-${activeJob.id}.txt`, resumeContent);
    downloadTextFile(`cover-letter-${activeJob.id}.txt`, coverContent);

    if (activeJob.id.startsWith('local-')) {
      setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'applied' }));
      setApiError('Applied locally. This demo job is not part of backend data.');
      closeApplyModal();
      return;
    }

    const token = accessToken ?? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!token) {
      setApiError('Please login first to apply from your account.');
      return;
    }

    try {
      await backendApi.applyToJob(activeJob.id, token);
      setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'applied' }));
      setApiError(null);
    } catch (applyError) {
      setApiError(applyError instanceof Error ? applyError.message : 'Failed to apply');
      return;
    }

    closeApplyModal();
  };

  const interviewCount = Object.values(appliedJobs).filter((status) => status === 'interview').length;
  const appliedCount = Object.keys(appliedJobs).length;

  return (
    <Section title="Job finder" kicker="Find and apply faster">
      <div className="rounded-[30px] border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff8f8_45%,#f7fafc_100%)] p-6 shadow-[0_20px_54px_rgba(15,23,42,0.08)] md:p-8">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Role or keyword (e.g., Product Manager)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <input
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm"
            placeholder="Experience level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <button
            onClick={searchJobs}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search Jobs
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { label: 'Remote only', active: remoteOnly, toggle: () => setRemoteOnly((v) => !v) },
            { label: 'ATS-ready fit', active: atsReadyOnly, toggle: () => setAtsReadyOnly((v) => !v) },
            { label: 'Applied in last 24h', active: postedIn24hOnly, toggle: () => setPostedIn24hOnly((v) => !v) },
            { label: 'Salary listed', active: salaryListedOnly, toggle: () => setSalaryListedOnly((v) => !v) },
          ].map((filterItem) => (
            <button
              key={filterItem.label}
              onClick={filterItem.toggle}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filterItem.active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Filter className="h-3.5 w-3.5" /> {filterItem.label}
            </button>
          ))}
        </div>
        {apiError && <p className="mt-4 text-sm font-medium text-amber-700">{apiError}</p>}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight text-zinc-900">{job.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                    <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" /> {job.company}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>
                    <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="h-4 w-4" /> {level || job.type}</span>
                  </div>
                </div>
                <div className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {job.match}% Match
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-600">{skill}</span>
                ))}
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  {job.salary}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => openApplyModal(job)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Apply</button>
                <button
                  onClick={() => toggleSaveJob(job.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
                >
                  <Bookmark className="h-4 w-4" />
                  {savedJobs.includes(job.id) ? 'Saved' : 'Save'}
                </button>
                <button onClick={() => onNavigate('builder')} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Tailor Resume
                </button>
                <button onClick={() => onNavigate('cover-letter')} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Generate Cover Letter
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Pipeline</p>
            <h3 className="mt-2 text-xl font-extrabold text-zinc-900">Application Tracker</h3>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Saved', value: savedJobs.length },
                { label: 'Applied', value: appliedCount },
                { label: 'Interview', value: interviewCount },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-black text-zinc-900">{item.value}</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h3 className="text-base font-bold text-zinc-900">AI Suggestions</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Add React Native to increase matches by 9%.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Update summary for leadership roles.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" /> Create a remote-focused resume variant.</li>
            </ul>
            <button onClick={() => onNavigate('builder')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Optimize Resume <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showApplyModal && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">One-click apply</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{activeJob.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{activeJob.company} - {activeJob.location}</p>
              </div>
              <button onClick={closeApplyModal} className="rounded-full border border-zinc-200 p-2 text-zinc-500 hover:text-zinc-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm text-zinc-600">
              Export ready drafts for both resume and cover letter, then mark this role as applied in your tracker.
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={exportApplicationPack} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                Export Resume + Cover Letter
              </button>
              <button
                onClick={() => {
                  setAppliedJobs((prev) => ({ ...prev, [activeJob.id]: 'interview' }));
                  closeApplyModal();
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400"
              >
                Mark as Interview
              </button>
              {activeJob.url && (
                <a href={activeJob.url} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                  Open Job Posting
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
};

const DashboardPage = () => (
  <Section title="Your dashboard" kicker="Account">
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div className="space-y-6">
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <h3 className="font-semibold text-zinc-900">My resumes</h3>
          <div className="mt-4 space-y-3 text-sm">
            {['Senior Product Manager', 'Marketing Lead', 'Operations Manager'].map((title) => (
              <div key={title} className="flex items-center justify-between border border-zinc-100 rounded-lg px-3 py-2">
                <span>{title}</span>
                <button className="text-xs text-primary">Edit</button>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <h3 className="font-semibold text-zinc-900">My cover letters</h3>
          <div className="mt-4 space-y-3 text-sm">
            {['VP Sales - Q2', 'Product Designer - Remote'].map((title) => (
              <div key={title} className="flex items-center justify-between border border-zinc-100 rounded-lg px-3 py-2">
                <span>{title}</span>
                <button className="text-xs text-primary">Open</button>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <h3 className="font-semibold text-zinc-900">Job applications tracker</h3>
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            {['Applied', 'Interview', 'Offer'].map((stage) => (
              <div key={stage} className="border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{stage}</p>
                <p className="text-2xl font-bold mt-2">{stage === 'Applied' ? '6' : stage === 'Interview' ? '2' : '1'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <h3 className="font-semibold text-zinc-900">Profile settings</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-500">
            <div className="flex items-center justify-between"><span>Subscription</span><button className="text-primary text-xs">Manage</button></div>
            <div className="flex items-center justify-between"><span>Billing</span><button className="text-primary text-xs">Update</button></div>
            <div className="flex items-center justify-between"><span>Notifications</span><button className="text-primary text-xs">Edit</button></div>
          </div>
        </div>
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
          <h3 className="font-semibold text-zinc-900">Recent downloads</h3>
          <div className="mt-4 space-y-2 text-sm text-zinc-500">
            <div className="flex items-center justify-between"><span>Senior PM Resume</span><span>PDF</span></div>
            <div className="flex items-center justify-between"><span>Marketing Lead Resume</span><span>PDF</span></div>
          </div>
        </div>
      </div>
    </div>
  </Section>
);

const ContactPage = () => (
  <Section title="Contact & support" kicker="Support">
    <div className="grid md:grid-cols-2 gap-8">
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">How can we help?</h3>
        <ul className="mt-4 space-y-3 text-sm text-zinc-500">
          <li className="flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-primary" /> Account & billing</li>
          <li className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Template questions</li>
          <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI & ATS support</li>
        </ul>
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Send a message</h3>
        <div className="mt-4 space-y-3">
          <input className="w-full border border-zinc-200 rounded-lg px-3 py-2" placeholder="Name" />
          <input className="w-full border border-zinc-200 rounded-lg px-3 py-2" placeholder="Email" />
          <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 h-32" placeholder="How can we help?" />
          <PrimaryButton label="Send" />
        </div>
      </div>
    </div>
  </Section>
);

const LegalPage = ({ title }: { title: string }) => (
  <Section title={title} kicker="Legal">
    <div className="grid md:grid-cols-[220px_1fr] gap-8">
      <div className="space-y-2 text-sm text-zinc-500">
        {['Overview', 'Data collection', 'Usage', 'Security', 'Contact'].map((item) => (
          <div key={item} className="border border-zinc-100 rounded-lg px-3 py-2 bg-white">{item}</div>
        ))}
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white text-sm text-zinc-600 space-y-4">
        <p>This is a UI-only mock page. Replace with legal copy before launch.</p>
        <p>We collect only the information needed to provide resume building services.</p>
        <p>You can request data deletion anytime by contacting support.</p>
      </div>
    </div>
  </Section>
);

const AdminPage = () => (
  <Section title="Admin panel" kicker="Admin">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {
        [
          { label: 'User management', icon: Users },
          { label: 'Template management', icon: Layout },
          { label: 'Subscription management', icon: CreditCard },
          { label: 'Coupon codes', icon: TicketIcon },
          { label: 'Blog management', icon: BookOpen },
          { label: 'Resume examples', icon: FileText },
          { label: 'Analytics dashboard', icon: TrendingUp },
          { label: 'Support tickets', icon: LifeBuoy },
          { label: 'Email automation', icon: Mail },
          { label: 'Referral system', icon: Users },
        ]
      .map((item) => (
        <div key={item.label} className="border border-zinc-100 rounded-2xl p-6 bg-white flex items-center gap-3">
          <item.icon className="w-5 h-5 text-primary" />
          <span className="font-semibold text-zinc-900">{item.label}</span>
        </div>
      ))}
    </div>
  </Section>
);

const TicketIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M7 9v6" />
    <path d="M17 9v6" />
  </svg>
);

// --- App ---

const App = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem>(templates[0]);
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [selectedBlogArticle, setSelectedBlogArticle] = useState<BlogArticle>(blogArticles[0]);

  const handleUseTemplate = (template: TemplateItem) => {
    setSelectedTemplate(template);
    setSelectedExample(null);
    setCurrentPage('builder');
  };

  const handleViewExample = (role: string) => {
    setSelectedExample(role);
    setCurrentPage('builder');
  };

  const handleReadArticle = (article: BlogArticle) => {
    setSelectedBlogArticle(article);
    setCurrentPage('blog-post');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} onUseTemplate={handleUseTemplate} />;
      case 'builder':
        return <ResumeBuilderPage selectedTemplate={selectedTemplate} selectedExample={selectedExample} />;
      case 'templates':
        return <TemplatesPage onUseTemplate={handleUseTemplate} />;
      case 'cover-letter':
        return <CoverLetterPage />;
      case 'pricing':
        return <PricingPage />;
      case 'examples':
        return <ExamplesPage onViewExample={handleViewExample} />;
      case 'job-finder':
        return <JobFinderPage onNavigate={setCurrentPage} />;
      case 'blog':
        return <BlogPage onReadArticle={handleReadArticle} />;
      case 'blog-post':
        return <BlogPostPage article={selectedBlogArticle} onBack={() => setCurrentPage('blog')} />;
      case 'login':
        return <LoginPage onLoginSuccess={() => setCurrentPage('job-finder')} />;
      case 'dashboard':
        return <DashboardPage />;
      case 'contact':
        return <ContactPage />;
      case 'privacy':
        return <LegalPage title="Privacy Policy" />;
      case 'terms':
        return <LegalPage title="Terms of Service" />;
      case 'admin':
        return <AdminPage />;
      default:
        return <HomePage onNavigate={setCurrentPage} onUseTemplate={handleUseTemplate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1">{renderPage()}</main>
      <Footer onNavigate={setCurrentPage} />
    </div>
  );
};

export default App;
