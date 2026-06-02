import { User } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TemplateItem, TemplateResumeData } from '../types';
import { templatePreviewThemeById } from '../data/templates';

export const TemplateVisualPreview = ({
  template,
  data,
  sectionOrder,
}: {
  template: TemplateItem;
  data?: TemplateResumeData;
  sectionOrder?: string[];
}) => {
  const theme = templatePreviewThemeById[template.id] || templatePreviewThemeById.modern;
  const isLiveData = Boolean(data);
  const fullName = data?.fullName?.trim() || (isLiveData ? 'Your Name' : 'Alex Morgan');
  const roleTitle = data?.jobTitle?.trim() || (isLiveData ? 'Job Title' : 'Senior Product Manager');
  const emailText = data?.email?.trim() || (isLiveData ? '' : 'alexmorgan@email.com');
  const phoneText = data?.phone?.trim() || (isLiveData ? '' : '+1 (555) 123-4567');
  const locationText = data?.location?.trim() || (isLiveData ? '' : 'New York, NY');
  const profileText = data?.profileLink?.trim() || (isLiveData ? '' : 'linkedin.com/in/alexmorgan');
  const summary = data?.summary?.trim() || (isLiveData ? 'Add a professional summary to preview it here.' : 'Product leader with 8+ years of experience building growth-focused digital products, leading cross-functional teams, and improving user conversion through data-driven decisions.');
  const skills = data?.skills?.length ? data.skills : (isLiveData ? [] : ['Product Strategy', 'Analytics', 'Roadmapping', 'Leadership', 'SQL']);
  const bullets = data?.bullets?.length ? data.bullets : (isLiveData ? [] : [
    'Led product roadmap for 2 B2B tools, improving activation by 21%.',
    'Collaborated with design and engineering to launch 6 major features.',
    'Reduced onboarding friction, cutting support tickets by 34%.',
  ]);
  const projects = data?.projects?.length ? data.projects : (isLiveData ? [] : ['Built a resume scoring tool using React and Node.js.', 'Created an analytics dashboard to track job applications.']);
  const projectsDisplay = data?.projectsDisplay ?? (projects.length <= 1 ? 'paragraph' : 'list');
  const certifications = data?.certifications?.length ? data.certifications : (isLiveData ? [] : ['Google Data Analytics', 'AWS Cloud Practitioner']);
  const languages = data?.languages?.length ? data.languages : (isLiveData ? [] : ['English', 'Hindi']);
  const hobbies = data?.hobbies?.length ? data.hobbies : (isLiveData ? [] : ['Reading', 'Running', 'Chess']);
  const achievements = data?.achievements?.length ? data.achievements : (isLiveData ? [] : ['Won hackathon among 120+ teams.', 'Improved product conversion by 21% in previous role.']);
  const volunteer = data?.volunteer?.length ? data.volunteer : (isLiveData ? [] : ['Mentored students in resume writing and interview prep.']);
  const listStyle = data?.listStyle === 'number' ? 'number' : 'bullet';
  const ListTag: 'ol' | 'ul' = listStyle === 'number' ? 'ol' : 'ul';
  const listClassName = listStyle === 'number' ? 'list-decimal' : 'list-disc';
  const isTwoColumn = template.id === 'two-column' || template.id === 'finance';
  const orderedSectionIds = [
    ...(sectionOrder ?? []),
    'summary',
    'experience',
    'skills',
    'education',
    'projects',
    'certifications',
    'languages',
    'hobbies',
    'achievements',
    'volunteer',
    'custom-columns',
  ].filter((id, index, list) => list.indexOf(id) === index);
  const experienceItems = data?.experiences?.length ? data.experiences : [{
    title: 'Senior Product Manager - Acme Corp',
    dates: 'Jan 2022 - Present',
    bullets: bullets.join('\n'),
  }];
  const educationItems = (data?.educationItems?.length ? data.educationItems : [{
    degree: data?.educationDegree ?? '',
    school: data?.educationSchool ?? '',
    year: data?.educationYear ?? '',
  }]).filter((item) => item.degree || item.school || item.year);
  const customColumns = data?.customColumns?.filter((item) => item.title.trim() || item.content.trim()) ?? [];
  const cleanListLine = (line: string) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
  const gmailComposeUrl = (email: string) =>
    `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
  const websiteUrl = (url: string) => {
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };
  type ContactLinkItem = { text: string; href?: string; ariaLabel?: string };
  const linkClassName = 'break-words underline-offset-4 hover:underline';
  const rawContactLinkItems: Array<ContactLinkItem | null> = [
    emailText
      ? {
          text: emailText,
          href: gmailComposeUrl(emailText),
          ariaLabel: `Email ${emailText} in Gmail`,
        }
      : null,
    phoneText ? { text: phoneText } : null,
    locationText ? { text: locationText } : null,
  ];
  const contactLinkItems = rawContactLinkItems.filter((item): item is ContactLinkItem => Boolean(item));
  const profileLinkItem = profileText
    ? {
        text: profileText,
        href: websiteUrl(profileText),
        ariaLabel: `Open ${profileText}`,
      }
    : null;
  const renderContactItem = (item: ContactLinkItem) => {
    if (!item.href) return <span>{item.text}</span>;

    return (
      <a className={linkClassName} href={item.href} target="_blank" rel="noreferrer" aria-label={item.ariaLabel}>
        {item.text}
      </a>
    );
  };
  const renderInlineContactItems = (items: ContactLinkItem[]) =>
    items.map((item, index) => (
      <span key={item.text}>
        {index > 0 && <span> • </span>}
        {renderContactItem(item)}
      </span>
    ));

  const sectionTitle = (label: string) => (
    <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
      {label}
    </p>
  );

  const renderExperience = () => {
    if (!experienceItems.length) return null;
    return (
      <section key="experience">
        {sectionTitle('Experience')}
        <div className="mt-4 space-y-5">
          {experienceItems.map((experience, index) => {
            const bulletLines = experience.bullets
              .split('\n')
              .map(cleanListLine)
              .filter(Boolean);

            return (
              <div key={`${experience.title}-${index}`}>
                {experience.title && <p className="text-2xl font-black leading-tight text-zinc-900">{experience.title}</p>}
                {experience.dates && <p className="text-xl leading-8 text-zinc-500">{experience.dates}</p>}
                {bulletLines.length > 0 && (
                  <ListTag className={`mt-3 ${listClassName} space-y-2 pl-6 text-[1.05rem] leading-7 text-zinc-700`}>
                    {bulletLines.map((item) => <li key={item}>{item}</li>)}
                  </ListTag>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderListSection = (id: string, label: string, items: string[]) => {
    if (!items.length) return null;
    return (
      <section key={id}>
        {sectionTitle(label)}
        <ListTag className={`mt-4 ${listClassName} space-y-2 pl-6 text-xl leading-8 text-zinc-700`}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ListTag>
      </section>
    );
  };

  const renderProjectsSection = () => {
    if (!projects.length) return null;

    if (projectsDisplay === 'paragraph') {
      return (
        <section key="projects">
          {sectionTitle('Projects')}
          <p className="mt-4 whitespace-pre-line text-xl leading-8 text-zinc-700">{projects.join('\n\n')}</p>
        </section>
      );
    }

    return renderListSection('projects', 'Projects', projects);
  };

  const sectionById: Record<string, ReactNode> = {
    summary: summary ? (
      <section key="summary">
        {sectionTitle(template.id === 'finance' ? 'Professional Summary' : 'Summary')}
        <p className="mt-5 text-2xl leading-[1.55] text-zinc-700">{summary}</p>
      </section>
    ) : null,
    experience: renderExperience(),
    skills: skills.length > 0 ? (
      <section key="skills">
        {sectionTitle(template.id === 'finance' ? 'Core Skills' : 'Skills')}
        <div className="mt-5 flex flex-wrap gap-3 text-xl text-zinc-700">
          {skills.map((skill) => (
            <span key={skill} className="rounded-xl border border-zinc-200 px-4 py-1.5">{skill}</span>
          ))}
        </div>
      </section>
    ) : null,
    education: educationItems.length > 0 ? (
      <section key="education">
        {sectionTitle('Education')}
        <div className="mt-4 space-y-3">
          {educationItems.map((item, index) => {
            const educationLine = [item.school, item.year].filter(Boolean).join(' ');
            return (
              <div key={`${item.degree}-${item.school}-${index}`}>
                {item.degree && <p className="text-xl font-bold text-zinc-800">{item.degree}</p>}
                {educationLine && <p className="text-lg leading-7 text-zinc-600">{educationLine}</p>}
              </div>
            );
          })}
        </div>
      </section>
    ) : null,
    projects: renderProjectsSection(),
    certifications: renderListSection('certifications', 'Certifications', certifications),
    languages: renderListSection('languages', 'Languages', languages),
    hobbies: renderListSection('hobbies', 'Hobbies', hobbies),
    achievements: renderListSection('achievements', 'Achievements', achievements),
    volunteer: renderListSection('volunteer', 'Volunteer', volunteer),
    'custom-columns': customColumns.length > 0 ? (
      <section key="custom-columns" className="space-y-8">
        {customColumns.map((column, index) => (
          <div key={column.id}>
            {sectionTitle(column.title.trim() || `Custom section ${index + 1}`)}
            {column.content && (
              <ListTag className={`mt-4 ${listClassName} space-y-2 pl-6 text-xl leading-8 text-zinc-700`}>
                {column.content.split('\n').map(cleanListLine).filter(Boolean).map((line) => <li key={line}>{line}</li>)}
              </ListTag>
            )}
          </div>
        ))}
      </section>
    ) : null,
  };

  const orderedSections = orderedSectionIds.map((id) => sectionById[id]).filter(Boolean);
  const sideSectionIds = new Set(['skills', 'education', 'languages', 'certifications', 'hobbies']);
  const sideSections = orderedSectionIds.filter((id) => sideSectionIds.has(id)).map((id) => sectionById[id]).filter(Boolean);
  const mainSections = orderedSectionIds.filter((id) => !sideSectionIds.has(id)).map((id) => sectionById[id]).filter(Boolean);

  if (isTwoColumn) {
    return (
      <div className="template-visual-preview border border-zinc-200 bg-white text-zinc-900">
        <div className={`grid ${template.id === 'two-column' ? 'grid-cols-[0.55fr_1fr]' : 'grid-cols-[0.65fr_1fr]'}`}>
          <aside className={`${template.id === 'two-column' ? 'border-r border-zinc-200 bg-slate-50' : ''} p-8`}>
            <h2 className="text-4xl font-black leading-none tracking-tight text-slate-950">{fullName}</h2>
            <p className="mt-2 text-xl font-bold text-slate-700">{roleTitle}</p>
            <div className="mt-5 space-y-1 text-sm leading-6 text-slate-700">
              {contactLinkItems.map((item) => <p key={item.text}>{renderContactItem(item)}</p>)}
              {profileLinkItem && <p>{renderContactItem(profileLinkItem)}</p>}
            </div>
            {sideSections.length > 0 && <div className="mt-6 space-y-6">{sideSections}</div>}
          </aside>
          <main className="space-y-8 p-8">
            {mainSections}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="template-visual-preview overflow-hidden border border-zinc-200 bg-white text-zinc-900">
      <div className="border-b border-zinc-200 px-12 py-10" style={{ background: theme.headerBg }}>
        <div className="flex items-center gap-7">
          {template.id === 'modern' && (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 text-zinc-400">
              <User className="h-10 w-10" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-5xl font-black leading-tight tracking-tight">{fullName}</h2>
            <p className="mt-1 text-3xl font-extrabold leading-tight text-zinc-600">{roleTitle}</p>
            {contactLinkItems.length > 0 && <p className="mt-6 text-2xl leading-9 text-zinc-500">{renderInlineContactItems(contactLinkItems)}</p>}
            {profileLinkItem && <p className="text-2xl leading-9 text-zinc-500">{renderContactItem(profileLinkItem)}</p>}
          </div>
        </div>
      </div>
      <main className="space-y-8 px-12 py-10">
        {orderedSections}
      </main>
    </div>
  );
};
