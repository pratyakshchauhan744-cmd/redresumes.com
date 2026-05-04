import type { BlogArticle } from '../types';

export const blogArticles: BlogArticle[] = [
  {
    slug: 'ats-friendly-resume-tips',
    title: 'How to write an ATS-friendly resume',
    excerpt: 'Learn the exact keywords and formatting rules that help your resume pass automated screening systems.',
    readTime: '5 min read',
    updated: 'Updated May 2026',
    sections: [
      {
        heading: 'What is an ATS?',
        points: [
          'Applicant Tracking Systems parse your resume to extract text.',
          'They score your resume based on keyword density and layout.',
          'If the ATS cant read your layout, a human will never see it.',
        ],
      },
      {
        heading: 'Top formatting rules',
        points: [
          'Use standard headings (Experience, Education, Skills).',
          'Avoid tables, columns, and graphics.',
          'Stick to standard fonts like Arial, Calibri, or Roboto.',
        ],
      },
      {
        heading: 'Keyword optimization',
        points: [
          'Mirror exact phrases from the job description.',
          'Include both acronyms and spelled-out terms (e.g., SEO and Search Engine Optimization).',
          'Context matters: use keywords naturally in achievement bullets.',
        ],
      },
    ],
  },
  {
    slug: 'cover-letter-guide',
    title: 'The ultimate cover letter guide',
    excerpt: 'Stop sending generic cover letters. Here is how to write a targeted letter that actually gets read.',
    readTime: '8 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'The anatomy of a great cover letter',
        points: [
          'A strong hook in the first sentence.',
          'A middle paragraph that connects your experience to their exact pain points.',
          'A closing that includes a clear call to action.',
        ],
      },
      {
        heading: 'How to hook the reader',
        points: [
          'Start with a specific achievement related to the role.',
          'Show genuine enthusiasm for the company mission.',
          'Mention a mutual connection if you have one.',
        ],
      },
      {
        heading: 'What to avoid',
        points: [
          'Do not just summarize your resume.',
          'Avoid "To whom it may concern". Find the hiring managers name.',
          'Keep it under one page (3-4 short paragraphs maximum).',
        ],
      },
    ],
  },
  {
    slug: 'resume-summary-examples',
    title: '25 resume summary examples',
    excerpt: 'Steal these professional summaries to make a strong first impression at the top of your resume.',
    readTime: '10 min read',
    updated: 'Updated March 2026',
    sections: [
      {
        heading: 'Why you need a summary',
        points: [
          'It is your elevator pitch in text form.',
          'It frames your experience for the specific role.',
          'It replaces the outdated "Objective" statement.',
        ],
      },
      {
        heading: 'How to write yours',
        points: [
          'Formula: Adjective + Title + Years of Experience + Key Skill + Top Achievement.',
          'Keep it to 2-3 sentences.',
          'Focus on what you offer the employer, not what you want from them.',
        ],
      },
      {
        heading: 'Example: Software Engineer',
        points: [
          '"Senior Backend Engineer with 6+ years experience building scalable microservices in Go and Python."',
          '"Led migration of legacy monolith to AWS, reducing infrastructure costs by 30%."',
          '"Passionate about mentoring junior developers and driving engineering best practices."',
        ],
      },
    ],
  },
  {
    slug: 'tailoring-your-resume',
    title: 'How to tailor your resume quickly',
    excerpt: 'You don\'t need to rewrite your resume from scratch for every job. Here is the 10-minute tailoring process.',
    readTime: '6 min read',
    updated: 'Updated May 2026',
    sections: [
      {
        heading: 'The 10-minute method',
        points: [
          'Update your summary to match the target job title.',
          'Reorder your bullet points so the most relevant ones are first.',
          'Swap generic skills for specific keywords from the JD.',
        ],
      },
      {
        heading: 'Where to focus',
        points: [
          'The top third of your resume (Summary and most recent role).',
          'Mirror role priorities from the JD.',
          'Show direct alignment, not generic admiration.',
        ],
      },
      {
        heading: 'Final quality pass',
        points: [
          'Keep to around 200-300 words.',
          'Check tone: professional and confident.',
          'Avoid repeating the resume line by line.',
        ],
      },
    ],
  },
  {
    slug: 'resume-mistakes-to-avoid',
    title: 'Resume mistakes to avoid',
    excerpt: 'Avoid the most common resume errors that reduce response rate and interview calls.',
    readTime: '7 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Top formatting mistakes',
        points: [
          'Crowded layout with inconsistent spacing.',
          'Too many fonts or decorative elements.',
          'Missing hierarchy between section headings and body text.',
        ],
      },
      {
        heading: 'Content mistakes',
        points: [
          'Responsibilities listed without impact.',
          'Overly generic summary and skills.',
          'Irrelevant older experience taking prime space.',
        ],
      },
      {
        heading: 'Application mistakes',
        points: [
          'Same resume for every job.',
          'No keyword optimization for target role.',
          'No final proofreading before submission.',
        ],
      },
    ],
  },
  {
    slug: 'best-action-verbs-for-resume',
    title: 'Best action verbs for resume',
    excerpt: 'Use stronger verbs to make your achievements clearer, sharper, and more persuasive.',
    readTime: '6 min read',
    updated: 'Updated April 2026',
    sections: [
      {
        heading: 'Why action verbs matter',
        points: [
          'They make ownership and initiative explicit.',
          'They improve perceived impact and clarity.',
          'They reduce passive and vague phrasing.',
        ],
      },
      {
        heading: 'High-impact verb categories',
        points: [
          'Leadership: led, directed, mentored, scaled.',
          'Execution: built, delivered, implemented, optimized.',
          'Analysis: analyzed, forecasted, evaluated, diagnosed.',
        ],
      },
      {
        heading: 'Better bullet rewrite pattern',
        points: [
          'Verb + what you did + how + measurable result.',
          'Example: “Optimized onboarding flow, reducing drop-off by 19%.”',
          'Keep each bullet one clear idea with one clear outcome.',
        ],
      },
    ],
  },
];
