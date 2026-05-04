import type { TemplateItem } from '../types';
import professionalImg from '../assets/templates/professional.svg';
import modernImg from '../assets/templates/modern.svg';
import minimalImg from '../assets/templates/minimal.svg';
import creativeImg from '../assets/templates/creative.svg';
import fresherImg from '../assets/templates/fresher.svg';
import executiveImg from '../assets/templates/executive.svg';
import technicalImg from '../assets/templates/technical.svg';
import twoColumnImg from '../assets/templates/two-column.svg';
import consultingImg from '../assets/templates/consulting.svg';
import startupImg from '../assets/templates/startup.svg';
import corporateImg from '../assets/templates/corporate.svg';
import academicImg from '../assets/templates/academic.svg';
import salesImg from '../assets/templates/sales.svg';
import designerImg from '../assets/templates/designer.svg';
import productImg from '../assets/templates/product.svg';
import operationsImg from '../assets/templates/operations.svg';
import financeImg from '../assets/templates/finance.svg';
import professionalFullImg from '../assets/templates/professional.png';
import modernFullImg from '../assets/templates/modern.png';
import minimalFullImg from '../assets/templates/minimal.png';
import creativeFullImg from '../assets/templates/creative.png';
import fresherFullImg from '../assets/templates/fresher.png';
import executiveFullImg from '../assets/templates/executive.png';
import technicalFullImg from '../assets/templates/technical.png';
import twoColumnFullImg from '../assets/templates/two-column.png';
import consultingFullImg from '../assets/templates/consulting.png';

export const templates: TemplateItem[] = [
  { id: 'professional', name: 'Professional', desc: 'Classic ATS-friendly format', tag: 'Most popular', image: professionalImg, fullPreviewImage: professionalFullImg },
  { id: 'modern', name: 'Modern', desc: 'Clean, balanced layout', tag: 'Clean layout', image: modernImg, fullPreviewImage: modernFullImg },
  { id: 'minimal', name: 'Minimal', desc: 'Elegant typography-first', tag: 'ATS-first', image: minimalImg, fullPreviewImage: minimalFullImg },
  { id: 'creative', name: 'Creative', desc: 'Great for design roles', tag: 'Designer-ready', image: creativeImg, fullPreviewImage: creativeFullImg },
  { id: 'fresher', name: 'Fresher', desc: 'Perfect for new grads', tag: 'New grads', image: fresherImg, fullPreviewImage: fresherFullImg },
  { id: 'executive', name: 'Executive', desc: 'Leadership-ready layout', tag: 'Leadership', image: executiveImg, fullPreviewImage: executiveFullImg },
  { id: 'technical', name: 'Technical', desc: 'Engineering-heavy focus', tag: 'Engineering', image: technicalImg, fullPreviewImage: technicalFullImg },
  { id: 'two-column', name: 'Two-column', desc: 'Compact information density', tag: 'Compact', image: twoColumnImg, fullPreviewImage: twoColumnFullImg },
  { id: 'consulting', name: 'Consulting', desc: 'Case interview style', tag: 'Strategy', image: consultingImg, fullPreviewImage: consultingFullImg },
  { id: 'startup', name: 'Startup', desc: 'Bold profile-first layout', tag: 'Trendy', image: startupImg, fullPreviewImage: startupImg },
  { id: 'corporate', name: 'Corporate', desc: 'Structured enterprise style', tag: 'Enterprise', image: corporateImg, fullPreviewImage: corporateImg },
  { id: 'academic', name: 'Academic', desc: 'Research and publication focus', tag: 'Research', image: academicImg, fullPreviewImage: academicImg },
  { id: 'sales', name: 'Sales', desc: 'Achievement and metrics spotlight', tag: 'Revenue-first', image: salesImg, fullPreviewImage: salesImg },
  { id: 'designer', name: 'Designer', desc: 'Visual hierarchy with personality', tag: 'Portfolio-ready', image: designerImg, fullPreviewImage: designerImg },
  { id: 'product', name: 'Product', desc: 'Product thinking and impact flow', tag: 'PM pick', image: productImg, fullPreviewImage: productImg },
  { id: 'operations', name: 'Operations', desc: 'Process and execution format', tag: 'Execution', image: operationsImg, fullPreviewImage: operationsImg },
  { id: 'finance', name: 'Finance', desc: 'Conservative and detail-oriented', tag: 'Analytical', image: financeImg, fullPreviewImage: financeImg },
];

