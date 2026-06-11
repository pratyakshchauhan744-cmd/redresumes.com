import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Red Resumes';
const DEFAULT_TITLE = 'Red Resumes | Professional Resume Builder';
const DEFAULT_DESCRIPTION =
  'Build ATS-friendly resumes with beautiful templates, AI-powered writing help, and fast PDF export.';
const DEFAULT_IMAGE = '/og-cover.png';
const LOGO_IMAGE = '/favicon-192x192.png';

const pageSeo: Record<string, { title: string; description: string; type?: 'website' | 'article' }> = {
  '/': {
    title: 'AI Resume Builder & ATS Resume Checker | Red Resumes',
    description:
      'Create professional resumes in minutes with our AI Resume Builder, ATS Resume Checker, dynamic resume optimization, and mock interview simulator.',
  },
  '/templates': {
    title: 'ATS Resume Templates & Optimization | Red Resumes',
    description:
      'Browse modern, creative, and technical ATS-friendly resume templates. Optimize your resume layouts for top Applicant Tracking Systems.',
  },
  '/builder': {
    title: 'Resume Optimization & AI Resume Builder | Red Resumes',
    description:
      'Build, edit, and optimize your resume section-by-section using AI. Run real-time ATS checks and download print-ready PDF resumes.',
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
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${url}/#website`,
          'url': `${url}/`,
          'name': SITE_NAME,
          'description': 'AI Resume Builder, ATS Resume Checker, and Mock Interview Platform.',
          'publisher': {
            '@id': `${url}/#organization`
          }
        },
        {
          '@type': 'Organization',
          '@id': `${url}/#organization`,
          'name': SITE_NAME,
          'url': url,
          'logo': `${url}${LOGO_IMAGE}`,
          'image': `${url}${DEFAULT_IMAGE}`,
          'contactPoint': {
            '@type': 'ContactPoint',
            'email': 'support@redresumes.com',
            'contactType': 'customer support',
          },
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${url}/#softwareapplication`,
          'name': 'Red Resumes AI Builder & ATS Checker',
          'applicationCategory': 'BusinessApplication',
          'operatingSystem': 'All',
          'url': `${url}/`,
          'description': 'AI-powered ATS resume builder, resume optimizer, and mock interview simulation platform.',
          'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'USD'
          }
        },
        {
          '@type': 'FAQPage',
          '@id': `${url}/#faq`,
          'mainEntity': [
            {
              '@type': 'Question',
              'name': 'How does the AI Resume Builder work?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Our AI Resume Builder guides you section-by-section to build professional resumes, suggesting optimized summaries, key skills, and impact-focused achievements tailored to your industry.'
              }
            },
            {
              '@type': 'Question',
              'name': 'What is an ATS Resume Checker?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'An Applicant Tracking System (ATS) checker scans your resume against a target job description, identifying missing keywords and generating a compatibility score with constructive improvement tips.'
              }
            },
            {
              '@type': 'Question',
              'name': 'How does the Mock Interview Platform work?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'The platform initiates a Google Meet-style simulation where an AI interviewer asks relevant, role-specific questions. It then provides feedback on speech metrics (words-per-minute, filler words), presence, and accuracy.'
              }
            }
          ]
        }
      ],
    };
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
      {finalJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(finalJsonLd)}
        </script>
      ) : null}
    </Helmet>
  );
};
