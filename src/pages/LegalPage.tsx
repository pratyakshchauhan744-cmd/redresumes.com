import { Section } from '../components/Section';
import { Seo } from '../components/Seo';

export const LegalPage = ({ title }: { title: string }) => (
  <>
    <Seo
      title={`${title} | Red Resumes`}
      description={`Read the official ${title} for Red Resumes. Understand your rights and how we manage security and data collection.`}
    />
    <Section h1 title={title} kicker="Legal">
      <div className="grid md:grid-cols-[220px_1fr] gap-8">
        <div className="space-y-2 text-sm text-zinc-500">
          {['Overview', 'Data collection', 'Usage', 'Security', 'Contact'].map((item) => (
            <div key={item} className="border border-zinc-100 rounded-lg px-3 py-2 bg-white">{item}</div>
          ))}
        </div>
        <div className="border border-zinc-100 rounded-2xl p-6 bg-white text-sm text-zinc-600 space-y-4">
          <p>This is a UI-only mock page. Replace with legal copy before launch.</p>
          <p>We collect only the information needed to provide resume building services.</p>
          <p>You can request data deletion anytime by contacting support.</p>
        </div>
      </div>
    </Section>
  </>
);
