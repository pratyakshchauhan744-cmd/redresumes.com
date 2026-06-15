import type { AuthUser } from './lib/backendApi';

export type Page =
  | 'home'
  | 'builder'
  | 'templates'
  | 'cover-letter'
  | 'examples'
  | 'job-finder'
  | 'blog'
  | 'blog-post'
  | 'login'
  | 'dashboard'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'admin';

export interface TemplateItem {
  id: string;
  name: string;
  desc: string;
  tag: string;
  image: string;
  fullPreviewImage?: string;
}

export type JobItem = {
  id: string;
  title: string;
  company: string;
  companyUrl?: string;
  location: string;
  type: string;
  salary: string;
  match: number;
  skills: string[];
  url?: string;
  originalJobUrl?: string;
  source?: string;
  isNew?: boolean;
  postedAt?: string;
};

export interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  readTime: string;
  updated: string;
  sections: Array<{
    heading: string;
    points: string[];
  }>;
}

export interface PremiumFeatureItem {
  id: 'portfolio-website-generator' | 'resume-shareable-link' | 'qr-code-resume';
  title: string;
  desc: string;
  detail: string;
  targetPage: Page;
}

export interface ResumeExamplePreset {
  templateId: string;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  profileLink: string;
  summary: string;
  experiences: Array<{ title: string; dates: string; bullets: string }>;
  skillsInput: string;
  educationDegree: string;
  educationSchool: string;
  educationYear: string;
  projectsInput: string;
  certificationsInput: string;
  languagesInput: string;
  achievementsInput: string;
}

export type ResumeListStyle = 'bullet' | 'number' | 'paragraph';
export type ResumeProjectsDisplay = 'paragraph' | 'list';

export type TemplateResumeData = {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  profileLink: string;
  summary: string;
  skills: string[];
  educationItems?: EducationItem[];
  educationDegree: string;
  educationSchool: string;
  educationYear: string;
  bullets: string[];
  experiences?: ExperienceItem[];
  projects: string[];
  projectsDisplay?: ResumeProjectsDisplay;
  certifications: string[];
  languages: string[];
  hobbies: string[];
  achievements: string[];
  volunteer: string[];
  customColumns?: CustomColumnItem[];
  listStyle?: ResumeListStyle;
  photoDataUrl?: string;
};

export interface ExperienceItem {
  title: string;
  dates: string;
  bullets: string;
}

export interface EducationItem {
  degree: string;
  school: string;
  year: string;
}

export interface CustomColumnItem {
  id: string;
  title: string;
  content: string;
}

export type LocalAccount = AuthUser;
