import { useState } from 'react';
import { LifeBuoy, FileText, Sparkles } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton } from '../components/Buttons';
import { Seo } from '../components/Seo';

export const ContactPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = () => {
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please enter a message with at least 10 characters.');
      return;
    }

    const subject = encodeURIComponent(`RedResumes Support Request from ${name.trim()}`);
    const body = encodeURIComponent(`Name: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${message.trim()}`);
    window.open(`mailto:support@redresumes.com?subject=${subject}&body=${body}`, '_self');
    setSuccess('Your email draft was opened. Please send it to complete your support request.');
  };

  return (
    <>
      <Seo
        title="Contact Us | Support & Feedback | Red Resumes"
        description="Have questions or feedback? Contact the Red Resumes support team. We're here to help you build a better career."
      />
      <Section h1 title="Contact & support" kicker="Support">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <h2 className="font-semibold text-zinc-900 text-lg">How can we help?</h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-500">
              <li className="flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-primary" /> Account & billing</li>
              <li className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Template questions</li>
              <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI & ATS support</li>
            </ul>
          </div>
          <div className="border border-zinc-100 rounded-2xl p-6 bg-white">
            <h2 className="font-semibold text-zinc-900 text-lg">Send a message</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full border border-zinc-200 rounded-lg px-3 py-2"
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="w-full border border-zinc-200 rounded-lg px-3 py-2"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <textarea
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 h-32"
                placeholder="How can we help?"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
              {success && <p className="text-sm font-medium text-emerald-700">{success}</p>}
              <PrimaryButton label="Send" onClick={handleSend} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
};
