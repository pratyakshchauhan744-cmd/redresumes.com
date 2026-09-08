import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const RoleGuideBreadcrumb = ({ items }: { items: BreadcrumbItem[] }) => {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="font-medium hover:text-primary transition-colors focus-visible:rounded"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`font-semibold ${isLast ? 'text-zinc-900 dark:text-zinc-100' : ''}`}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
};
