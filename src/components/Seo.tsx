import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Red Resumes';
const DEFAULT_TITLE = 'Red Resumes | Professional Resume Builder';
const DEFAULT_DESCRIPTION =
  'Build ATS-friendly resumes with beautiful templates, AI-powered writing help, and fast PDF export.';
const DEFAULT_IMAGE = '/og-cover.svg';

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
  '/pricing': {
    title: 'Pricing | Red Resumes',
    description: 'Simple pricing for resume building, exports, and premium template access.',
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

const jsonLdForPath = (path: string, url: string) => {
  if (path === '/') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url,
      logo: `${url}/favicon.ico`,
      sameAs: [],
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
  return null;
};

export const Seo = () => {
  const location = useLocation();
  const path = location.pathname;
  const siteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/+$/, '') || 'https://redresumes.com';
  const currentUrl = `${siteUrl}${path}`;
  const seo = pageSeo[path] ?? {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    type: 'website' as const,
  };
  const jsonLd = jsonLdForPath(path, siteUrl);

  return (
    <Helmet>
      <title>{seo.title || DEFAULT_TITLE}</title>
      <meta name="description" content={seo.description || DEFAULT_DESCRIPTION} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={seo.type || 'website'} />
      <meta property="og:title" content={seo.title || DEFAULT_TITLE} />
      <meta property="og:description" content={seo.description || DEFAULT_DESCRIPTION} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={`${siteUrl}${DEFAULT_IMAGE}`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title || DEFAULT_TITLE} />
      <meta name="twitter:description" content={seo.description || DEFAULT_DESCRIPTION} />
      <meta name="twitter:image" content={`${siteUrl}${DEFAULT_IMAGE}`} />
      <link rel="canonical" href={currentUrl} />
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
};
