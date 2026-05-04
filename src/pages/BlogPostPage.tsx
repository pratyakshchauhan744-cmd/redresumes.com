import { ArrowLeft, Check } from 'lucide-react';
import { Section } from '../components/Section';
import type { BlogArticle } from '../types';

export const BlogPostPage = ({ article, onBack }: { article: BlogArticle; onBack: () => void }) => (
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
