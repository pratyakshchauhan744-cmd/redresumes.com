import { useParams, Navigate } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { getRoleGuideBySlug, getRelatedRoleGuides } from '../data/roleGuides';
import { RoleGuideBreadcrumb } from '../components/resume-hub/RoleGuideBreadcrumb';
import { RoleGuideHero } from '../components/resume-hub/RoleGuideHero';
import { RoleGuideTOC } from '../components/resume-hub/RoleGuideTOC';
import { RoleGuideWritingGuide } from '../components/resume-hub/RoleGuideWritingGuide';
import { RoleGuideResumeMockup } from '../components/resume-hub/RoleGuideResumeMockup';
import { RoleGuideTips } from '../components/resume-hub/RoleGuideTips';
import { RoleGuideSkillsPanel } from '../components/resume-hub/RoleGuideSkillsPanel';
import { RoleGuideMistakes } from '../components/resume-hub/RoleGuideMistakes';
import { RoleGuideFaq } from '../components/resume-hub/RoleGuideFaq';
import { RoleGuideRelated } from '../components/resume-hub/RoleGuideRelated';
import { RoleGuideCtaBanner } from '../components/resume-hub/RoleGuideCtaBanner';

export const RoleGuideDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) {
    return <Navigate to="/resume-examples" replace />;
  }

  const guide = getRoleGuideBySlug(slug);
  if (!guide) {
    return <Navigate to="/resume-examples" replace />;
  }

  const relatedGuides = getRelatedRoleGuides(guide.slug, 3);
  const siteUrl = 'https://redresumes.com';
  const pageUrl = `${siteUrl}/resume-examples/${guide.slug}`;

  const tocItems = [
    { id: 'writing-guide', label: `How to Write a ${guide.role} Resume` },
    { id: 'resume-example', label: `${guide.role} Resume Example` },
    { id: 'tips', label: 'Tips & Best Practices' },
    { id: 'top-skills', label: `Top ${guide.role} Skills` },
    { id: 'mistakes', label: 'Common Mistakes to Avoid' },
    { id: 'faqs', label: 'Frequently Asked Questions' },
    { id: 'related-examples', label: 'Related Examples' },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.metaTitle,
      description: guide.metaDescription,
      url: pageUrl,
      datePublished: guide.datePublished,
      dateModified: guide.dateModified,
      author: {
        '@type': 'Organization',
        name: 'RedResumes',
        url: siteUrl,
      },
      publisher: {
        '@type': 'Organization',
        name: 'RedResumes',
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/og-cover.png`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': pageUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to Write a ${guide.role} Resume`,
      description: guide.heroIntro,
      step: guide.steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.title,
        text: step.body,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: guide.breadcrumb.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        item: crumb.href ? `${siteUrl}${crumb.href}` : pageUrl,
      })),
    },
  ];

  return (
    <>
      <Seo
        title={guide.metaTitle}
        description={guide.metaDescription}
        canonicalUrl={pageUrl}
        type="article"
        jsonLd={jsonLd}
      />

      <div className="min-h-screen bg-white pb-20 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {/* Breadcrumb Navigation */}
          <RoleGuideBreadcrumb items={guide.breadcrumb} />

          {/* Hero Section */}
          <RoleGuideHero guide={guide} />

          {/* Main Content Layout with Sticky Sidebar TOC */}
          <div className="mt-12 flex flex-col lg:flex-row lg:gap-12">
            {/* Table of Contents (Sticky on Desktop, Collapsible on Mobile) */}
            <RoleGuideTOC
              items={tocItems}
              roleSlug={guide.slug}
              roleTitle={guide.role}
            />

            {/* Main Article Body */}
            <main className="flex-1 min-w-0 space-y-16">
              {/* 1. Step-by-Step Writing Guide */}
              <RoleGuideWritingGuide
                roleTitle={guide.role}
                steps={guide.steps}
              />

              {/* 2. Structured HTML/CSS Resume Mockup */}
              <RoleGuideResumeMockup
                roleSlug={guide.slug}
                roleTitle={guide.role}
                resumeData={guide.resumeExample}
              />

              {/* 3. Tips & Best Practices */}
              <RoleGuideTips
                roleTitle={guide.role}
                tips={guide.tips}
              />

              {/* 4. Top Skills Panel */}
              <RoleGuideSkillsPanel
                roleTitle={guide.role}
                skills={guide.topSkills}
              />

              {/* 5. Common Mistakes to Avoid */}
              <RoleGuideMistakes
                roleTitle={guide.role}
                mistakes={guide.mistakes}
              />

              {/* 6. FAQ Accordion */}
              <RoleGuideFaq
                roleTitle={guide.role}
                faqs={guide.faqs}
              />

              {/* 7. Bottom Brand CTA Banner */}
              <RoleGuideCtaBanner
                roleSlug={guide.slug}
                roleTitle={guide.role}
              />

              {/* 8. Related Role Guides */}
              <RoleGuideRelated relatedGuides={relatedGuides} />
            </main>
          </div>
        </div>
      </div>
    </>
  );
};
