import { type ReactNode } from 'react';

export const Section = ({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) => (
  <section className="py-10 md:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {kicker && <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-xs md:tracking-[0.2em]">{kicker}</p>}
      <h2 className="mt-2 text-2xl font-extrabold leading-tight text-zinc-900 md:mt-3 md:text-4xl">{title}</h2>
      <div className="mt-6 md:mt-10">{children}</div>
    </div>
  </section>
);