export const templateCardTone: Record<string, { accent: string; shell: string; chip: string; preview: string }> = {
  professional: {
    accent: 'text-slate-700',
    shell: 'bg-[linear-gradient(160deg,#f8fafc_0%,#eef2f7_100%)]',
    chip: 'border-slate-200 bg-slate-100 text-slate-700',
    preview: 'bg-white',
  },
  modern: {
    accent: 'text-sky-700',
    shell: 'bg-[linear-gradient(160deg,#eef6ff_0%,#e0f2fe_100%)]',
    chip: 'border-sky-200 bg-sky-100 text-sky-800',
    preview: 'bg-white',
  },
  minimal: {
    accent: 'text-zinc-700',
    shell: 'bg-[linear-gradient(160deg,#fafafa_0%,#f4f4f5_100%)]',
    chip: 'border-zinc-200 bg-zinc-100 text-zinc-700',
    preview: 'bg-white',
  },
  creative: {
    accent: 'text-amber-700',
    shell: 'bg-[linear-gradient(160deg,#fff7ed_0%,#ffedd5_100%)]',
    chip: 'border-amber-200 bg-amber-100 text-amber-800',
    preview: 'bg-white',
  },
  fresher: {
    accent: 'text-emerald-700',
    shell: 'bg-[linear-gradient(160deg,#ecfdf5_0%,#dcfce7_100%)]',
    chip: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    preview: 'bg-white',
  },
  executive: {
    accent: 'text-slate-800',
    shell: 'bg-[linear-gradient(160deg,#eef2ff_0%,#e0e7ff_100%)]',
    chip: 'border-indigo-200 bg-indigo-100 text-indigo-800',
    preview: 'bg-white',
  },
  technical: {
    accent: 'text-blue-700',
    shell: 'bg-[linear-gradient(160deg,#eff6ff_0%,#dbeafe_100%)]',
    chip: 'border-blue-200 bg-blue-100 text-blue-800',
    preview: 'bg-white',
  },
  'two-column': {
    accent: 'text-violet-700',
    shell: 'bg-[linear-gradient(160deg,#f5f3ff_0%,#ede9fe_100%)]',
    chip: 'border-violet-200 bg-violet-100 text-violet-800',
    preview: 'bg-white',
  },
};

export const templateQuickTraits: Record<string, string[]> = {
  professional: ['ATS safe', 'Balanced spacing'],
  modern: ['Clean hierarchy', 'Easy to scan'],
  minimal: ['Typography first', 'Low distraction'],
  creative: ['Visual personality', 'Portfolio feel'],
  fresher: ['Entry-level ready', 'Simple sections'],
  executive: ['Leadership tone', 'Premium header'],
  technical: ['Skills focus', 'Dense but readable'],
  'two-column': ['Compact layout', 'More content'],
};

export const templatePreviewThemeById: Record<string, { accent: string; headerBg: string; twoColumn: boolean }> = {
  professional: { accent: '#b91c1c', headerBg: '#f8fafc', twoColumn: false },
  modern: { accent: '#1d4ed8', headerBg: '#eef2ff', twoColumn: false },
  minimal: { accent: '#334155', headerBg: '#f8fafc', twoColumn: false },
  creative: { accent: '#c2410c', headerBg: '#fff7ed', twoColumn: true },
  technical: { accent: '#1d4ed8', headerBg: '#eff6ff', twoColumn: true },
  'two-column': { accent: '#0f172a', headerBg: '#f1f5f9', twoColumn: true },
  executive: { accent: '#1e293b', headerBg: '#eef2ff', twoColumn: false },
  fresher: { accent: '#15803d', headerBg: '#ecfdf5', twoColumn: false },
  consulting: { accent: '#0f766e', headerBg: '#ecfeff', twoColumn: true },
  startup: { accent: '#7c3aed', headerBg: '#f5f3ff', twoColumn: true },
  corporate: { accent: '#0f172a', headerBg: '#f8fafc', twoColumn: false },
  academic: { accent: '#1e40af', headerBg: '#eff6ff', twoColumn: true },
  sales: { accent: '#be123c', headerBg: '#fff1f2', twoColumn: false },
  designer: { accent: '#ea580c', headerBg: '#fff7ed', twoColumn: true },
  product: { accent: '#0f766e', headerBg: '#ecfeff', twoColumn: false },
  operations: { accent: '#166534', headerBg: '#f0fdf4', twoColumn: true },
  finance: { accent: '#1e293b', headerBg: '#f8fafc', twoColumn: true },
};
