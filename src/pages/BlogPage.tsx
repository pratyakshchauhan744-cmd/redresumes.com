import { Section } from '../components/Section';
import { blogArticles } from '../data/blogArticles';
import type { BlogArticle } from '../types';
import { useNavigate } from 'react-router-dom';

export const BlogPage = ({ onReadArticle }: { onReadArticle: (article: BlogArticle) => void }) => {
  const navigate = useNavigate();

  return (
    <Section title="Resources" kicker="Blog">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogArticles.map((article) => (
          <div key={article.slug} className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Guide</p>
            <h3 className="font-semibold text-zinc-900 mt-2">{article.title}</h3>
            <p className="text-sm text-zinc-500 mt-2">{article.excerpt}</p>
            <button
              onClick={() => {
                onReadArticle(article);
                navigate('/blog/post');
              }}
              className="mt-4 text-sm font-semibold text-primary"
            >
              Read more
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
};
