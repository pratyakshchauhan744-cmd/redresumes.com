import { useState, useEffect } from 'react';
import { List, ChevronDown } from 'lucide-react';
import { RoleGuidePromoCard } from './RoleGuidePromoCard';

export interface TOCItem {
  id: string;
  label: string;
}

export const RoleGuideTOC = ({
  items,
  roleSlug,
  roleTitle,
}: {
  items: TOCItem[];
  roleSlug: string;
  roleTitle: string;
}) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const handleScrollTo = (id: string) => {
    setMobileOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {/* Mobile Collapsible Accordion (Shown only on small/medium screens) */}
      <div className="lg:hidden mb-8 rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-bold text-zinc-900 dark:text-zinc-100"
          aria-expanded={mobileOpen}
        >
          <span className="flex items-center gap-2">
            <List className="h-4 w-4 text-primary" />
            Table of Contents
          </span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
              mobileOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {mobileOpen && (
          <nav className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <ul className="space-y-1">
              {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleScrollTo(item.id)}
                      className={`block w-full py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? 'font-bold text-primary dark:text-red-400'
                          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>

      {/* Desktop Sticky Sidebar (Shown on large screens) */}
      <aside className="hidden lg:block lg:w-72 shrink-0">
        <div className="sticky top-24 space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <List className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                On This Page
              </h3>
            </div>

            <nav className="mt-4">
              <ul className="space-y-1 text-xs">
                {items.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleScrollTo(item.id)}
                        className={`group flex w-full items-center text-left py-1.5 px-2.5 rounded-lg transition-all ${
                          isActive
                            ? 'bg-red-50 font-bold text-primary dark:bg-red-950/40 dark:text-red-300'
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200'
                        }`}
                      >
                        <span
                          className={`mr-2 h-1.5 w-1.5 rounded-full transition-colors ${
                            isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-zinc-300'
                          }`}
                        />
                        <span className="line-clamp-1">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <RoleGuidePromoCard roleSlug={roleSlug} roleTitle={roleTitle} />
        </div>
      </aside>
    </>
  );
};
