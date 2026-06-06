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
    title: 'Red Resumes | Build ATS-Friendly Resume Fast',
    description:
      'Create professional resumes in minutes with ATS-ready templates, AI suggestions, and instant export.',
  },
  '/templates': {
    title: 'Resume Templates | Red Resumes',
    description:
      'Browse modern, professional, creative, and ATS-friendly resume templates tailored to every role.',
  },
  '/builder': {
    title: 'Resume Builder | Red Resumes',
    description:
      'Build and customize your resume section by section with live preview and downloadable output.',
  },
  '/examples': {
    title: 'Resume Examples | Red Resumes',
    description: 'Explore real resume examples by role and quickly adapt them to your profile.',
  },
  '/job-finder': {
    title: 'Job Finder | Red Resumes',
    description: 'Search jobs, track applications, and apply with resume-ready suggestions.',
  },
  '/blog': {
    title: 'Blog | Red Resumes',
    description: 'Career tips, ATS guidance, and resume writing strategies from Red Resumes.',
  },
  '/blog/post': {
    title: 'Career Article | Red Resumes',
    description: 'In-depth guidance on resume writing, ATS optimization, and interview preparation.',
    type: 'article',
  },
  '/contact': {
    title: 'Contact | Red Resumes',
    description: 'Get in touch with Red Resumes for support, feedback, and partnership inquiries.',
  },
  '/login': {
    title: 'Login | Red Resumes',
    description: 'Sign in or create your Red Resumes account to build and manage your resumes.',
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
