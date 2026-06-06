import { Section } from '../components/Section';
import { blogArticles } from '../data/blogArticles';
import type { BlogArticle } from '../types';
import { useNavigate } from 'react-router-dom';
import { Seo } from '../components/Seo';

export const BlogPage = ({ onReadArticle }: { onReadArticle: (article: BlogArticle) => void }) => {
  const navigate = useNavigate();

  return (
    <>
      <Seo
        title="Red Resumes Blog | Career Tips, Resume Guides & Job Search Strategy"
        description="Get expert advice on writing resumes, beating ATS screening, preparing for interviews, and growing your career."
      />
      <Section h1 title="Resources" kicker="Blog">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogArticles.map((article) => (
            <div key={article.slug} className="border border-zinc-100 rounded-2xl p-6 bg-white">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Guide</p>
              <h2 className="font-semibold text-zinc-900 mt-2 text-base">{article.title}</h2>
              <p className="text-sm text-zinc-500 mt-2">{article.excerpt}</p>
              <button
                onClick={() => {
                  onReadArticle(article);
                  navigate('/blog/post');
                }}
                className="mt-4 text-sm font-semibold text-primary"
              >
                Read article
              </button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
};
