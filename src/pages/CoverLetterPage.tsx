import { FileText, Wand2, Download } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton } from '../components/Buttons';

export const CoverLetterPage = () => (
  <Section title="Cover letter builder" kicker="Cover letters">
    <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Select resume</h3>
        <div className="mt-4 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-500">VP Marketing Resume</div>
        <h3 className="font-semibold text-zinc-900 mt-6">Template</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {['Formal', 'Modern', 'Executive', 'Creative'].map((tpl) => (
            <div key={tpl} className="border border-zinc-100 rounded-xl p-3 text-sm text-zinc-500 bg-zinc-50">{tpl}</div>
          ))}
        </div>
        <h3 className="font-semibold text-zinc-900 mt-6">Editor</h3>
        <textarea className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 h-40" placeholder="Write your cover letter here..." />
        <div className="mt-4 flex gap-3">
          <PrimaryButton label="Generate from JD" />
          <SecondaryButton label="Save version" />
        </div>
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Preview</h3>
        <div className="mt-4 border border-zinc-100 rounded-xl p-6 bg-zinc-50 space-y-3">
          <div className="h-3 w-2/3 bg-white rounded"></div>
          <div className="h-3 w-full bg-white rounded"></div>
          <div className="h-3 w-5/6 bg-white rounded"></div>
          <div className="h-3 w-4/6 bg-white rounded"></div>
        </div>
        <button className="mt-6 text-sm font-semibold text-primary">Download PDF</button>
      </div>
    </div>
  </Section>
);

