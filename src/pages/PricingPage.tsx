import { CheckCircle } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton } from '../components/Buttons';

export const PricingPage = () => (
  <Section title="Simple pricing" kicker="Pricing">
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Free</h3>
        <p className="text-3xl font-extrabold mt-3">$0</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-500">
          <li>1 resume</li>
          <li>Limited templates</li>
          <li>Basic PDF export</li>
        </ul>
        <PrimaryButton label="Start free" />
      </div>
      <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
        <h3 className="font-semibold text-zinc-900">Premium</h3>
        <p className="text-3xl font-extrabold mt-3">$19 / mo</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-500">
          <li>Unlimited resumes</li>
          <li>All templates</li>
          <li>AI rewrite + ATS checker</li>
          <li>Cover letter builder</li>
          <li>Job match feature</li>
        </ul>
        <PrimaryButton label="Upgrade" />
      </div>
    </div>
  </Section>
);

