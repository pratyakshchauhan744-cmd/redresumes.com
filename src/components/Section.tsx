import { type ReactNode } from 'react';

export const Section = ({
  title,
  kicker,
  h1 = false,
  children,
}: {
  title: string;
  kicker?: string;
  h1?: boolean;
  children: ReactNode;
}) => {
  const Heading = h1 ? 'h1' : 'h2';
  return (
    <section className="py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {kicker && (
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-xs md:tracking-[0.2em]">
            {kicker}
          </p>
        )}
        <Heading className="mt-2 text-2xl font-extrabold leading-tight text-zinc-900 md:mt-3 md:text-4xl">
          {title}
        </Heading>
        <div className="mt-6 md:mt-10">{children}</div>
      </div>
    </section>
  );
};
