import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { RoleGuideFaq as RoleGuideFaqType } from '../../data/roleGuides';

export const RoleGuideFaq = ({
  roleTitle,
  faqs,
}: {
  roleTitle: string;
  faqs: RoleGuideFaqType[];
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faqs" className="space-y-6 scroll-mt-24">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary dark:text-red-400">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Helpful Answers</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl dark:text-white">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Answers to the most common questions about writing a {roleTitle.toLowerCase()} resume.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => toggleFaq(index)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-zinc-900 transition-colors hover:text-primary dark:text-zinc-100 dark:hover:text-red-400"
                aria-expanded={isOpen}
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary dark:text-red-400' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="border-t border-zinc-100 px-5 pb-5 pt-3 dark:border-zinc-800">
                  <p className="text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
