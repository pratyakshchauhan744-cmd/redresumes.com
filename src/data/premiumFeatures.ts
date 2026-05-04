import type { PremiumFeatureItem } from '../types';

export const premiumFeatures: PremiumFeatureItem[] = [
  {
    id: 'portfolio-website-generator',
    title: 'Portfolio website generator',
    desc: 'Turn your resume into a live personal site.',
    detail: 'Publish your resume as a clean personal website with your profile, projects, and contact details.',
    targetPage: 'builder',
  },
  {
    id: 'resume-shareable-link',
    title: 'Resume shareable link',
    desc: 'Create a public URL to send instantly.',
    detail: 'Generate a public link for quick recruiter sharing without downloading files each time.',
    targetPage: 'dashboard',
  },
  {
    id: 'qr-code-resume',
    title: 'QR code resume',
    desc: 'Add a scannable QR to any version.',
    detail: 'Add a QR code to your printed resume that links directly to your digital portfolio or LinkedIn.',
    targetPage: 'builder',
  },
];
