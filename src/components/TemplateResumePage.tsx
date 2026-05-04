import type { TemplateItem, TemplateResumeData } from '../types';
import { templatePreviewThemeById } from '../data/templates';

export const TemplateResumePage = ({ template, data, embedded = false }: { template: TemplateItem; data?: TemplateResumeData; embedded?: boolean }) => {
  const theme = templatePreviewThemeById[template.id] || templatePreviewThemeById.modern;
  const isLiveData = Boolean(data);
  const fullName = data?.fullName?.trim() || (isLiveData ? '' : 'Alex Morgan');
  const roleTitle = data?.jobTitle?.trim() || (isLiveData ? '' : 'Senior Product Manager');
  const emailText = data?.email?.trim() || (isLiveData ? '' : 'alexmorgan@email.com');
  const phoneText = data?.phone?.trim() || (isLiveData ? '' : '+1 (555) 123-4567');
  const locationText = data?.location?.trim() || (isLiveData ? '' : 'New York, NY');
  const profileText = data?.profileLink?.trim() || (isLiveData ? '' : 'linkedin.com/in/alexmorgan');
  const skills = data?.skills?.length ? data.skills : (isLiveData ? [] : ['Product Strategy', 'Analytics', 'Roadmapping', 'Leadership', 'SQL', 'Stakeholder Management']);
  const bullets = data?.bullets?.length ? data.bullets : (isLiveData ? [] : [
    'Led product roadmap for 2 B2B tools, improving activation by 21%.',
    'Collaborated with design and engineering to launch 6 major features.',
    'Reduced onboarding friction, cutting support tickets by 34%.',
  ]);
  const projects = data?.projects?.length ? data.projects : (isLiveData ? [] : ['Built a resume scoring tool using React and Node.js.', 'Created an analytics dashboard to track job applications.']);
  const certifications = data?.certifications?.length ? data.certifications : (isLiveData ? [] : ['Google Data Analytics', 'AWS Cloud Practitioner']);
  const languages = data?.languages?.length ? data.languages : (isLiveData ? [] : ['English', 'Hindi']);
  const hobbies = data?.hobbies?.length ? data.hobbies : (isLiveData ? [] : ['Reading', 'Running', 'Chess']);
  const achievements = data?.achievements?.length ? data.achievements : (isLiveData ? [] : ['Won hackathon among 120+ teams.']);
  const volunteer = data?.volunteer?.length ? data.volunteer : (isLiveData ? [] : ['Mentored students in resume writing and interview prep.']);
  const summary = data?.summary?.trim() || (isLiveData ? '' : 'Product leader with 8+ years of experience building growth-focused digital products, leading cross-functional teams, and improving user conversion through data-driven decisions.');
  const educationDegree = data?.educationDegree?.trim() || (isLiveData ? '' : 'B.Tech in Computer Science');
  const educationSchool = data?.educationSchool?.trim() || (isLiveData ? '' : 'National Institute of Technology');
  const educationYear = data?.educationYear?.trim() || (isLiveData ? '' : '2018 - 2022');
  const contactLine = [emailText, phoneText, locationText].filter(Boolean).join(' • ');

  const sectionTitle = (label: string, color?: string) => (
    <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: color || theme.accent }}>
      {label}
    </p>
  );

  const embeddedClass = embedded
    ? 'w-full max-w-full overflow-hidden text-[10px] leading-[1.35] sm:text-[11px] [&_h2]:!text-[1.45rem] [&_p]:leading-[1.35] [&_ul]:text-[10px] [&_li]:leading-[1.35]'
    : '';
  const twoColMainClass = embedded ? 'grid-cols-1 md:grid-cols-[0.95fr_1.65fr]' : 'grid-cols-[0.95fr_1.65fr]';
  const creativeClass = embedded ? 'grid-cols-1 md:grid-cols-[0.35fr_1fr]' : 'grid-cols-[0.35fr_1fr]';
  const technicalClass = embedded ? 'grid-cols-1 md:grid-cols-[0.85fr_1.7fr]' : 'grid-cols-[0.85fr_1.7fr]';
  const equalTwoColClass = embedded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2';
  const unevenTwoColClass = embedded ? 'grid-cols-1 md:grid-cols-[1.2fr_1fr]' : 'grid-cols-[1.2fr_1fr]';
  const financeClass = embedded ? 'grid-cols-1 md:grid-cols-[1fr_1.3fr]' : 'grid-cols-[1fr_1.3fr]';

  if (template.id === 'professional') {
    return (
      <div className={`border border-zinc-300 bg-white px-12 py-10 text-zinc-900 ${embeddedClass}`}>
        <h2 className="text-5xl font-black tracking-[-0.04em]">{fullName || 'Your Name'}</h2>
        {roleTitle && <p className="mt-2 text-2xl font-semibold text-zinc-700">{roleTitle}</p>}
        {contactLine && <p className="mt-3 break-words text-lg text-zinc-600">{contactLine}</p>}
        {profileText && <p className="break-words text-lg text-zinc-600">{profileText}</p>}
        <div className="mt-7 space-y-6">
          {summary && <div>
            <p className="border-b border-zinc-300 pb-2 text-sm font-extrabold uppercase tracking-[0.22em] text-rose-700">Summary</p>
            <p className="pt-3 text-lg leading-8 text-zinc-700">{summary}</p>
          </div>}
          {bullets.length > 0 && <div>
            <p className="border-b border-zinc-300 pb-2 text-sm font-extrabold uppercase tracking-[0.22em] text-rose-700">Experience</p>
            <p className="pt-3 text-2xl font-bold">Senior Product Manager - Acme Corp</p>
            <p className="text-lg text-zinc-600">Jan 2022 - Present</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">
              {bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>}
        </div>
      </div>
    );
  }

  if (template.id === 'two-column') {
    return (
      <div className={`grid ${twoColMainClass} border border-zinc-200 bg-white ${embeddedClass}`}>
        <aside className="border-r border-zinc-200 bg-slate-50 p-8">
          <h2 className="text-4xl font-black tracking-[-0.04em] text-slate-900">{fullName}</h2>
          <p className="mt-1 text-xl font-semibold text-slate-700">{roleTitle}</p>
          <p className="mt-3 text-base leading-7 text-slate-600">{emailText}<br />{phoneText}<br />{locationText}<br />{profileText}</p>
          <div className="mt-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-900">Skills</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {skills.map((skill) => <p key={skill}>{skill}</p>)}
            </div>
          </div>
        </aside>
        <main className="p-8">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-slate-900">Summary</p>
          <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
          <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.22em] text-slate-900">Experience</p>
          <p className="mt-3 text-2xl font-bold text-zinc-900">Senior Product Manager - Acme Corp</p>
          <p className="text-lg text-zinc-600">Jan 2022 - Present</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">
            {bullets.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </main>
      </div>
    );
  }

  if (template.id === 'creative') {
    return (
      <div className={`border border-zinc-200 bg-white ${embeddedClass}`}>
        <div className={`grid ${embedded ? 'grid-cols-1' : creativeClass}`}>
          <aside className={`bg-orange-500 text-white ${embedded ? 'p-4' : 'p-6'}`}>
            <div className="h-16 w-16 rounded-2xl bg-white/25" />
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em]">Creative Profile</p>
            <p className="mt-2 break-words text-sm leading-6 text-orange-50">Product storyteller, cross-team collaborator, and UX-driven decision maker.</p>
          </aside>
          <main className={`min-w-0 ${embedded ? 'p-4' : 'p-8'}`}>
            <h2 className={`${embedded ? 'text-3xl' : 'text-5xl'} break-words font-black tracking-[-0.04em] text-zinc-900`}>{fullName}</h2>
            {roleTitle && <p className={`mt-2 break-words ${embedded ? 'text-xl' : 'text-2xl'} font-semibold text-zinc-700`}>{roleTitle}</p>}
            {contactLine && <p className={`mt-3 break-words ${embedded ? 'text-base' : 'text-lg'} text-zinc-600`}>{contactLine}</p>}
            {profileText && <p className={`break-words ${embedded ? 'text-base' : 'text-lg'} text-zinc-600`}>{profileText}</p>}
            <div className="mt-6">
              <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-orange-700">Impact Highlights</p>
              <ul className={`mt-3 list-disc pl-6 text-zinc-700 ${embedded ? 'space-y-1 text-base' : 'space-y-2 text-lg'}`}>
                {bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (template.id === 'minimal') {
    return (
      <div className={`border border-zinc-200 bg-white px-14 py-12 ${embeddedClass}`}>
        <h2 className="text-5xl font-bold tracking-tight text-zinc-900">{fullName}</h2>
        <p className="mt-2 text-2xl text-zinc-700">{roleTitle}</p>
        <p className="mt-2 text-base text-zinc-500">{emailText} • {phoneText} • {locationText} • {profileText}</p>
        <div className="mt-8 space-y-7">
          <div>
            {sectionTitle('Summary', '#334155')}
            <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
          </div>
          <div>
            {sectionTitle('Experience', '#334155')}
            <p className="mt-3 text-xl font-semibold text-zinc-900">Senior Product Manager - Acme Corp</p>
            <p className="text-base text-zinc-500">Jan 2022 - Present</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'executive') {
    return (
      <div className={`border border-zinc-300 bg-white ${embeddedClass}`}>
        <div className="bg-slate-900 px-10 py-8 text-white">
          <h2 className="text-5xl font-black tracking-[-0.04em]">{fullName}</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-200">{roleTitle}</p>
          <p className="mt-3 text-base text-slate-300">{emailText} • {phoneText} • {locationText}</p>
        </div>
        <div className={`grid ${unevenTwoColClass} gap-8 p-8`}>
          <div>
            {sectionTitle('Executive Summary', '#1e293b')}
            <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
            <div className="mt-6">
              {sectionTitle('Key Results', '#1e293b')}
              <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <div>
            {sectionTitle('Core Skills', '#1e293b')}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-700">{skills.map((skill) => <p key={skill}>• {skill}</p>)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'technical') {
    return (
      <div className={`grid ${technicalClass} border border-blue-200 bg-white ${embeddedClass}`}>
        <aside className="bg-blue-50 p-7">
          <h2 className="text-3xl font-black text-blue-900">{fullName}</h2>
          <p className="text-lg font-semibold text-blue-700">{roleTitle}</p>
          <p className="mt-3 text-sm leading-6 text-blue-900">{emailText}<br />{phoneText}<br />{locationText}</p>
          <div className="mt-6">
            {sectionTitle('Tech Stack', '#1d4ed8')}
            <div className="mt-2 space-y-1 text-sm text-zinc-700">{skills.map((skill) => <p key={skill}>{skill}</p>)}</div>
          </div>
        </aside>
        <main className="p-8">
          {sectionTitle('Summary', '#1d4ed8')}
          <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
          <div className="mt-6">
            {sectionTitle('Experience', '#1d4ed8')}
            <p className="mt-3 text-2xl font-bold text-zinc-900">Senior Product Manager - Acme Corp</p>
            <p className="text-lg text-zinc-600">Jan 2022 - Present</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </main>
      </div>
    );
  }

  if (template.id === 'fresher') {
    return (
      <div className={`border border-emerald-200 bg-white p-9 ${embeddedClass}`}>
        <div className="rounded-2xl bg-emerald-50 p-6">
          <h2 className="text-4xl font-black text-emerald-900">{fullName}</h2>
          <p className="text-xl font-semibold text-emerald-700">{roleTitle}</p>
          <p className="mt-2 text-base text-zinc-600">{emailText} • {phoneText} • {locationText}</p>
        </div>
        <div className={`mt-6 grid ${equalTwoColClass} gap-7`}>
          <div>
            {sectionTitle('Profile', '#15803d')}
            <p className="mt-3 text-base leading-7 text-zinc-700">{summary}</p>
            <div className="mt-5">
              {sectionTitle('Education', '#15803d')}
              <p className="mt-2 text-base font-semibold text-zinc-800">{educationDegree}</p>
              <p className="text-base text-zinc-600">{educationSchool} ({educationYear})</p>
            </div>
          </div>
          <div>
            {sectionTitle('Skills', '#15803d')}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">{skills.map((skill) => <span key={skill} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">{skill}</span>)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'consulting') {
    return (
      <div className={`border border-teal-200 bg-white px-12 py-10 ${embeddedClass}`}>
        <div className="flex items-end justify-between border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-5xl font-black text-zinc-900">{fullName}</h2>
            <p className="mt-1 text-xl font-semibold text-zinc-700">{roleTitle}</p>
          </div>
          <p className="text-sm text-zinc-600">New York, NY</p>
        </div>
        <div className="mt-6 space-y-6">
          <div>
            {sectionTitle('Case Summary', '#0f766e')}
            <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
          </div>
          <div>
            {sectionTitle('Impact Highlights', '#0f766e')}
            <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'startup') {
    return (
      <div className={`border border-violet-200 bg-white ${embeddedClass}`}>
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-8 text-white">
          <h2 className="text-5xl font-black">{fullName}</h2>
          <p className="mt-1 text-xl text-violet-100">{roleTitle}</p>
          <p className="mt-2 text-sm text-violet-100">{emailText} • {phoneText} • {locationText}</p>
        </div>
        <div className="p-8">
          {sectionTitle('What I Build', '#7c3aed')}
          <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
        <div className={`mt-6 grid ${equalTwoColClass} gap-6`}>
            <div>
              {sectionTitle('Wins', '#7c3aed')}
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              {sectionTitle('Tools', '#7c3aed')}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">{skills.map((skill) => <span key={skill} className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">{skill}</span>)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'corporate') {
    return (
      <div className={`border border-zinc-300 bg-white px-12 py-10 ${embeddedClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-5xl font-black text-zinc-900">{fullName}</h2>
            <p className="mt-1 text-2xl text-zinc-700">{roleTitle}</p>
          </div>
          <div className="text-right text-sm text-zinc-600">
            <p>{emailText}</p>
            <p>{phoneText}</p>
            <p>{locationText}</p>
          </div>
        </div>
        <div className={`mt-7 grid ${unevenTwoColClass} gap-8 border-t border-zinc-200 pt-7`}>
          <div>
            {sectionTitle('Professional Profile', '#0f172a')}
            <p className="mt-3 text-base leading-7 text-zinc-700">{summary}</p>
            <div className="mt-5">
              {sectionTitle('Experience', '#0f172a')}
              <p className="mt-2 text-xl font-bold text-zinc-900">Senior Product Manager - Acme Corp</p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <div>
            {sectionTitle('Core Competencies', '#0f172a')}
            <div className="mt-3 space-y-2 text-sm text-zinc-700">{skills.map((skill) => <p key={skill}>• {skill}</p>)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'academic') {
    return (
      <div className={`border border-blue-200 bg-white px-12 py-10 ${embeddedClass}`}>
        <h2 className="text-4xl font-semibold tracking-tight text-blue-900">{fullName}</h2>
        <p className="text-xl text-zinc-700">{roleTitle}</p>
        <p className="mt-2 text-sm text-zinc-500">{emailText} • {phoneText} • {locationText} • {profileText}</p>
        <div className="mt-7 space-y-6">
          <div>
            {sectionTitle('Research Summary', '#1e40af')}
            <p className="mt-3 text-base leading-7 text-zinc-700">{summary}</p>
          </div>
          <div>
            {sectionTitle('Teaching / Leadership Experience', '#1e40af')}
            <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'sales') {
    return (
      <div className={`border border-rose-200 bg-white ${embeddedClass}`}>
        <div className="bg-rose-50 px-10 py-7">
          <h2 className="text-5xl font-black text-rose-900">{fullName}</h2>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{roleTitle}</p>
        </div>
        <div className="p-8">
          {sectionTitle('Revenue Impact', '#be123c')}
          <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-700">Top Metrics</p>
            <p className="mt-2 text-base text-zinc-700">Activation +21% • Ticket reduction 34% • 6 major features shipped</p>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'designer') {
    return (
      <div className={`border border-orange-200 bg-white ${embeddedClass}`}>
        <div className={`grid ${creativeClass}`}>
          <aside className="bg-orange-100 p-7">
            <div className="h-20 w-20 rounded-3xl bg-orange-300/70" />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-orange-800">Design-led PM</p>
          </aside>
          <main className="p-8">
            <h2 className="text-5xl font-black text-zinc-900">{fullName}</h2>
            <p className="mt-2 text-2xl font-semibold text-zinc-700">{roleTitle}</p>
            <p className="mt-3 text-lg text-zinc-600">{emailText} • {locationText}</p>
            <div className="mt-6">
              {sectionTitle('Design + Product Story', '#ea580c')}
              <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (template.id === 'product') {
    return (
      <div className={`border border-teal-200 bg-white px-10 py-8 ${embeddedClass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-5xl font-black text-zinc-900">{fullName}</h2>
            <p className="mt-2 text-2xl font-semibold text-zinc-700">{roleTitle}</p>
          </div>
          <div className="rounded-xl bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">Product-first</div>
        </div>
        <div className={`mt-7 grid ${unevenTwoColClass} gap-8`}>
          <div>
            {sectionTitle('Product Summary', '#0f766e')}
            <p className="mt-3 text-lg leading-8 text-zinc-700">{summary}</p>
            <div className="mt-5">
              {sectionTitle('Experience', '#0f766e')}
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <div>
            {sectionTitle('Core Areas', '#0f766e')}
            <div className="mt-3 space-y-2 text-sm text-zinc-700">{skills.map((skill) => <p key={skill}>• {skill}</p>)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'operations') {
    return (
      <div className={`border border-green-200 bg-white ${embeddedClass}`}>
        <div className="bg-green-50 px-10 py-7">
          <h2 className="text-5xl font-black text-green-900">{fullName}</h2>
          <p className="text-2xl font-semibold text-green-700">{roleTitle}</p>
        </div>
        <div className={`grid ${equalTwoColClass} gap-8 p-8`}>
          <div>
            {sectionTitle('Execution Summary', '#166534')}
            <p className="mt-3 text-base leading-7 text-zinc-700">{summary}</p>
          </div>
          <div>
            {sectionTitle('Process Wins', '#166534')}
            <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  if (template.id === 'finance') {
    return (
      <div className={`border border-slate-300 bg-white px-12 py-10 ${embeddedClass}`}>
        <h2 className="text-5xl font-black text-slate-900">{fullName}</h2>
        <p className="mt-2 text-xl font-semibold text-slate-700">{roleTitle}</p>
        <p className="mt-2 text-sm text-slate-600">{emailText} • {phoneText} • {locationText}</p>
        <div className={`mt-7 grid ${financeClass} gap-8`}>
          <div>
            {sectionTitle('Core Skills', '#1e293b')}
            <div className="mt-2 space-y-1 text-sm text-zinc-700">{skills.map((skill) => <p key={skill}>{skill}</p>)}</div>
          </div>
          <div>
            {sectionTitle('Professional Summary', '#1e293b')}
            <p className="mt-3 text-base leading-7 text-zinc-700">{summary}</p>
            <div className="mt-5">
              {sectionTitle('Experience', '#1e293b')}
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{bullets.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-zinc-200 bg-white ${embeddedClass}`}>
      <div className="border-b border-zinc-200 px-10 py-8" style={{ background: theme.headerBg }}>
        <h2 className="text-6xl font-black tracking-[-0.05em] text-zinc-900">{fullName}</h2>
        <p className="mt-3 text-2xl font-bold text-zinc-700">{roleTitle}</p>
        {contactLine && <p className="mt-4 break-words text-xl text-zinc-600">{contactLine}</p>}
        {profileText && <p className="break-words text-xl text-zinc-600">{profileText}</p>}
      </div>
      <div className={`grid gap-7 p-8 ${theme.twoColumn ? twoColMainClass : 'grid-cols-1'}`}>
        {theme.twoColumn && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Skills</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-zinc-300 px-2 py-1">{skill}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Education</p>
              <p className="mt-2 text-base font-semibold text-zinc-800">{educationDegree}</p>
              <p className="text-base text-zinc-600">{educationSchool} ({educationYear})</p>
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Languages</p>
              <p className="mt-2 text-base text-zinc-700">{languages.join(', ')}</p>
            </div>
          </div>
        )}
        <div className="space-y-6">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Summary</p>
            {summary && <p className="mt-2 text-lg leading-8 text-zinc-700">{summary}</p>}
          </div>
          {bullets.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Experience</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">Senior Product Manager - Acme Corp</p>
            <p className="text-lg text-zinc-600">Jan 2022 - Present</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-lg text-zinc-700">
              {bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>}
          {projects.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Projects</p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-lg text-zinc-700">
              {projects.slice(0, 3).map((project) => <li key={project}>{project}</li>)}
            </ul>
          </div>}
          {certifications.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Certifications</p>
            <p className="mt-2 text-base text-zinc-700">{certifications.join(', ')}</p>
          </div>}
          {achievements.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Achievements</p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{achievements.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>}
          {volunteer.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Volunteer</p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-zinc-700">{volunteer.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>}
          {hobbies.length > 0 && <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Hobbies</p>
            <p className="mt-2 text-base text-zinc-700">{hobbies.join(', ')}</p>
          </div>}
          {!theme.twoColumn && (
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Skills</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-zinc-300 px-2 py-1">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
