import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'RedResumes';
const DEFAULT_TITLE = 'Red Resumes | Professional Resume Builder';
const DEFAULT_DESCRIPTION =
  'Build ATS-friendly resumes with beautiful templates, AI-powered writing help, and fast PDF export.';
const DEFAULT_IMAGE = '/og-cover.png';

const pageSeo: Record<string, { title: string; description: string; type?: 'website' | 'article' }> = {
  '/': {
    title: 'Free ATS Resume Builder with AI Writing Help — RedResumes',
    description:
      'Build a free, ATS-friendly resume in about 15 minutes. Pick a template, get AI-written bullet points, then download the PDF — no sign-up, no paywall.',
  },
  '/templates': {
    title: 'ATS Resume Templates & Optimization | Red Resumes',
    description:
      'Browse modern, creative, and technical ATS-friendly resume templates. Optimize your resume layouts for top Applicant Tracking Systems.',
  },
  '/builder': {
    title: 'Resume Builder — A Step-by-Step Editor | RedResumes',
    description:
      'Fill in your work history, education, and skills, get AI-suggested bullet points, then export an ATS-friendly resume as a free PDF. No sign-up needed.',
  },
  '/examples': {
    title: 'Resume Examples & Optimization Presets | Red Resumes',
    description: 'Explore role-specific resume examples and optimize your layout to target key skills.',
  },
  '/job-finder': {
    title: 'Job Application Tools & Tracker | Red Resumes',
    description: 'Search jobs, track application status, and match your resume to target descriptions using our job application tools.',
  },
  '/blog': {
    title: 'Career Tips & Resume Analysis | Red Resumes',
    description: 'Expert advice on resume writing, ATS screening secrets, resume optimization, and mock interview preparation.',
  },
  '/blog/post': {
    title: 'ATS Resume Optimization Guide | Red Resumes',
    description: 'Detailed analysis on resume optimization, beating ATS systems, and using job application tools effectively.',
    type: 'article',
  },
  '/contact': {
    title: 'Contact & Support | Red Resumes',
    description: 'Connect with our team for support regarding our AI Resume Builder, ATS Checker, or Mock Interview Platform.',
  },
  '/login': {
    title: 'Log In or Sign Up | Red Resumes',
    description: 'Access your saved resumes, draft cover letters, job tracker, and AI mock interview feedback in your dashboard.',
  },
};

export interface SeoProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const jsonLdForPath = (path: string, url: string) => {
  if (path === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'RedResumes',
        url: 'https://redresumes.com/',
        description:
          'RedResumes is a free online resume builder that helps job seekers create ATS-friendly resumes with AI-powered writing assistance and free PDF export.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'RedResumes Resume Builder',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: 'https://redresumes.com/builder',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description:
          'A free, ATS-friendly resume builder with AI-generated bullet points, professional templates, and free PDF export with no sign-up required.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is RedResumes actually free to download my resume?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Yes. RedResumes provides PDF export at no cost, with no subscription or paywall required to download the finished resume — unlike many resume builders that charge only when you try to download.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does RedResumes create ATS-friendly resumes?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                "Yes. RedResumes' templates are designed specifically to pass through Applicant Tracking Systems, using clean formatting and standard section structures that ATS software can parse correctly.",
            },
          },
          {
            '@type': 'Question',
            name: 'Does RedResumes use AI to help write my resume?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Yes. RedResumes includes an AI writing assistant that suggests bullet points and professional summary language based on the work history and target role entered into the builder.',
            },
          },
          {
            '@type': 'Question',
            name: 'Do I need to sign up to use RedResumes?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'No. RedResumes does not require account creation to build or export a resume — most users complete a resume in about 15 minutes without signing up.',
            },
          },
        ],
      },
    ];
  }
  if (path === '/builder') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'RedResumes Resume Builder',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: 'https://redresumes.com/builder',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description:
          'Step-by-step resume editor: enter work history, education, and skills, then export an ATS-friendly PDF resume for free, no sign-up required.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How long does it take to build a resume in the RedResumes builder?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Most users finish a resume in about 15 minutes using the guided, step-by-step builder, which walks through work history, education, and skills before generating a finished document.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I export my resume from the RedResumes builder as a PDF?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Yes. The builder exports finished resumes as PDF files at no cost, ready to submit directly to job listings on platforms like LinkedIn, Indeed, and Glassdoor.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does the RedResumes builder write content for me?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                "Yes. As you fill in your experience and target role, the builder's AI assistant suggests bullet points and a professional summary you can edit or accept as written.",
            },
          },
          {
            '@type': 'Question',
            name: 'Are the templates in the RedResumes builder ATS-compatible?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Yes. Every template in the builder is formatted for compatibility with Applicant Tracking Systems, avoiding graphics, columns, or fonts that commonly cause parsing errors.',
            },
          },
        ],
      },
    ];
  }
  if (path === '/templates') {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Resume Templates',
      url: `${url}/templates`,
      description: 'ATS-friendly resume template collection by Red Resumes.',
    };
  }
  if (path === '/pricing') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Red Resumes Premium',
      description: 'AI-powered ATS-friendly resume builder and mock interview preparation.',
      offers: [
        {
          '@type': 'Offer',
          'name': 'Free Plan',
          'price': '0.00',
          'priceCurrency': 'USD',
          'category': 'Subscription',
        },
        {
          '@type': 'Offer',
          'name': 'Premium Plan',
          'price': '19.00',
          'priceCurrency': 'USD',
          'category': 'Subscription',
        },
      ],
    };
  }
  return null;
};

export const Seo = ({ title, description, canonicalUrl, ogImage, type, jsonLd }: SeoProps = {}) => {
  const location = useLocation();
  const path = location.pathname;
  const siteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/+$/, '') || 'https://redresumes.com';
  const currentUrl = canonicalUrl || `${siteUrl}${path}`;
  const defaultSeo = pageSeo[path] ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    type: 'website' as const,
  };

  const finalTitle = title || defaultSeo.title || DEFAULT_TITLE;
  const finalDescription = description || defaultSeo.description || DEFAULT_DESCRIPTION;
  const finalType = type || defaultSeo.type || 'website';
  const finalOgImage = ogImage || `${siteUrl}${DEFAULT_IMAGE}`;
  const finalJsonLd = jsonLd || jsonLdForPath(path, siteUrl);

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={finalType} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalOgImage} />
      <link rel="canonical" href={currentUrl} />
      {finalJsonLd
        ? (Array.isArray(finalJsonLd) ? finalJsonLd : [finalJsonLd]).map((item, index) => (
            <script key={index} type="application/ld+json">
              {JSON.stringify(item)}
            </script>
          ))
        : null}
    </Helmet>
  );
};
