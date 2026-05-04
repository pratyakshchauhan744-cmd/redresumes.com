import { type ReactNode } from 'react';

export const Section = ({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) => (
  <section className="py-16">
    <div className="max-w-7xl mx-auto px-6">
      {kicker && <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">{kicker}</p>}
      <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mt-3">{title}</h2>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);
