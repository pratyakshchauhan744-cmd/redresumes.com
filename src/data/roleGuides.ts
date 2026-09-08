export interface RoleGuideResumeData {
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  profileLink?: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    year: string;
  }>;
  skills: string[];
  projects?: Array<{
    title: string;
    description: string;
  }>;
  certifications?: string[];
  languages?: string[];
  templateId: string;
}

export interface RoleGuideStep {
  title: string;
  body: string;
}

export interface RoleGuideTip {
  title: string;
  body: string;
}

export interface RoleGuideMistake {
  mistake: string;
  fix: string;
}

export interface RoleGuideFaq {
  question: string;
  answer: string;
}

export interface RoleGuide {
  slug: string;
  role: string;
  badgeTitle: string;
  category: 'experience' | 'function' | 'format';
  categoryLabel: string;
  experienceLevel: string;
  metaTitle: string;
  metaDescription: string;
  heroIntro: string;
  heroImage?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  steps: RoleGuideStep[];
  resumeExample: RoleGuideResumeData;
  tips: RoleGuideTip[];
  topSkills: string[];
  mistakes: RoleGuideMistake[];
  faqs: RoleGuideFaq[];
  relatedSlugs: string[];
  datePublished: string;
  dateModified: string;
}

export const roleGuides: RoleGuide[] = [
  // 1. Entry Level
  {
    slug: 'entry-level',
    role: 'Entry Level',
    badgeTitle: 'Experience-Based Guide',
    category: 'experience',
    categoryLabel: 'By Experience Level',
    experienceLevel: '0-2 Years Experience',
    metaTitle: 'Entry Level Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'See an ATS-approved Entry Level resume example and follow our step-by-step writing guide to highlight transferable skills, projects, and coursework.',
    heroIntro: 'Breaking into the job market with limited full-time experience requires strategically framing your education, internships, academic projects, and transferable skills.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Experience Level', href: '/resume-examples?category=experience' },
      { label: 'Entry Level' }
    ],
    steps: [
      {
        title: 'Lead with a Goal-Oriented Professional Summary',
        body: 'Craft a 2–3 sentence summary stating your background, top technical or soft strengths, and the specific value you intend to deliver to the hiring team.'
      },
      {
        title: 'Elevate Relevant Academic Projects & Coursework',
        body: 'Treat substantial classroom, capstone, or personal projects like real-world experience. Detail the problem solved, tech or tools utilized, and measurable outcomes.'
      },
      {
        title: 'Quantify Internships and Extracurricular Leadership',
        body: 'Highlight internships, club leadership, or part-time roles using action verbs and quantifiable metrics (e.g., percentages, hours saved, users reached).'
      },
      {
        title: 'Group Skills into Hard and Soft Categories',
        body: 'Align your technical competencies, software proficiencies, and interpersonal skills with the exact keywords mentioned in the target job description.'
      }
    ],
    resumeExample: {
      templateId: 'minimal',
      name: 'Jordan Taylor',
      jobTitle: 'Entry Level Associate / Coordinator',
      email: 'jordan.taylor@email.com',
      phone: '+1 (555) 349-2180',
      location: 'Austin, TX',
      profileLink: 'linkedin.com/in/jordantaylor-entry',
      summary: 'Motivated Bachelor of Business Administration graduate with hands-on internship experience in operational workflow coordination, data analysis, and cross-functional team communication.',
      experience: [
        {
          title: 'Operations & Strategy Intern',
          company: 'Nexis Logistics',
          location: 'Austin, TX',
          dates: 'Jun 2025 - Dec 2025',
          bullets: [
            'Streamlined internal intake ticketing system, accelerating request turnaround time by 28%.',
            'Analyzed weekly vendor performance reports across 40+ suppliers using Excel and Power BI.',
            'Collaborated with 4 cross-functional team leads to draft updated onboarding documentation for 25 new hires.'
          ]
        },
        {
          title: 'Peer Academic Advisor & Student Coordinator',
          company: 'University Career Center',
          location: 'Austin, TX',
          dates: 'Sep 2024 - May 2025',
          bullets: [
            'Conducted resume review workshops and career navigation sessions for over 150 undergraduate students.',
            'Co-managed event logistics for university career fairs hosting 60+ visiting corporate recruiters.'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Business Administration (BBA)',
          school: 'University of Texas at Austin',
          year: '2021 - 2025'
        }
      ],
      skills: [
        'Data Analysis & Reporting',
        'Microsoft Excel (PivotTables, XLOOKUP)',
        'Google Workspace',
        'Project Coordination',
        'Written & Verbal Communication',
        'Cross-Functional Collaboration',
        'Process Optimization',
        'CRM Basics (HubSpot/Salesforce)'
      ],
      projects: [
        {
          title: 'Supply Chain Optimization Capstone',
          description: 'Designed a cost-reduction model for local retail distribution reducing freight overhead by 14% in simulation.'
        }
      ],
      certifications: ['Google Data Analytics Professional Certificate', 'Asana Project Management Fundamentals'],
      languages: ['English (Native)', 'Spanish (Conversational)']
    },
    tips: [
      {
        title: 'Focus on Transferable Skills',
        body: 'Even if your past jobs were in retail or hospitality, emphasize customer communication, problem solving, time management, and reliability.'
      },
      {
        title: 'Keep Layout Clean and Single-Page',
        body: 'For candidates with 0–2 years of experience, a clean one-page resume that passes ATS parsers is standard and expected by recruiters.'
      },
      {
        title: 'Tailor Keywords to Every Job Posting',
        body: 'Mirror the terminology from the job description directly into your skills list and project descriptions to ensure high ATS match scores.'
      },
      {
        title: 'Include Active Portfolio or GitHub Links',
        body: 'Add a clean link to your LinkedIn profile, GitHub repository, or online portfolio showcasing real artifacts of your work.'
      }
    ],
    topSkills: [
      'Microsoft Excel / Google Sheets',
      'Data Analysis & Visualization',
      'Project Coordination & Scheduling',
      'Cross-Functional Teamwork',
      'Problem Solving & Critical Thinking',
      'Process Documentation',
      'Research & Presentation',
      'Customer & Client Relations'
    ],
    mistakes: [
      {
        mistake: 'Listing vague buzzwords like "hard worker" without evidence',
        fix: 'Replace empty adjectives with concrete bullet points demonstrating where you took initiative and achieved measurable results.'
      },
      {
        mistake: 'Including high school education on a college graduate resume',
        fix: 'Remove high school credentials; focus entirely on your university degree, coursework, awards, and capstone projects.'
      },
      {
        mistake: 'Using multi-column or fancy graphic bars that break ATS parsers',
        fix: 'Stick to clean, single or structured ATS-friendly layouts with standard headings (Experience, Education, Skills).'
      },
      {
        mistake: 'Omitting unpaid internships, club leadership, or volunteer work',
        fix: 'Include all relevant project experience and extracurricular leadership that prove your capability and work ethic.'
      }
    ],
    faqs: [
      {
        question: 'How long should an entry-level resume be?',
        answer: 'An entry-level resume should always be exactly one page. Recruiters review early-career resumes in 6–10 seconds, so concise, well-structured bullet points work best.'
      },
      {
        question: 'Should I put my education before work experience?',
        answer: 'Yes. If you graduated recently or have limited full-time experience, placing your Education section near the top before your Experience section is standard practice.'
      },
      {
        question: 'Can I include relevant college coursework?',
        answer: 'Yes, listing 3–5 specialized courses related directly to the target role (e.g., Financial Modeling, Database Design, Digital Marketing Strategy) demonstrates targeted foundational knowledge.'
      },
      {
        question: 'How do I beat Applicant Tracking Systems (ATS) as a beginner?',
        answer: 'Use standard headings, single-column formats without graphics, and incorporate exact skill keywords from the job description into your bullets and skills section.'
      }
    ],
    relatedSlugs: ['fresher', 'student', 'career-change', 'software-engineer'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 2. Fresher
  {
    slug: 'fresher',
    role: 'Fresher',
    badgeTitle: 'Experience-Based Guide',
    category: 'experience',
    categoryLabel: 'By Experience Level',
    experienceLevel: 'Recent Graduate / No Experience',
    metaTitle: 'Fresher Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Complete Fresher resume example and step-by-step writing guide designed for recent college graduates entering the professional workforce.',
    heroIntro: 'Crafting your first professional resume without corporate experience is about turning your academic background, internships, certifications, and technical projects into compelling proof of potential.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Experience Level', href: '/resume-examples?category=experience' },
      { label: 'Fresher' }
    ],
    steps: [
      {
        title: 'Feature a Clear Career Objective or Summary',
        body: 'Summarize your degree, technical core competencies, and your career aspiration in 2 crisp sentences that align with the company mission.'
      },
      {
        title: 'Highlight Degree, Honors, and Relevant Coursework',
        body: 'Place your education prominently at the top. Mention your GPA (if above 3.5), academic honors, dean’s list, or relevant modules.'
      },
      {
        title: 'Break Down Major Academic & Personal Projects',
        body: 'Provide 2–3 detailed project summaries structured with: objective, technologies/tools applied, and key deliverable or impact.'
      },
      {
        title: 'Include Verified Certifications and Technical Skills',
        body: 'List industry certifications (AWS, Coursera, Meta, Google) to validate your initiative and readiness beyond standard classroom theory.'
      }
    ],
    resumeExample: {
      templateId: 'fresher',
      name: 'Rohan Sharma',
      jobTitle: 'Computer Science Graduate / Junior Developer',
      email: 'rohan.sharma@email.com',
      phone: '+1 (555) 890-4321',
      location: 'Seattle, WA',
      profileLink: 'github.com/rohansharma-dev',
      summary: 'Recent Computer Science B.S. graduate with solid foundations in data structures, algorithms, and full-stack development. Eager to contribute to scalable cloud applications.',
      experience: [
        {
          title: 'Software Development Intern',
          company: 'Apex Cloud Solutions',
          location: 'Seattle, WA',
          dates: 'Jun 2025 - Aug 2025',
          bullets: [
            'Developed RESTful API endpoints using Node.js and Express, serving 12,000+ daily requests.',
            'Collaborated in an agile scrum team of 6 engineers with bi-weekly sprint planning and code reviews.',
            'Wrote comprehensive unit tests with Jest, improving test coverage across core user auth modules by 19%.'
          ]
        }
      ],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science (GPA: 3.8/4.0)',
          school: 'University of Washington',
          year: '2021 - 2025'
        }
      ],
      skills: [
        'JavaScript & TypeScript',
        'Python',
        'React & Next.js',
        'Node.js & Express',
        'SQL & PostgreSQL',
        'Git & GitHub',
        'Docker Basics',
        'RESTful APIs'
      ],
      projects: [
        {
          title: 'E-Commerce Microservices Demo',
          description: 'Built a full-stack e-commerce app with React, Node.js, and MongoDB featuring user auth, cart checkout, and Stripe webhook handling.'
        },
        {
          title: 'AI Resume Keyword Matcher',
          description: 'Created a Python NLP script to analyze keyword overlap between resume text and job postings with 92% extraction accuracy.'
        }
      ],
      certifications: ['AWS Certified Cloud Practitioner', 'Meta Front-End Developer Certificate'],
      languages: ['English (Fluent)', 'Hindi (Native)']
    },
    tips: [
      {
        title: 'Prioritize Projects That Solved Real Problems',
        body: 'Recruiters favor candidates who built end-to-end working applications or conducted genuine research over generic boilerplate tutorials.'
      },
      {
        title: 'Highlight GitHub / Code Repositories',
        body: 'Include clean links to well-documented GitHub repositories with readable README files, live demos, and clear setup instructions.'
      },
      {
        title: 'Emphasize Extracurricular Tech Involvement',
        body: 'Mention participation in hackathons, coding competitions (LeetCode/Codeforces), or campus tech clubs to prove your proactive mindset.'
      },
      {
        title: 'Proofread for Zero Typographical Errors',
        body: 'Since freshers have shorter work histories, attention to detail is heavily evaluated. Check formatting, spelling, and dates meticulously.'
      }
    ],
    topSkills: [
      'Core Programming (JS, Python, Java)',
      'Data Structures & Algorithms',
      'Relational Databases & SQL',
      'Version Control (Git/GitHub)',
      'Web Development Fundamentals',
      'Agile / Scrum Methodologies',
      'Analytical Thinking',
      'Fast Learning Capability'
    ],
    mistakes: [
      {
        mistake: 'Leaving the resume completely empty due to lack of full-time corporate jobs',
        fix: 'Fill the space with substantial capstone projects, open-source contributions, academic research, and certifications.'
      },
      {
        mistake: 'Writing generic objective statements like "Seeking a challenging position to utilize my skills"',
        fix: 'Write a tailored summary explaining your specific specialization and how your skills fulfill the employer’s needs.'
      },
      {
        mistake: 'Submitting a multi-page resume',
        fix: 'Keep it strictly to one concise page with tight margins and crisp bullet points.'
      },
      {
        mistake: 'Omitting quantifiable metrics in projects',
        fix: 'Include metrics such as test coverage percentage, database query speed improvements, or API request volumes.'
      }
    ],
    faqs: [
      {
        question: 'What is the difference between an entry-level and fresher resume?',
        answer: 'A fresher resume is specifically tailored for fresh graduates with zero corporate experience, putting maximum focus on academic projects, GPA, and coursework. An entry-level resume may include 1–2 years of post-college work experience or internships.'
      },
      {
        question: 'Should I include my GPA on a fresher resume?',
        answer: 'Include your GPA if it is 3.5/4.0 or higher (or equivalent first-class distinction). If it is lower, focus attention on your project achievements and technical certifications instead.'
      },
      {
        question: 'Which resume template is best for freshers?',
        answer: 'A clean, single-column ATS-friendly template that leads with Education and Technical Projects before Experience is optimal for fresh graduates.'
      },
      {
        question: 'How do I demonstrate experience if I have never had a job?',
        answer: 'Build 2–3 portfolio projects, contribute to open source repositories, complete recognized online certifications, and highlight leadership in university student organizations.'
      }
    ],
    relatedSlugs: ['entry-level', 'student', 'software-engineer', 'data-analyst'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 3. Student
  {
    slug: 'student',
    role: 'Student',
    badgeTitle: 'Experience-Based Guide',
    category: 'experience',
    categoryLabel: 'By Experience Level',
    experienceLevel: 'High School / University Student',
    metaTitle: 'Student Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Download our ATS-ready student resume template and follow our guide to land competitive internships, co-ops, and part-time campus jobs.',
    heroIntro: 'Whether applying for summer internships, co-ops, research assistantships, or part-time roles, this guide shows students how to turn classroom excellence into job offers.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Experience Level', href: '/resume-examples?category=experience' },
      { label: 'Student' }
    ],
    steps: [
      {
        title: 'Include Expected Graduation Month and Year',
        body: 'Employers need to know your graduation timeline to evaluate internship eligibility and future full-time conversion opportunities.'
      },
      {
        title: 'List Academic Honors, Scholarships & Dean’s List',
        body: 'Feature academic merit, competitive scholarships, and honor society memberships near the top of your education section.'
      },
      {
        title: 'Detail Campus Leadership & Extracurriculars',
        body: 'Highlight student government, club officer roles, athletic team commitment, or volunteering to demonstrate leadership and grit.'
      },
      {
        title: 'Structure Coursework and Class Projects',
        body: 'Describe practical lab assignments, group research projects, or term papers that utilized industry-standard software tools.'
      }
    ],
    resumeExample: {
      templateId: 'academic',
      name: 'Emily Chen',
      jobTitle: 'Economics & Data Science Student',
      email: 'emily.chen@university.edu',
      phone: '+1 (555) 678-1290',
      location: 'Boston, MA',
      profileLink: 'linkedin.com/in/emilychen-student',
      summary: 'Undergraduate junior pursuing a dual B.S. in Economics and Data Analytics with proven skills in statistical modeling, R, Python, and market research. Seeking a Summer 2026 Analytics Internship.',
      experience: [
        {
          title: 'Undergraduate Research Assistant',
          company: 'Department of Applied Economics',
          location: 'Boston, MA',
          dates: 'Sep 2024 - Present',
          bullets: [
            'Collected and cleaned historical regional census datasets comprising 200,000+ records using Python and Pandas.',
            'Built multivariate regression models to evaluate the impact of transit subsidies on local business revenues.',
            'Co-authored research findings presented at the 2025 Regional Economics Undergraduate Symposium.'
          ]
        },
        {
          title: 'Treasurer & Event Coordinator',
          company: 'University Student Finance Association',
          location: 'Boston, MA',
          dates: 'Jan 2024 - Present',
          bullets: [
            'Managed an annual club operating budget of $18,500 with zero reporting discrepancies.',
            'Organized 8 guest speaker panels featuring industry analysts, attracting over 300 attendee members.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Economics & Data Analytics (Expected May 2027) | Dean’s Honor List (All Semesters)',
          school: 'Boston University',
          year: '2023 - 2027'
        }
      ],
      skills: [
        'Python & R Programming',
        'Statistical Modeling & Hypothesis Testing',
        'SQL & Database Queries',
        'Tableau & Excel (Advanced)',
        'Academic Research & Synthesis',
        'Public Speaking & Technical Writing',
        'Team Leadership'
      ],
      projects: [
        {
          title: 'Consumer Sentiment Analysis Pipeline',
          description: 'Constructed an NLP sentiment classifier analyzing 50,000 product reviews with 88% precision score.'
        }
      ],
      certifications: ['Tableau Desktop Specialist', 'Bloomberg Market Concepts (BMC)'],
      languages: ['English (Native)', 'Mandarin (Fluent)']
    },
    tips: [
      {
        title: 'Include Your College Email Address',
        body: 'Using an official `.edu` email address immediately establishes credibility and your current student standing.'
      },
      {
        title: 'Clarify Work Availability and Dates',
        body: 'In your summary or cover letter, specify exact internship availability (e.g., "Available 40 hrs/week June–August 2026").'
      },
      {
        title: 'Highlight Team Projects and Soft Skills',
        body: 'Demonstrate that you can collaborate effectively with diverse classmates under tight deadlines.'
      },
      {
        title: 'Keep Design Minimalist and Clean',
        body: 'Avoid dense graphic headers that distract from your educational achievements and project descriptions.'
      }
    ],
    topSkills: [
      'Statistical Analysis (Python, R)',
      'Data Manipulation & Cleaning',
      'Advanced Excel & Google Sheets',
      'Academic Research & Writing',
      'Public Speaking & Presentation',
      'Budget & Financial Management',
      'Time Management & Organization',
      'Critical Problem Solving'
    ],
    mistakes: [
      {
        mistake: 'Forgetting to list expected graduation date',
        fix: 'Always state your graduation month and year so recruiters can place you in the correct internship or graduate hiring cohort.'
      },
      {
        mistake: 'Including irrelevant high school achievements past freshman year of college',
        fix: 'Transition completely to university-level milestones, projects, and organizations once you enter your sophomore year.'
      },
      {
        mistake: 'Listing vague coursework titles without context',
        fix: 'Instead of just course names, describe specific capstone deliverables and tools mastered during the course.'
      },
      {
        mistake: 'Using an unprofessional email address',
        fix: 'Use either your official `.edu` email or a clean `firstname.lastname@gmail.com` address.'
      }
    ],
    faqs: [
      {
        question: 'When should I remove high school from my student resume?',
        answer: 'By the beginning of your sophomore year in college, all high school references should be removed and replaced with university coursework, clubs, internships, and research.'
      },
      {
        question: 'Can I apply for internships if I haven’t had a previous internship?',
        answer: 'Yes. Most students land their first internship using academic research, classroom capstones, club leadership, and independent portfolio projects.'
      },
      {
        question: 'Should I list my high school GPA?',
        answer: 'Only if you are a first-semester college freshman without university grades yet. Otherwise, list your college GPA only.'
      },
      {
        question: 'How do I format an expected graduation date?',
        answer: 'Write "Expected May 2027" or "Graduation: June 2026" right next to your university and degree name.'
      }
    ],
    relatedSlugs: ['entry-level', 'fresher', 'data-analyst', 'marketing'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 4. Career Change
  {
    slug: 'career-change',
    role: 'Career Change',
    badgeTitle: 'Experience-Based Guide',
    category: 'experience',
    categoryLabel: 'By Experience Level',
    experienceLevel: 'Transitioning Professionals',
    metaTitle: 'Career Change Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Pivot into a new industry seamlessly. See how to write a hybrid career change resume that highlights transferable skills and relevant retraining.',
    heroIntro: 'Transitioning to a new field requires reframing your past achievements, highlighting transferable competencies, and spotlighting recent certifications and upskilling.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Experience Level', href: '/resume-examples?category=experience' },
      { label: 'Career Change' }
    ],
    steps: [
      {
        title: 'Craft a Bridge Summary Explaining Your Transition',
        body: 'Explicitly connect your past industry expertise to the target domain, showing why your multi-disciplinary background is a competitive advantage.'
      },
      {
        title: 'Use a Hybrid / Combination Resume Format',
        body: 'Lead with a dedicated Core Competencies & Transferable Skills matrix before listing chronologically summarized past roles.'
      },
      {
        title: 'Spotlight Recent Upskilling, Bootcamps & Certifications',
        body: 'Feature your newly completed technical bootcamps, specialized credentials, and recent capstone projects right below the summary.'
      },
      {
        title: 'Translate Past Jargon into Universally Understood Impact',
        body: 'Remove niche acronyms from your former career; replace them with business impact metrics like revenue growth, operational efficiency, and stakeholder management.'
      }
    ],
    resumeExample: {
      templateId: 'two-column',
      name: 'Marcus Vance',
      jobTitle: 'Transitioning into Product Management (Former Operations Manager)',
      email: 'marcus.vance@email.com',
      phone: '+1 (555) 762-9014',
      location: 'Denver, CO',
      profileLink: 'linkedin.com/in/marcusvance-pm',
      summary: 'Results-driven Operations Manager with 7+ years optimizing supply chain systems and cross-functional teams, transitioning into Technical Product Management. Certified Scrum Product Owner (CSPO) with expertise in user journey mapping, Agile workflows, and SQL analytics.',
      experience: [
        {
          title: 'Senior Operations & Logistics Manager',
          company: 'Summit Freight Logistics',
          location: 'Denver, CO',
          dates: '2021 - Present',
          bullets: [
            'Led cross-functional team of 14 across software engineering and dispatch to build custom route-dispatch tool, saving $320K annually.',
            'Conducted 40+ user interviews with warehouse workers to define requirements for automated warehouse inventory tracker.',
            'Implemented Agile standups and sprint retrospectives, decreasing operational bottleneck resolution time by 35%.'
          ]
        },
        {
          title: 'Operations Analyst',
          company: 'Peak Distribution Partners',
          location: 'Denver, CO',
          dates: '2018 - 2021',
          bullets: [
            'Analyzed weekly fulfillment datasets across 6 distribution hubs using SQL and Tableau to identify order fulfillment lags.',
            'Created user-facing standard operating procedures that improved inventory accuracy from 91% to 98.4%.'
          ]
        }
      ],
      education: [
        {
          degree: 'Product Management Immersion Certificate',
          school: 'General Assembly',
          year: '2025'
        },
        {
          degree: 'B.S. in Industrial Engineering',
          school: 'Colorado State University',
          year: '2014 - 2018'
        }
      ],
      skills: [
        'Product Discovery & User Research',
        'Agile / Scrum (CSPO Certified)',
        'Product Roadmap Planning',
        'SQL Data Extraction & Analysis',
        'Cross-Functional Stakeholder Alignment',
        'Jira, Confluence, Figma Basics',
        'Process Optimization & KPI Tracking'
      ],
      projects: [
        {
          title: 'Dispatch Pro — Mobile Driver SaaS Concept',
          description: 'Conducted customer discovery, wireframed UI in Figma, and defined PRD with prioritized user stories and release milestones.'
        }
      ],
      certifications: ['Certified Scrum Product Owner (CSPO)', 'Google Data Analytics Professional Certificate'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Highlight Re-Training Prominently',
        body: 'Place your new certifications, degrees, or bootcamps near the top of the resume to prove immediate domain competence.'
      },
      {
        title: 'Re-Write Bullets Through the Lens of Your New Role',
        body: 'Frame your past achievements using the verbs and vocabulary standard to the target industry.'
      },
      {
        title: 'Build Proof-of-Work Projects',
        body: 'Provide concrete examples, case studies, or portfolio links demonstrating that you can execute the target job today.'
      },
      {
        title: 'Address the Transition Confidently',
        body: 'Never apologize for your background; position diverse experience as an asset that brings fresh perspective.'
      }
    ],
    topSkills: [
      'Cross-Industry Transferable Leadership',
      'Stakeholder Alignment & Communication',
      'Process & Workflow Optimization',
      'Data-Driven Decision Making',
      'Project & Scope Management',
      'Problem Solving & Adaptation',
      'Agile / Scrum Methodologies',
      'Continuous Upskilling & Learning'
    ],
    mistakes: [
      {
        mistake: 'Using industry-specific jargon from your old field that alienates new recruiters',
        fix: 'Translate terms into universal business outcomes: increased efficiency, cost savings, user satisfaction, and revenue generation.'
      },
      {
        mistake: 'Hiding or apologizing for your previous career history',
        fix: 'Emphasize how your previous background gives you unique domain empathy, analytical rigor, or leadership maturity.'
      },
      {
        mistake: 'Submitting a purely chronological resume with no bridge summary',
        fix: 'Use a strong bridge summary that immediately clarifies your pivot and target role.'
      },
      {
        mistake: 'Neglecting to earn accredited credentials in the target field',
        fix: 'Complete credible online certifications or recognized courses before sending out applications.'
      }
    ],
    faqs: [
      {
        question: 'Which resume format is best for a career change?',
        answer: 'A hybrid or combination resume format is best. It places a prominent summary, core competencies matrix, and recent certifications at the top, followed by a chronological employment history reframed around transferable achievements.'
      },
      {
        question: 'How do I explain my career change in my resume summary?',
        answer: 'Connect the dots in 2–3 sentences: state your core transferable strengths from your past career, mention your recent certifications/upskilling, and define the exact target role you are pursuing.'
      },
      {
        question: 'Will changing careers reset my salary to entry level?',
        answer: 'Not necessarily. If your leadership, communication, strategic analysis, or technical skills directly transfer, you can often negotiate mid-level compensation.'
      },
      {
        question: 'Should I include old jobs that are completely unrelated?',
        answer: 'Yes, but condense older or less relevant roles into 1–2 bullet points focusing strictly on leadership, teamwork, reliability, and measurable business improvements.'
      }
    ],
    relatedSlugs: ['entry-level', 'product-manager', 'business-analyst', 'marketing'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 5. Software Engineer
  {
    slug: 'software-engineer',
    role: 'Software Engineer',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Mid to Senior Engineer',
    metaTitle: 'Software Engineer Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'See a real Software Engineer resume example and follow our step-by-step guide to write a technical resume that beats ATS and lands senior engineering interviews.',
    heroIntro: 'Software engineering hiring is fiercely competitive. Stand out with clean architecture descriptions, measurable system performance gains, and modern tech stack keywords.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Software Engineer' }
    ],
    steps: [
      {
        title: 'Categorize Your Tech Stack Cleanly',
        body: 'Break your technical skills into Languages, Frameworks, Cloud / DevOps, and Databases so engineering managers and recruiters can scan your competencies in 3 seconds.'
      },
      {
        title: 'Structure Experience Using Google’s X-Y-Z Formula',
        body: 'Frame achievements as: "Accomplished [X], as measured by [Y], by doing [Z]" (e.g., "Reduced p99 API latency by 42% by migrating from monolith REST to Go gRPC services").'
      },
      {
        title: 'Highlight Scalability, Architecture & Cloud Infrastructure',
        body: 'Detail system scale: requests per second, database volumes, cloud cost reductions, microservices architecture, and CI/CD automation.'
      },
      {
        title: 'Showcase Code Ownership and Team Mentorship',
        body: 'Include code review rigor, architecture RFCs authored, agile sprint leadership, and mentorship of junior engineers.'
      }
    ],
    resumeExample: {
      templateId: 'technical',
      name: 'Alex Carter',
      jobTitle: 'Senior Full Stack Software Engineer',
      email: 'alex.carter@email.com',
      phone: '+1 (555) 221-0098',
      location: 'San Francisco, CA',
      profileLink: 'github.com/alexcarterdev',
      summary: 'Senior Software Engineer with 6+ years building high-throughput distributed systems, full-stack web applications, and cloud-native microservices. Passionate about developer velocity, observability, and clean code.',
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'CloudScale Technologies',
          location: 'San Francisco, CA',
          dates: '2022 - Present',
          bullets: [
            'Architected distributed event-driven payment processing pipeline with Kafka and Go, handling 15M+ daily transactions at 99.99% uptime.',
            'Decreased p95 API response times by 38% through Redis distributed caching layer and query execution optimization.',
            'Mentored 4 junior and mid-level engineers, established automated CI/CD GitHub Action workflows, reducing deployment cycle times from 45 min to 8 min.',
            'Authored 6 engineering design RFCs and drove zero-downtime migration of PostgreSQL clusters on AWS RDS.'
          ]
        },
        {
          title: 'Software Engineer',
          company: 'Nexis SaaS Labs',
          location: 'San Jose, CA',
          dates: '2019 - 2022',
          bullets: [
            'Engineered customer-facing analytics dashboard in React, TypeScript, and TailwindCSS serving 80,000+ active enterprise users.',
            'Built 20+ secure REST and GraphQL API microservices in Node.js/Express, reducing third-party data sync errors by 44%.',
            'Implemented comprehensive end-to-end testing with Playwright and Vitest, elevating automated test coverage to 86%.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Computer Science',
          school: 'University of California, Berkeley',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Languages: TypeScript, JavaScript, Python, Go, SQL',
        'Frontend: React, Next.js, Redux Toolkit, TailwindCSS',
        'Backend: Node.js, Express, Go, GraphQL, REST APIs',
        'Databases: PostgreSQL, MongoDB, Redis, DynamoDB',
        'Cloud & DevOps: AWS (ECS, Lambda, S3, RDS), Docker, Kubernetes, GitHub Actions, Terraform',
        'Testing & Tools: Jest, Vitest, Playwright, Datadog, Prometheus'
      ],
      projects: [
        {
          title: 'Open Source Distributed Rate Limiter',
          description: 'Built a high-performance sliding window rate limiter in Go with Redis backing, starred by 400+ developers on GitHub.'
        }
      ],
      certifications: ['AWS Certified Solutions Architect – Associate', 'Certified Kubernetes Application Developer (CKAD)'],
      languages: ['English (Fluent)']
    },
    tips: [
      {
        title: 'Include Concrete Scale & Metrics',
        body: 'Mention requests per second (RPS), active users, data volumes in TB/PB, or latency reductions in milliseconds.'
      },
      {
        title: 'Keep Code Repository Links Active',
        body: 'Verify your GitHub link is working and that pinned repositories have updated documentation and clean code.'
      },
      {
        title: 'Match Target Job Tech Stack',
        body: 'If the role requires Go and Kubernetes, ensure those tools are featured prominently in your top skills and recent experience.'
      },
      {
        title: 'Avoid Obsolete Technologies',
        body: 'Omit outdated legacy libraries unless directly required for legacy migration roles.'
      }
    ],
    topSkills: [
      'Full Stack System Design & Architecture',
      'TypeScript / JavaScript / Node.js',
      'Python & Go Backend Engineering',
      'React / Next.js State Management',
      'SQL & NoSQL Database Optimization',
      'Cloud Architecture (AWS / GCP)',
      'Docker & Container Orchestration',
      'CI/CD Automation & Test Coverage'
    ],
    mistakes: [
      {
        mistake: 'Listing every technology ever used without indicating core expertise',
        fix: 'Group skills by domain (Languages, Frontend, Backend, DevOps) and prioritize your strongest, most recent stack.'
      },
      {
        mistake: 'Writing passive task descriptions like "Responsible for writing code"',
        fix: 'Use active impact statements: "Architected", "Engineered", "Optimized", "Refactored", backed by measurable business results.'
      },
      {
        mistake: 'Ignoring ATS parsing by using graphic skill progress bars (e.g., 80% Python)',
        fix: 'List skills as searchable text keywords. Never use visual rating meters or chart graphics.'
      },
      {
        mistake: 'Leaving out security, performance, and testing contributions',
        fix: 'Highlight unit testing, auth protocols (OAuth2/JWT), rate limiting, and observability instrumentation.'
      }
    ],
    faqs: [
      {
        question: 'Should a Software Engineer resume be 1 or 2 pages?',
        answer: 'Engineers with under 5 years of experience should maintain a crisp 1-page resume. Senior engineers and engineering leads with 7+ years of extensive system design and team leadership can use 2 pages.'
      },
      {
        question: 'Do recruiters test code from GitHub links on resumes?',
        answer: 'Engineering managers and tech leads frequently click into GitHub repositories to evaluate commit hygiene, README clarity, modularity, and test coverage.'
      },
      {
        question: 'How should I list technical skills for ATS compliance?',
        answer: 'Group your skills into text-based categories (Languages, Frameworks, Cloud, Databases) rather than inserting visual rating bars or multi-column graphical bubbles.'
      },
      {
        question: 'Should I list personal coding projects if I have 5+ years of experience?',
        answer: 'For experienced engineers, commercial work history takes priority. Include personal projects only if they are widely adopted open-source packages or demonstrate expertise in a new technology stack.'
      }
    ],
    relatedSlugs: ['data-analyst', 'product-manager', 'entry-level', 'fresher'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 6. Marketing
  {
    slug: 'marketing',
    role: 'Marketing',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Mid to Senior Marketer',
    metaTitle: 'Marketing Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Learn how to write a high-converting Marketing resume with real growth metrics, ROAS benchmarks, SEO wins, and campaign leadership examples.',
    heroIntro: 'In modern data-driven marketing, your resume must demonstrate both creative vision and rigorous quantitative impact — proving how your campaigns directly generated pipeline and revenue.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Marketing' }
    ],
    steps: [
      {
        title: 'Lead with Campaign ROI and Revenue Growth',
        body: 'Demonstrate fiscal responsibility and performance marketing excellence by citing ROAS, CAC reduction, pipeline generated, and conversion rate uplifts.'
      },
      {
        title: 'Detail Multi-Channel Acquisition Strategies',
        body: 'Break down your experience across Organic Search (SEO), Paid Media (Google/Meta Ads), Email/Lifecycle Automation, and Content Marketing.'
      },
      {
        title: 'Highlight Marketing Analytics and MarTech Tools',
        body: 'Feature your proficiency in tools like Google Analytics 4, HubSpot, Marketo, Semrush, Looker Studio, and CRM integrations.'
      },
      {
        title: 'Demonstrate Brand Storytelling and Copywriting Rigor',
        body: 'Showcase how your messaging frameworks, positioning guides, and creative A/B testing resonated with target buyer personas.'
      }
    ],
    resumeExample: {
      templateId: 'consulting',
      name: 'Ava Collins',
      jobTitle: 'Senior Digital Marketing & Growth Manager',
      email: 'ava.collins@email.com',
      phone: '+1 (555) 489-3321',
      location: 'New York, NY',
      profileLink: 'linkedin.com/in/avacollins-growth',
      summary: 'Growth-oriented Digital Marketing Manager with 6+ years driving omnichannel acquisition, SEO/SEM strategies, and lifecycle funnels for high-growth B2B and SaaS brands. Proven track record managing $1.5M+ annual ad budgets at 3.6x average ROAS.',
      experience: [
        {
          title: 'Senior Growth Marketing Manager',
          company: 'Veloce SaaS Solutions',
          location: 'New York, NY',
          dates: '2022 - Present',
          bullets: [
            'Scaled paid acquisition across Google Search, LinkedIn, and Meta Ads, increasing annual qualified inbound pipeline from $2.4M to $6.8M.',
            'Spearheaded organic SEO overhaul, ranking for 180+ high-intent commercial keywords and growing monthly organic traffic by 115% YoY.',
            'Revamped automated lead nurturing email workflows in HubSpot, raising MQL-to-SQL conversion rate from 14% to 26%.',
            'Managed a team of 3 growth specialists and 4 freelance content creators, maintaining strict CPA targets across all channels.'
          ]
        },
        {
          title: 'Digital Marketing Specialist',
          company: 'Beacon Media Agency',
          location: 'New York, NY',
          dates: '2019 - 2022',
          bullets: [
            'Executed PPC campaigns for 8 B2B clients, optimizing landing pages to improve average click-to-lead conversion by 34%.',
            'Implemented GA4 and server-side tracking, eliminating 22% attribution data discrepancies across conversion funnels.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Marketing & Communications',
          school: 'New York University (NYU)',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Performance Marketing (Google Ads, LinkedIn, Meta)',
        'SEO & Content Strategy (Semrush, Ahrefs)',
        'Marketing Automation (HubSpot, Marketo)',
        'Analytics & Attribution (GA4, Looker Studio)',
        'Conversion Rate Optimization (CRO & Optimizely)',
        'Email Lifecycle Marketing & Retention',
        'Budget Allocation & ROAS Optimization',
        'Creative Direction & Copywriting'
      ],
      projects: [
        {
          title: 'B2B SaaS Product Launch Campaign',
          description: 'Executed integrated multi-channel go-to-market campaign generating 1,400 product signups in first 30 days.'
        }
      ],
      certifications: ['Google Ads Search & Measurement Certified', 'HubSpot Inbound Marketing Professional', 'Reforge Growth Series'],
      languages: ['English (Native)', 'French (Conversational)']
    },
    tips: [
      {
        title: 'Quantify Everything with Hard Numbers',
        body: 'Include specific percentages, dollar figures of pipeline generated, CTR improvements, and customer acquisition cost (CAC) reductions.'
      },
      {
        title: 'Balance Hard Tech Skills with Strategy',
        body: 'Showcase both hands-on technical tool execution (GA4, SQL, CRM) and high-level go-to-market positioning strategy.'
      },
      {
        title: 'Include Links to Published Work or Case Studies',
        body: 'Add a clean link to your digital portfolio, teardowns, or public marketing campaigns.'
      },
      {
        title: 'Align with B2B vs. B2C Realities',
        body: 'Tailor your terminology: B2B resumes should focus on MQLs, SQLs, and enterprise ACV, while B2C resumes emphasize viral loops, CAC, and LTV.'
      }
    ],
    topSkills: [
      'Growth & Paid Acquisition (PPC / Paid Social)',
      'Organic Search Engine Optimization (SEO)',
      'Marketing Automation & CRM (HubSpot)',
      'Data Analytics & Funnel Attribution (GA4)',
      'Conversion Rate Optimization (A/B Testing)',
      'Go-To-Market (GTM) Strategy',
      'Content Marketing & Brand Storytelling',
      'Budget Management & ROAS Modeling'
    ],
    mistakes: [
      {
        mistake: 'Writing vague statements like "Managed social media channels"',
        fix: 'Specify outcomes: "Grew organic social engagement by 78% and drove 4,200 referral website visits per month."'
      },
      {
        mistake: 'Failing to mention ad budget sizes and ROAS numbers',
        fix: 'Specify the monthly or annual ad spend managed and the resulting return on ad spend.'
      },
      {
        mistake: 'Omitting technical analytics tools',
        fix: 'List specific analytics tools (GA4, Google Tag Manager, Looker, Mixpanel, Segment) to prove data fluency.'
      },
      {
        mistake: 'Focusing exclusively on vanity metrics like impressions and views',
        fix: 'Tie your achievements directly to bottom-line conversions: leads, qualified demo requests, revenue, and customer retention.'
      }
    ],
    faqs: [
      {
        question: 'What do hiring managers look for in a marketing resume?',
        answer: 'Hiring managers prioritize measurable growth metrics: pipeline revenue generated, ROAS, CAC reduction, organic search traffic growth, and mastery of modern MarTech tools like HubSpot, GA4, and Ads platforms.'
      },
      {
        question: 'Should I include portfolio links on my marketing resume?',
        answer: 'Yes. A link to an online portfolio featuring creative campaign samples, content pieces, or visual dashboards significantly improves interview conversion.'
      },
      {
        question: 'How do I write a marketing resume if I haven’t managed large budgets?',
        answer: 'Focus on organic growth wins: SEO rankings achieved, email open and click-through rates, community growth, and creative viral reach with zero or low ad spend.'
      },
      {
        question: 'What is the most effective resume template for marketing professionals?',
        answer: 'A clean, modern two-column or structured template that allows you to cleanly highlight metrics, campaign summaries, and software competencies.'
      }
    ],
    relatedSlugs: ['sales-executive', 'graphic-designer', 'product-manager', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 7. Data Analyst
  {
    slug: 'data-analyst',
    role: 'Data Analyst',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Entry to Senior Analyst',
    metaTitle: 'Data Analyst Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Step-by-step Data Analyst resume guide with real SQL, Python, Tableau, and BI dashboard project examples that pass ATS parsers.',
    heroIntro: 'Transform complex raw data into actionable business intelligence on your resume. Learn how to highlight advanced SQL queries, BI dashboards, and statistical models.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Data Analyst' }
    ],
    steps: [
      {
        title: 'Feature Your Core Data Toolset Prominently',
        body: 'Categorize your technical skills: SQL (window functions, CTEs), BI Tools (Tableau, Power BI), Languages (Python, R), and Data Warehouses (Snowflake, BigQuery).'
      },
      {
        title: 'Emphasize Business Value Over Raw Data Tasks',
        body: 'Never stop at "wrote SQL queries." Explain the commercial decision or operational efficiency unlocked by your insights (e.g., "$450K churn prevention").'
      },
      {
        title: 'Highlight End-to-End Dashboard & ETL Pipeline Ownership',
        body: 'Detail how you gathered stakeholder requirements, designed automated data transformations, and created executive KPI dashboards.'
      },
      {
        title: 'Demonstrate Statistical Rigor and A/B Testing',
        body: 'Highlight hypothesis testing, regression analysis, customer cohort segmentation, and experimental design methodologies.'
      }
    ],
    resumeExample: {
      templateId: 'modern',
      name: 'Priya Patel',
      jobTitle: 'Senior Data & Business Intelligence Analyst',
      email: 'priya.patel@email.com',
      phone: '+1 (555) 304-9812',
      location: 'Chicago, IL',
      profileLink: 'github.com/priyapatel-analytics',
      summary: 'Senior Data Analyst with 5+ years translating complex multi-terabyte datasets into strategic business decisions. Expert in SQL, Python, Snowflake, and Tableau with a proven track record optimizing user retention and pricing models.',
      experience: [
        {
          title: 'Senior Data Analyst',
          company: 'FinTrack Analytics',
          location: 'Chicago, IL',
          dates: '2022 - Present',
          bullets: [
            'Engineered automated executive Tableau dashboards connected to Snowflake data warehouse, serving daily metrics to 120+ stakeholders.',
            'Conducted customer churn predictive modeling in Python (scikit-learn), identifying top drop-off factors and preventing an estimated $480K in annual churn.',
            'Optimized 50+ complex SQL ETL data pipelines, cutting daily batch query processing times by 45%.',
            'Led statistical A/B test analysis for checkout redesign, boosting payment completion rates by 6.2% across 2M+ monthly sessions.'
          ]
        },
        {
          title: 'Junior Data Analyst',
          company: 'Apex Retail Group',
          location: 'Chicago, IL',
          dates: '2020 - 2022',
          bullets: [
            'Extracted and cleansed sales transaction data across 35 stores using SQL and Power BI to identify inventory shrinkage trends.',
            'Collaborated with marketing to segment 500K customer emails, improving campaign conversion rates by 18%.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Statistics & Information Systems',
          school: 'University of Illinois Urbana-Champaign',
          year: '2016 - 2020'
        }
      ],
      skills: [
        'SQL (Complex Joins, Window Functions, CTEs)',
        'Python (Pandas, NumPy, Scikit-learn)',
        'Data Visualization (Tableau, Power BI, Looker)',
        'Data Warehousing (Snowflake, Google BigQuery, Redshift)',
        'Statistical Modeling & Hypothesis Testing',
        'A/B Testing & Cohort Analysis',
        'ETL Automation & dbt Basics',
        'Stakeholder Presentation & Storytelling'
      ],
      projects: [
        {
          title: 'E-Commerce Customer Lifetime Value (LTV) Forecast',
          description: 'Built regression model predicting 12-month customer LTV with 89% accuracy using Python and BigQuery.'
        }
      ],
      certifications: ['Tableau Certified Data Analyst', 'AWS Certified Data Analytics – Specialty'],
      languages: ['English (Fluent)', 'Gujarati (Native)']
    },
    tips: [
      {
        title: 'Specify Advanced SQL Competencies',
        body: 'Explicitly mention complex SQL concepts like Window Functions, Common Table Expressions (CTEs), indexing, and query optimization.'
      },
      {
        title: 'Include Links to Public Tableau or GitHub Portfolios',
        body: 'Provide clickable links to Tableau Public profiles or GitHub repositories demonstrating your real data cleaning and visualization code.'
      },
      {
        title: 'Highlight Stakeholder Communication',
        body: 'Demonstrate your ability to explain technical statistical conclusions to non-technical executives and product managers.'
      },
      {
        title: 'Showcase Data Warehouse Familiarity',
        body: 'Mention modern cloud data warehouses like Snowflake, BigQuery, or Amazon Redshift.'
      }
    ],
    topSkills: [
      'Advanced SQL (CTEs, Window Functions)',
      'Python Data Analysis (Pandas, NumPy)',
      'Business Intelligence (Tableau, Power BI)',
      'Cloud Warehouses (Snowflake, BigQuery)',
      'Statistical Analysis & A/B Experimentation',
      'Data Modeling & Schema Design',
      'ETL Pipelines & Workflow Automation',
      'Executive KPI Reporting & Storytelling'
    ],
    mistakes: [
      {
        mistake: 'Listing SQL without demonstrating advanced proficiency or scale',
        fix: 'Mention the size of datasets queried (e.g., millions of rows) and specific complex analytical functions utilized.'
      },
      {
        mistake: 'Focusing entirely on tools while ignoring business decisions influenced',
        fix: 'Explain the outcome: cost savings, revenue gained, fraud identified, or customer retention improvements.'
      },
      {
        mistake: 'Using visual infographics or pie charts directly on the resume layout',
        fix: 'Keep the resume itself strictly in ATS-friendly text format and link out to a visual Tableau Public portfolio.'
      },
      {
        mistake: 'Failing to mention data cleaning and validation effort',
        fix: 'Highlight data quality audits, anomaly detection, and automated validation scripts.'
      }
    ],
    faqs: [
      {
        question: 'What skills are most important for a Data Analyst resume in 2026?',
        answer: 'Advanced SQL, a major BI tool (Tableau or Power BI), Python or R for statistical scripting, cloud warehousing (Snowflake/BigQuery), and proven commercial problem-solving skills.'
      },
      {
        question: 'Should I include a Tableau Public link on my resume?',
        answer: 'Yes! Having a link to a live, interactive Tableau Public or Power BI dashboard portfolio gives hiring managers immediate proof of your visual storytelling abilities.'
      },
      {
        question: 'How do I show SQL proficiency without certification?',
        answer: 'Detail real query use cases in your bullet points: optimizing long-running queries, building automated ETL views, combining multi-table schemas with CTEs, and calculating cohort retention.'
      },
      {
        question: 'Is Python mandatory for data analysts?',
        answer: 'While SQL and BI tools are the core requirements, knowing Python (Pandas) sets you apart for senior roles and automated data extraction pipelines.'
      }
    ],
    relatedSlugs: ['software-engineer', 'business-analyst', 'product-manager', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 8. Sales Executive
  {
    slug: 'sales-executive',
    role: 'Sales Executive',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Account Executive / Sales Leader',
    metaTitle: 'Sales Executive Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Craft an quota-crushing Sales Executive resume. Learn how to highlight quota attainment percentage, deal sizes, pipeline creation, and CRM mastery.',
    heroIntro: 'In sales, your numbers are your credentials. Learn how to present quota attainment, average contract values (ACV), outbound prospecting, and enterprise deal cycles.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Sales Executive' }
    ],
    steps: [
      {
        title: 'Put Quota Attainment Percentages Front and Center',
        body: 'State your historical quota attainment for every role (e.g., "Achieved 124% of annual $1.8M quota in 2025; President’s Club Winner").'
      },
      {
        title: 'Specify Deal Sizes and Sales Cycle Lengths',
        body: 'Give recruiters context on your sales motion: Average Contract Value (ACV $25K–$250K+), sales cycles (30 days to 9 months), and buyer personas (C-Suite, VP).'
      },
      {
        title: 'Detail Outbound Prospecting & Pipeline Generation',
        body: 'Demonstrate whether you rely on SDR inbound leads or actively hunt outbound business through cold calling, LinkedIn Sales Navigator, and multi-touch sequences.'
      },
      {
        title: 'Highlight CRM and Sales Tech Stack Fluency',
        body: 'List proficiency with Salesforce, HubSpot CRM, Gong.io, Outreach, ZoomInfo, and LinkedIn Sales Navigator.'
      }
    ],
    resumeExample: {
      templateId: 'sales',
      name: 'Noah Bennett',
      jobTitle: 'Enterprise Account Executive (B2B SaaS)',
      email: 'noah.bennett@email.com',
      phone: '+1 (555) 442-7890',
      location: 'San Francisco, CA',
      profileLink: 'linkedin.com/in/noahbennett-sales',
      summary: 'Top-performing Enterprise Account Executive with 7+ years closing complex B2B SaaS solutions across Fortune 500 accounts. Consistently exceeded annual quotas (125%+ average attainment), closing over $14M in lifetime contract value.',
      experience: [
        {
          title: 'Senior Enterprise Account Executive',
          company: 'Vanguard Cloud Security',
          location: 'San Francisco, CA',
          dates: '2022 - Present',
          bullets: [
            'Generated $2.6M in New Annual Recurring Revenue (ARR) in 2025, finishing at 138% of annual quota and securing President’s Club honors.',
            'Closed the company’s largest enterprise deal of the year: a 3-year, $780K contract with a Fortune 100 financial institution.',
            'Self-sourced 42% of sales pipeline using targeted multi-channel outbound cadences via LinkedIn Sales Navigator and ZoomInfo.',
            'Partnered with Solutions Engineers to execute high-impact executive demos and proof-of-concept (POC) evaluations for CISO buyers.'
          ]
        },
        {
          title: 'Account Executive',
          company: 'ScaleMetric Software',
          location: 'San Francisco, CA',
          dates: '2019 - 2022',
          bullets: [
            'Achieved 118% average annual quota across mid-market accounts with an average deal size of $45K ARR.',
            'Maintained 32% win-rate from qualified demo to close, leading the 12-person regional sales pod in CRM compliance.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.A. in Business Administration & Marketing',
          school: 'University of Southern California (USC)',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Enterprise SaaS Sales & Negotiation',
        'Complex Multi-Stakeholder Deal Cycles',
        'Outbound Prospecting & Cold Calling',
        'Salesforce CRM & Pipeline Forecasting',
        'MEDDPICC & Command of the Message',
        'Contract Negotiation & Procurement',
        'Executive C-Suite Presentations',
        'Sales Enablement (Gong, Outreach, ZoomInfo)'
      ],
      projects: [],
      certifications: ['MEDDPICC Sales Methodology Certified', 'Salesforce Certified Administrator Basics'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Include President’s Club and Awards',
        body: 'Mention President’s Club, Top Rep of the Year, or fast-track promotions in your summary and job bullets.'
      },
      {
        title: 'State Your Sales Methodology',
        body: 'Explicitly reference structured sales frameworks like MEDDPICC, Challenger Sales, BANT, or Sandler Selling.'
      },
      {
        title: 'Clarify Hunter vs. Farmer Responsibilities',
        body: 'Indicate whether your roles were focused on New Business Acquisition (Hunter) or Account Expansion and Upselling (Farmer).'
      },
      {
        title: 'Keep Formatting Direct and Dynamic',
        body: 'Use high-impact action verbs: Closed, Negotiated, Sourced, Penetrated, Exceeded, Outperformed.'
      }
    ],
    topSkills: [
      'Enterprise B2B Deal Closing',
      'Quota Attainment & Revenue Growth',
      'Salesforce & CRM Pipeline Hygiene',
      'MEDDPICC / Challenger Methodologies',
      'Outbound Multi-Touch Prospecting',
      'Contract & Pricing Negotiation',
      'C-Level Executive Pitching',
      'Territory Planning & Account Mapping'
    ],
    mistakes: [
      {
        mistake: 'Listing generic responsibilities without quota attainment numbers',
        fix: 'Always provide exact percentages: e.g., "115% of $1.2M quota" rather than "Responsible for making sales calls."'
      },
      {
        mistake: 'Failing to mention deal sizes and customer segments',
        fix: 'Specify whether you sold to SMBs ($5K–$20K ACV), Mid-Market ($20K–$100K), or Enterprise ($100K+ ACV).'
      },
      {
        mistake: 'Omitting CRM and sales automation tools',
        fix: 'Include Salesforce, Gong, Outreach, SalesLoft, ZoomInfo, and LinkedIn Sales Navigator.'
      },
      {
        mistake: 'Failing to highlight team collaboration',
        fix: 'Mention how you partnered with Solutions Engineers, Customer Success, and Product to win complex bids.'
      }
    ],
    faqs: [
      {
        question: 'What is the most important metric on a sales resume?',
        answer: 'Annual and quarterly quota attainment percentage (e.g., 125% of $1.5M quota). Secondary metrics include average deal size (ACV), win rate, and self-sourced pipeline percentage.'
      },
      {
        question: 'How do I format a sales resume if I missed quota due to market conditions?',
        answer: 'Highlight relative rank within the company (e.g., "Ranked #2 out of 35 account executives"), notable enterprise logo wins, and new pipeline generated.'
      },
      {
        question: 'Should I list sales methodology certifications?',
        answer: 'Yes! Certifications in MEDDPICC, Command of the Message, or Sandler Selling signal that you use structured, predictable closing processes.'
      },
      {
        question: 'How long should an account executive resume be?',
        answer: 'One page for mid-market and junior reps; two pages maximum for senior enterprise reps with 8+ years of extensive deal history.'
      }
    ],
    relatedSlugs: ['marketing', 'product-manager', 'customer-support', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 9. HR Manager
  {
    slug: 'hr-manager',
    role: 'HR Manager',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Mid to Senior HR Professional',
    metaTitle: 'HR Manager Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Create a compelling HR Manager resume with real metrics on employee retention, talent acquisition, DE&I, HRIS implementations, and compliance.',
    heroIntro: 'Showcase human resources leadership: employee engagement, compliance management, compensation benchmarking, and talent acquisition at scale.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'HR Manager' }
    ],
    steps: [
      {
        title: 'Lead with Workforce Scale and Retention Improvements',
        body: 'Specify the size of the workforce supported (e.g., "Supporting 450+ employees across 4 global offices") and retention rate increases achieved.'
      },
      {
        title: 'Highlight Full Employee Lifecycle Management',
        body: 'Detail your impact across talent acquisition, onboarding, performance reviews, employee relations, and offboarding.'
      },
      {
        title: 'Feature HRIS and People Analytics Platforms',
        body: 'List mastery of HR tech tools like Workday, BambooHR, ADP, Greenhouse, Lever, Lattice, and Culture Amp.'
      },
      {
        title: 'Emphasize Compliance, Policy & DE&I Leadership',
        body: 'Detail labor law compliance (FMLA, FLSA, EEOC), handbook creation, compensation reviews, and DE&I initiative results.'
      }
    ],
    resumeExample: {
      templateId: 'corporate',
      name: 'Samantha Reed',
      jobTitle: 'Senior Human Resources Manager (SHRM-SCP)',
      email: 'samantha.reed@email.com',
      phone: '+1 (555) 912-3345',
      location: 'Atlanta, GA',
      profileLink: 'linkedin.com/in/samanthareed-hr',
      summary: 'Strategic Human Resources Manager with 8+ years leading full-lifecycle people operations, talent acquisition, and employee retention across scaling tech organizations of 500+ employees. SHRM-SCP certified with deep expertise in HRIS migrations, compensation design, and employment law compliance.',
      experience: [
        {
          title: 'Human Resources Manager',
          company: 'Novatech Systems',
          location: 'Atlanta, GA',
          dates: '2021 - Present',
          bullets: [
            'Direct all HR operations, employee relations, and compliance for 380 corporate and remote employees across 14 states.',
            'Spearheaded transition from legacy payroll to BambooHR and Lattice, reducing HR administrative overhead by 30%.',
            'Redesigned onboarding and manager training programs, boosting 90-day new hire retention from 82% to 94%.',
            'Restructured company-wide compensation bands and benefits packages, saving $140K while maintaining competitive market offers.'
          ]
        },
        {
          title: 'HR Generalist / Business Partner',
          company: 'Apex Health Partners',
          location: 'Atlanta, GA',
          dates: '2017 - 2021',
          bullets: [
            'Managed employee relations investigations, resolving 100% of workplace disputes within compliance timelines.',
            'Partnered with hiring managers to recruit and onboard 120+ technical and healthcare roles annually via Greenhouse ATS.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Human Resource Management & Organizational Psychology',
          school: 'University of Georgia',
          year: '2013 - 2017'
        }
      ],
      skills: [
        'HR Strategy & People Operations',
        'Talent Acquisition & ATS (Greenhouse, Lever)',
        'HRIS Management (Workday, BambooHR, ADP)',
        'Employee Relations & Conflict Resolution',
        'Performance Management (Lattice, 15Five)',
        'Compensation Benchmarking & Benefits Design',
        'Labor Law Compliance (FLSA, FMLA, EEOC)',
        'Diversity, Equity & Inclusion (DE&I)'
      ],
      projects: [],
      certifications: ['SHRM Senior Certified Professional (SHRM-SCP)', 'Senior Professional in Human Resources (SPHR)'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Highlight SHRM / HRCI Certifications in Your Header',
        body: 'Place SHRM-CP, SHRM-SCP, PHR, or SPHR credentials directly after your name in the header for instant authority.'
      },
      {
        title: 'Quantify Employee Engagement Gains',
        body: 'Include eNPS (Employee Net Promoter Score) improvements or reduction in annual voluntary turnover rates.'
      },
      {
        title: 'Demonstrate Scalability',
        body: 'Explain how you helped a company scale from X to Y headcount while maintaining cultural health and compliance.'
      },
      {
        title: 'Include Policy and Audit Successes',
        body: 'Mention flawless 401(k) audits, employee handbook overhauls, or successful benefits renewals.'
      }
    ],
    topSkills: [
      'Workforce Planning & People Strategy',
      'Employee Relations & Retention Strategy',
      'HRIS Administration (BambooHR, Workday)',
      'Recruitment & Talent Acquisition',
      'Compensation & Benefits Structuring',
      'Compliance & Labor Law (EEOC, FMLA)',
      'Performance Management Systems',
      'Organizational Culture & DE&I'
    ],
    mistakes: [
      {
        mistake: 'Listing passive clerical HR tasks like "Filed employee paperwork"',
        fix: 'Frame as strategic initiatives: "Digitized 1,000+ employee records into cloud HRIS, cutting compliance retrieval time by 80%."'
      },
      {
        mistake: 'Failing to mention specific HRIS and ATS platforms',
        fix: 'Explicitly list software tools like Workday, ADP, BambooHR, Greenhouse, and Lattice.'
      },
      {
        mistake: 'Omitting company size and workforce headcount',
        fix: 'Always state whether you managed people operations for 50, 500, or 5,000 employees.'
      },
      {
        mistake: 'Ignoring retention and turnover metrics',
        fix: 'Include concrete metrics on reduced turnover, time-to-hire, and employee satisfaction improvements.'
      }
    ],
    faqs: [
      {
        question: 'Are SHRM certifications required on an HR resume?',
        answer: 'While not legally mandatory, having SHRM-CP, SHRM-SCP, PHR, or SPHR credentials significantly increases interview callback rates for mid-to-senior HR roles.'
      },
      {
        question: 'How do I quantify achievements on an HR manager resume?',
        answer: 'Focus on: reduction in voluntary turnover percentage, improvement in employee eNPS score, reduction in average days to fill open requisitions, and cost savings on benefits renewals.'
      },
      {
        question: 'Should I list specific HR software tools?',
        answer: 'Yes. Employers look for experience with their exact HRIS (Workday, BambooHR, ADP) and ATS (Greenhouse, Lever, iCIMS).'
      },
      {
        question: 'How long should an HR Manager resume be?',
        answer: 'For HR managers with 5–10 years of experience, a tightly edited 1 or 2 page resume works well. Ensure the top third highlights your certifications and team headcount supported.'
      }
    ],
    relatedSlugs: ['customer-support', 'sales-executive', 'business-analyst', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 10. Product Manager
  {
    slug: 'product-manager',
    role: 'Product Manager',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Associate to Principal PM',
    metaTitle: 'Product Manager Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Craft a high-impact Product Manager resume. Learn how to highlight roadmaps, feature launches, user engagement metrics, and cross-functional leadership.',
    heroIntro: 'Product Managers sit at the intersection of tech, business, and UX. Your resume must prove that you can discover user needs, prioritize roadmaps, and ship high-impact features.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Product Manager' }
    ],
    steps: [
      {
        title: 'Lead with Shipped Products and Commercial Impact',
        body: 'State products launched and their impact on ARR, activation, conversion rates, and monthly active users (MAU).'
      },
      {
        title: 'Demonstrate Customer Discovery and Qualitative Research',
        body: 'Highlight user interviews, usability testing, customer feedback loops, and translation of pain points into Product Requirement Documents (PRDs).'
      },
      {
        title: 'Highlight Data Fluency and Metric Ownership',
        body: 'Showcase proficiency with Mixpanel, Amplitude, SQL, Google Analytics, and running rigorous statistical A/B tests.'
      },
      {
        title: 'Showcase Cross-Functional Engineering and Design Alignment',
        body: 'Demonstrate how you lead agile sprints, manage backlogs in Jira, collaborate with engineering leads, and guide UI/UX wireframing.'
      }
    ],
    resumeExample: {
      templateId: 'modern',
      name: 'Alex Morgan',
      jobTitle: 'Senior Product Manager',
      email: 'alex.morgan@email.com',
      phone: '+1 (555) 310-4492',
      location: 'Austin, TX',
      profileLink: 'linkedin.com/in/alexmorgan-pm',
      summary: 'Senior Product Manager with 7+ years driving end-to-end product lifecycle for B2B SaaS and consumer mobile applications. Proven track record increasing user activation by 28% and scaling products from 0-to-1 to 400K+ Monthly Active Users.',
      experience: [
        {
          title: 'Senior Product Manager (Growth & Monetization)',
          company: 'CloudFlow Technologies',
          location: 'Austin, TX',
          dates: '2022 - Present',
          bullets: [
            'Owned self-serve monetization roadmap, running 18 A/B experiments that elevated trial-to-paid conversion from 4.2% to 6.8%, generating $1.8M incremental ARR.',
            'Conducted 50+ user interviews and analyzed Amplitude behavioral funnels to redesign onboarding flow, cutting day-7 churn by 22%.',
            'Led cross-functional pod of 9 engineers, 2 product designers, and 1 data analyst in bi-weekly Agile sprints.',
            'Authored comprehensive PRDs, wireframed MVP concepts in Figma, and defined north star product KPIs for executive leadership.'
          ]
        },
        {
          title: 'Product Manager',
          company: 'Zenith Mobile Apps',
          location: 'Austin, TX',
          dates: '2019 - 2022',
          bullets: [
            'Launched 0-to-1 iOS & Android financial tracking app, achieving 250,000 downloads and 4.8-star App Store rating in the first 6 months.',
            'Integrated Stripe recurring billing and optimized mobile subscription paywall, increasing average revenue per user (ARPU) by 19%.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Computer Information Systems',
          school: 'University of Texas at Dallas',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Product Strategy & Roadmap Planning',
        'Customer Discovery & User Research',
        'Product Analytics (Amplitude, Mixpanel, SQL)',
        'A/B Testing & Growth Experimentation',
        'Agile / Scrum Backlog Grooming (Jira)',
        'PRD Writing & Feature Prioritization',
        'UI/UX Prototyping (Figma)',
        'Go-to-Market (GTM) Collaboration'
      ],
      projects: [],
      certifications: ['Certified Scrum Product Owner (CSPO)', 'Reforge Product Strategy Certificate'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Highlight North Star Metrics',
        body: 'Specify your product’s primary metric: DAU/MAU, Net Retention Rate (NRR), Activation Rate, or Customer Lifetime Value.'
      },
      {
        title: 'Demonstrate 0-to-1 vs. Scale Experience',
        body: 'Clarify whether your achievements were in launching brand new products from scratch (0-to-1) or optimizing mature platforms at scale.'
      },
      {
        title: 'Include Behavioral Analytics Tools',
        body: 'Mention Amplitude, Mixpanel, Pendo, FullStory, or SQL to demonstrate data-backed prioritization.'
      },
      {
        title: 'Prove Strong Engineering Empathy',
        body: 'Show that you understand technical constraints, API integrations, and trade-offs when partnering with software engineers.'
      }
    ],
    topSkills: [
      'Product Strategy & Vision',
      'Roadmap Prioritization (RICE Framework)',
      'Product Analytics (Amplitude, Mixpanel)',
      'A/B Testing & Experimentation',
      'User Research & Customer Interviews',
      'Agile Sprint & Backlog Management (Jira)',
      'PRD & User Story Writing',
      'Cross-Functional Team Leadership'
    ],
    mistakes: [
      {
        mistake: 'Listing feature releases without mentioning their user adoption or revenue outcome',
        fix: 'Always connect feature releases to adoption metrics: "Launched multi-workspace sharing feature, resulting in 24% increase in team invites."'
      },
      {
        mistake: 'Sounding like a Project Manager instead of a Product Manager',
        fix: 'Focus on "Why" and "What" (user value, discovery, strategy) rather than strictly "When" (schedules and deadlines).'
      },
      {
        mistake: 'Failing to mention data tools or SQL',
        fix: 'Modern PMs must be data fluent. Include SQL, Amplitude, Mixpanel, or Tableau.'
      },
      {
        mistake: 'Ignoring UI/UX design collaboration',
        fix: 'Highlight how you collaborate with designers on user journeys, wireframes, and usability tests in Figma.'
      }
    ],
    faqs: [
      {
        question: 'What do hiring managers look for on a Product Manager resume?',
        answer: 'Clear ownership of shipped products, measurable business outcomes (conversion, retention, ARR), strong user discovery processes, and data fluency (A/B testing, SQL, Amplitude).'
      },
      {
        question: 'Should a PM resume include technical details?',
        answer: 'Yes. Demonstrating familiarity with API architectures, cloud infrastructure, and data schemas proves you can communicate effectively with engineering teams.'
      },
      {
        question: 'How do I format achievements as an Associate Product Manager (APM)?',
        answer: 'Highlight user research studies completed, specific feature iterations launched, bug triage efficiency, and analytics dashboards built to monitor KPIs.'
      },
      {
        question: 'What is the ideal length for a PM resume?',
        answer: '1 page for APMs and PMs with under 6 years of experience; 2 pages for Senior, Staff, or Director of Product roles.'
      }
    ],
    relatedSlugs: ['software-engineer', 'data-analyst', 'marketing', 'career-change'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 11. Graphic Designer
  {
    slug: 'graphic-designer',
    role: 'Graphic Designer',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Visual / Brand / UI Designer',
    metaTitle: 'Graphic Designer Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Learn how to write an ATS-friendly Graphic Designer resume with portfolio links, Adobe Creative Suite mastery, brand identity wins, and UI design skills.',
    heroIntro: 'Visual excellence starts with your resume layout. Learn how to showcase your design software mastery, brand identity systems, and commercial design impact while maintaining ATS readability.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Graphic Designer' }
    ],
    steps: [
      {
        title: 'Include a Prominent, Clickable Portfolio Link',
        body: 'Your portfolio is your primary asset. Place a clean URL to Behance, Dribbble, or your personal design website at the very top of your contact info.'
      },
      {
        title: 'List Mastery of Industry Standard Design Software',
        body: 'Highlight proficiency in Figma, Adobe Photoshop, Illustrator, InDesign, After Effects, and Premiere Pro.'
      },
      {
        title: 'Quantify Design Impact on Brand & Marketing Goals',
        body: 'Connect design assets to business results: ad CTR increases, rebranding adoption, packaging sales growth, and event collateral reach.'
      },
      {
        title: 'Balance Print, Digital, and UI/UX Capabilities',
        body: 'Show versatility across digital marketing banners, web UI layouts, print collateral, vector iconography, and design systems.'
      }
    ],
    resumeExample: {
      templateId: 'designer',
      name: 'Mia Lawson',
      jobTitle: 'Senior Brand & Graphic Designer',
      email: 'mia.lawson@email.com',
      phone: '+1 (555) 187-4300',
      location: 'San Francisco, CA',
      profileLink: 'mialawson.design',
      summary: 'Creative Senior Graphic Designer with 6+ years designing visual brand identities, marketing campaigns, and digital UI assets for fast-growing lifestyle and tech brands. Expert in Figma, Adobe Creative Cloud, and typography.',
      experience: [
        {
          title: 'Senior Brand Designer',
          company: 'Aura Studio & Creative Labs',
          location: 'San Francisco, CA',
          dates: '2022 - Present',
          bullets: [
            'Spearheaded comprehensive brand identity redesign for 4 enterprise clients, creating brand guidelines, vector icon sets, and design tokens.',
            'Designed high-converting paid social ad creatives in Figma and After Effects, lifting client average ad CTR by 38%.',
            'Collaborated with web development team to design responsive landing page templates, reducing bounce rate by 24%.',
            'Produced high-impact print collateral, packaging, and booth experiences for national trade conferences hosting 15,000+ attendees.'
          ]
        },
        {
          title: 'Graphic & Visual Designer',
          company: 'Horizon Media Group',
          location: 'San Francisco, CA',
          dates: '2019 - 2022',
          bullets: [
            'Created over 300 digital marketing assets per quarter across email newsletters, display ads, and social media channels.',
            'Established centralized design asset library in Figma, accelerating asset turnaround time across marketing teams by 35%.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.F.A. in Graphic Design & Visual Communication',
          school: 'California College of the Arts (CCA)',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Figma & UI Prototyping',
        'Adobe Photoshop, Illustrator & InDesign',
        'Motion Graphics (After Effects)',
        'Brand Identity & Logo Systems',
        'Typography & Layout Composition',
        'Packaging & Print Production',
        'Design Systems & Asset Libraries',
        'HTML & CSS Basics'
      ],
      projects: [
        {
          title: 'Fintech Mobile App Iconography & Design System',
          description: 'Created a 120-piece custom icon set and color accessibility palette adopted across web and mobile apps.'
        }
      ],
      certifications: ['Adobe Certified Professional in Visual Design'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Keep the Resume ATS-Friendly Despite Being a Designer',
        body: 'Do not submit a multi-column graphic image or non-parseable PDF. Use clean text formatting and let your external portfolio showcase graphic flair.'
      },
      {
        title: 'Highlight Motion & Video Skills',
        body: 'Adding After Effects or motion graphic design skills gives you an immediate competitive advantage for digital marketing roles.'
      },
      {
        title: 'Emphasize Typography and Hierarchy',
        body: 'Your resume typography reflects your design discipline. Use clean hierarchy, consistent spacing, and readable font weights.'
      },
      {
        title: 'Mention Cross-Functional Collaboration',
        body: 'Highlight working with developers, copywriters, and marketing managers to ship cohesive campaigns.'
      }
    ],
    topSkills: [
      'Adobe Creative Suite (Photoshop, Illustrator)',
      'Figma & UI Component Systems',
      'Brand Guidelines & Visual Identity',
      'Motion Design & Animation (After Effects)',
      'Print Production & Packaging Prep',
      'Typography, Color Theory & Grid Layouts',
      'Digital Ad Creative & Social Banners',
      'Design File Management & Versioning'
    ],
    mistakes: [
      {
        mistake: 'Submitting a heavily styled graphic PDF that fails ATS parsing',
        fix: 'Use clean, text-based ATS resume templates and place a prominent link to your visual online portfolio.'
      },
      {
        mistake: 'Forgetting to include a live portfolio link',
        fix: 'Always place a working portfolio URL in the header. No design hiring manager hires without reviewing your portfolio.'
      },
      {
        mistake: 'Listing design tools without explaining what you created',
        fix: 'Specify deliverables: brand identity packages, vector iconography, motion ads, packaging dielines, or landing pages.'
      },
      {
        mistake: 'Ignoring performance metrics and business impact',
        fix: 'Include conversion improvements, CTR uplifts, and brand engagement growth.'
      }
    ],
    faqs: [
      {
        question: 'Should a graphic designer resume be highly creative or ATS-friendly?',
        answer: 'Both: keep the resume layout clean, structured, and parseable by ATS software with elegant typography, and provide a direct link to your creative online portfolio.'
      },
      {
        question: 'What is the best platform to host a design portfolio?',
        answer: 'A custom personal website (Webflow, Framer, Squarespace) or established design platforms like Behance and Dribbble.'
      },
      {
        question: 'Is Figma required for print graphic designers?',
        answer: 'While InDesign and Illustrator remain standard for print, knowledge of Figma is increasingly expected for digital marketing and collaborative asset handoff.'
      },
      {
        question: 'How many portfolio pieces should I showcase?',
        answer: 'Feature 5–8 high-quality case studies with context on the brief, design iterations, and final deliverables.'
      }
    ],
    relatedSlugs: ['marketing', 'product-manager', 'software-engineer', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 12. Customer Support
  {
    slug: 'customer-support',
    role: 'Customer Support',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Specialist to Support Lead',
    metaTitle: 'Customer Support Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Write a standout Customer Support resume. Learn how to highlight CSAT scores, ticket resolution volume, SLA compliance, and Zendesk mastery.',
    heroIntro: 'Showcase customer empathy and operational efficiency. Learn how to highlight CSAT ratings, first-contact resolution rates, and help center documentation.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Customer Support' }
    ],
    steps: [
      {
        title: 'Feature High CSAT Scores and Resolution Metrics',
        body: 'Quantify your customer satisfaction ratings (e.g., "Maintained 98.2% positive CSAT score across 4,500+ resolved tickets").'
      },
      {
        title: 'List Help Desk and CRM Software Mastery',
        body: 'Highlight software proficiency in Zendesk, Intercom, Freshdesk, Salesforce Service Cloud, and Jira Service Management.'
      },
      {
        title: 'Showcase Knowledge Base and Macro Creation',
        body: 'Demonstrate initiative by describing how you authored help center articles, created saved reply macros, and reduced ticket volume.'
      },
      {
        title: 'Highlight Omnichannel Communication Skills',
        body: 'Detail your experience across live chat, email support, inbound phone calls, and social media community moderation.'
      }
    ],
    resumeExample: {
      templateId: 'minimal',
      name: 'Daniel Kim',
      jobTitle: 'Senior Customer Support & Experience Specialist',
      email: 'daniel.kim@email.com',
      phone: '+1 (555) 723-9081',
      location: 'Phoenix, AZ',
      profileLink: 'linkedin.com/in/danielkim-cx',
      summary: 'Customer Support Specialist with 5+ years delivering technical and billing support for high-growth SaaS platforms. Maintained 98%+ CSAT score while resolving 65+ tickets daily across Zendesk and Intercom.',
      experience: [
        {
          title: 'Senior Customer Support Specialist',
          company: 'Kudo SaaS Platforms',
          location: 'Phoenix, AZ',
          dates: '2022 - Present',
          bullets: [
            'Resolved 65+ technical and billing support tickets daily via Zendesk and live chat, maintaining a 98.4% CSAT rating.',
            'Authored 35 new internal macro templates and 22 customer-facing Knowledge Base articles, cutting recurring ticket volume by 16%.',
            'Exceeded team SLA resolution benchmarks, achieving an average First Response Time (FRT) under 4 minutes on live chat.',
            'Trained and mentored 8 newly hired support associates on escalation protocols and de-escalation communication techniques.'
          ]
        },
        {
          title: 'Customer Experience Associate',
          company: 'Brightline Retail Tech',
          location: 'Phoenix, AZ',
          dates: '2019 - 2022',
          bullets: [
            'Handled inbound phone and email support inquiries regarding order fulfillment, payments, and account access.',
            'Partnered with product engineering in Jira to log and verify 80+ customer-reported software bugs.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.A. in Communications',
          school: 'Arizona State University',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Zendesk & Intercom Administration',
        'Customer Satisfaction (CSAT & NPS)',
        'First Response Time (FRT) & SLA Adherence',
        'Technical Troubleshooting & Bug Logging (Jira)',
        'Knowledge Base & Help Center Authoring',
        'Conflict De-escalation & Empathy',
        'Omnichannel Support (Chat, Email, Phone)',
        'CRM & Account Verification'
      ],
      projects: [],
      certifications: ['Zendesk Support Certified Administrator', 'HubSpot Customer Service Certified'],
      languages: ['English (Native)', 'Korean (Conversational)']
    },
    tips: [
      {
        title: 'Include Ticket Volumes and Response Times',
        body: 'Mention how many tickets or chats you handled per day/week and your average first response and resolution times.'
      },
      {
        title: 'Highlight Technical Troubleshooting Abilities',
        body: 'Showcase how you debug technical issues, replicate bugs, and work alongside product engineers.'
      },
      {
        title: 'Mention Cross-Functional Feedback Loops',
        body: 'Explain how you aggregated user feedback to help product teams prioritize bugs and user experience fixes.'
      },
      {
        title: 'Demonstrate De-escalation Mastery',
        body: 'Emphasize your ability to turn frustrated customers into loyal brand advocates.'
      }
    ],
    topSkills: [
      'Help Desk Software (Zendesk, Intercom)',
      'Customer Satisfaction (CSAT / NPS Tracking)',
      'SLA Compliance & Speed of Resolution',
      'Conflict De-escalation & Active Listening',
      'Knowledge Base Documentation (Help Center)',
      'Technical Diagnostics & Jira Bug Logging',
      'Multi-Channel Support (Email, Chat, Phone)',
      'Process Improvement & Macros'
    ],
    mistakes: [
      {
        mistake: 'Listing vague duties like "Helped customers with questions"',
        fix: 'Use concrete metrics: "Resolved 60+ inquiries daily across chat and email with 98% CSAT rating."'
      },
      {
        mistake: 'Failing to mention specific ticketing platforms',
        fix: 'Explicitly list Zendesk, Intercom, Freshdesk, Salesforce Service Cloud, or Kustomer.'
      },
      {
        mistake: 'Ignoring process improvements you contributed to',
        fix: 'Highlight saved-reply templates authored, self-serve articles published, or onboarding guides built.'
      },
      {
        mistake: 'Omitting technical aptitude',
        fix: 'Mention browser debugging, API status checks, billing gateway troubleshooting, and bug ticketing in Jira.'
      }
    ],
    faqs: [
      {
        question: 'What metrics should I put on a Customer Support resume?',
        answer: 'CSAT (Customer Satisfaction score), First Response Time (FRT), Average Resolution Time, daily/weekly ticket resolution volume, and SLA compliance percentage.'
      },
      {
        question: 'How do I highlight soft skills like empathy on a support resume?',
        answer: 'Demonstrate soft skills through achievements: de-escalating upset enterprise clients, maintaining 98%+ satisfaction ratings, and receiving internal peer recognition awards.'
      },
      {
        question: 'Can I transition from retail customer service to tech customer support?',
        answer: 'Yes! Emphasize customer problem-solving, fast learning of internal point-of-sale systems, conflict resolution, and complete free online certifications in Zendesk or HubSpot.'
      },
      {
        question: 'How long should a customer support resume be?',
        answer: 'Exactly one page. Support recruiters value concise, scannable resumes with clear metrics.'
      }
    ],
    relatedSlugs: ['sales-executive', 'hr-manager', 'entry-level', 'business-analyst'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 13. Accountant
  {
    slug: 'accountant',
    role: 'Accountant',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Staff to Senior Accountant',
    metaTitle: 'Accountant Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'Write an ATS-friendly Accountant resume. Learn how to highlight GAAP compliance, month-end close acceleration, audits, reconciliation, and ERP tools.',
    heroIntro: 'Precision, compliance, and fiscal integrity are paramount. Learn how to showcase general ledger expertise, GAAP compliance, month-end close optimization, and ERP financial systems.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Accountant' }
    ],
    steps: [
      {
        title: 'Highlight CPA Licensure and Accounting Credentials',
        body: 'Feature your Certified Public Accountant (CPA) license or CMA designation prominently in your header and education section.'
      },
      {
        title: 'Quantify Month-End Close and Financial Reporting Gains',
        body: 'Mention how you reduced month-end close timelines (e.g., "Shortened monthly close cycle from 10 days to 4 days").'
      },
      {
        title: 'List Financial ERP Software and Advanced Excel Skills',
        body: 'Detail software proficiency in NetSuite, QuickBooks, SAP, Sage, Oracle, along with advanced Excel (VBA, Power Query, PivotTables).'
      },
      {
        title: 'Highlight Audit Preparedness and GAAP Compliance',
        body: 'Showcase leadership in annual external audits (Big 4), tax filings, SOX compliance, and general ledger reconciliations.'
      }
    ],
    resumeExample: {
      templateId: 'corporate',
      name: 'Jessica Taylor',
      jobTitle: 'Senior Corporate Accountant (CPA)',
      email: 'jessica.taylor@email.com',
      phone: '+1 (555) 439-0128',
      location: 'Dallas, TX',
      profileLink: 'linkedin.com/in/jessicataylor-cpa',
      summary: 'Certified Public Accountant (CPA) with 6+ years managing full-cycle general ledger accounting, financial statement preparation, and multi-entity reconciliations. Proven track record reducing month-end close cycles by 40% using NetSuite and automated reconciliation workflows.',
      experience: [
        {
          title: 'Senior Accountant',
          company: 'Crestview Capital & Holdings',
          location: 'Dallas, TX',
          dates: '2022 - Present',
          bullets: [
            'Manage monthly, quarterly, and annual financial closes for 5 subsidiary business units with $85M in combined annual revenue.',
            'Optimized bank and balance sheet reconciliation workflows in NetSuite, reducing close turnaround time from 9 business days to 5 days.',
            'Facilitated annual external Big 4 financial audit, providing complete schedules and resulting in zero material audit findings.',
            'Streamlined Accounts Payable (AP) and Accounts Receivable (AR) matching, improving cash flow forecasting accuracy by 22%.'
          ]
        },
        {
          title: 'Staff Accountant',
          company: 'Apex Global Financial Services',
          location: 'Dallas, TX',
          dates: '2019 - 2022',
          bullets: [
            'Prepared monthly journal entries, accrued liabilities, and depreciation schedules in accordance with US GAAP.',
            'Managed corporate credit card expense tracking and payroll reconciliation for 200+ employees.'
          ]
        }
      ],
      education: [
        {
          degree: 'Master of Science in Accounting (MSA)',
          school: 'Southern Methodist University (SMU)',
          year: '2018 - 2019'
        },
        {
          degree: 'B.B.A. in Accounting & Finance',
          school: 'Texas A&M University',
          year: '2014 - 2018'
        }
      ],
      skills: [
        'US GAAP & IFRS Compliance',
        'General Ledger & Balance Sheet Reconciliation',
        'Financial Reporting & Variance Analysis',
        'ERP Systems (NetSuite, SAP, QuickBooks)',
        'Advanced Microsoft Excel (VBA, Power Query)',
        'Internal Controls & SOX Compliance',
        'Month-End, Quarter-End & Year-End Close',
        'External Audit Preparation'
      ],
      projects: [],
      certifications: ['Certified Public Accountant (CPA) – Texas State Board', 'Certified Management Accountant (CMA)'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Feature CPA Designation in Your Header',
        body: 'Always write "CPA" after your name (e.g., "Jessica Taylor, CPA") to immediately clear automated ATS filters.'
      },
      {
        title: 'Specify Entity Revenue and Transaction Volume',
        body: 'Mention the revenue size of entities managed ($10M to $500M+) and volume of monthly transactions processed.'
      },
      {
        title: 'Highlight Accounting Automation',
        body: 'Describe how you automated repetitive manual Excel tasks using Power Query, VBA macros, or modern accounting integrations.'
      },
      {
        title: 'Include Tax Preparation or Audit Details',
        body: 'Mention sales tax filings, 1099 compliance, and clean external audit track records.'
      }
    ],
    topSkills: [
      'US GAAP Standards & Reporting',
      'General Ledger (GL) Accounting',
      'Month-End Close Optimization',
      'ERP Accounting Software (NetSuite, SAP)',
      'Advanced Excel (Power Query, PivotTables)',
      'Internal Controls & Audit Readiness',
      'Accounts Payable & Receivable (AP/AR)',
      'Financial Statement Preparation'
    ],
    mistakes: [
      {
        mistake: 'Listing basic accounting tasks without mentioning financial scale',
        fix: 'Include company revenue, asset sizes, and transaction volumes managed.'
      },
      {
        mistake: 'Failing to mention CPA license status',
        fix: 'State clearly if you are an active CPA or a CPA Candidate (e.g., "4/4 CPA Exam Sections Passed").'
      },
      {
        mistake: 'Omitting specific accounting software',
        fix: 'Explicitly list NetSuite, QuickBooks Online, SAP, Sage Intacct, or BlackLine.'
      },
      {
        mistake: 'Neglecting month-end close metrics',
        fix: 'State how many days your team takes to close the books and any improvements you implemented.'
      }
    ],
    faqs: [
      {
        question: 'Should I put CPA in my resume title?',
        answer: 'Yes! If you are a licensed CPA, include it right after your name (e.g., "John Doe, CPA") and in your professional summary.'
      },
      {
        question: 'How do I list CPA exam progress if I haven’t finished all sections?',
        answer: 'Write "CPA Candidate — Passed FAR and REG (Remaining sections scheduled for Q3 2026)" under your Certifications or Education section.'
      },
      {
        question: 'What Excel skills should accountants highlight?',
        answer: 'Advanced PivotTables, XLOOKUP, INDEX/MATCH, Power Query, SUMIFS, and VBA/macro automation for recurring financial reconciliations.'
      },
      {
        question: 'What is the ideal resume format for accountants?',
        answer: 'A clean, single or structured corporate format with clear headings for Education, Certifications, Technical Accounting Skills, and Experience.'
      }
    ],
    relatedSlugs: ['data-analyst', 'business-analyst', 'hr-manager', 'entry-level'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  },

  // 14. Business Analyst
  {
    slug: 'business-analyst',
    role: 'Business Analyst',
    badgeTitle: 'Role-Based Guide',
    category: 'function',
    categoryLabel: 'By Job Function',
    experienceLevel: 'Entry to Senior Business Analyst',
    metaTitle: 'Business Analyst Resume Example & Writing Guide (2026) | RedResumes',
    metaDescription: 'See an ATS-optimized Business Analyst resume example and learn how to showcase requirement gathering, process mapping, SQL, and Agile delivery.',
    heroIntro: 'Bridge the gap between business stakeholders and technical development teams. Learn how to highlight user stories, process modeling, SQL analysis, and workflow automation.',
    breadcrumb: [
      { label: 'Home', href: '/' },
      { label: 'Resume Examples', href: '/resume-examples' },
      { label: 'Job Function', href: '/resume-examples?category=function' },
      { label: 'Business Analyst' }
    ],
    steps: [
      {
        title: 'Highlight Business Requirements Gathering (BRD & FRD)',
        body: 'Detail how you elicit business requirements, author Business Requirement Documents (BRD), and write agile user stories with clear acceptance criteria.'
      },
      {
        title: 'Showcase Process Mapping & Workflow Optimization',
        body: 'Mention standard process modeling notations (BPMN, UML, Visio, Lucidchart) and describe the "As-Is" vs "To-Be" workflow enhancements achieved.'
      },
      {
        title: 'Demonstrate Data Analysis and Technical Tool Proficiency',
        body: 'Feature technical skills: SQL queries, Power BI, Tableau, Jira, Confluence, and ERP/CRM system integrations.'
      },
      {
        title: 'Quantify Operational Cost Reductions and ROI',
        body: 'Connect requirements delivered to commercial impact: hours of manual work eliminated, operational cost savings, and error reduction rates.'
      }
    ],
    resumeExample: {
      templateId: 'modern',
      name: 'Brian Patel',
      jobTitle: 'Senior Business Analyst (CBAP)',
      email: 'brian.patel@email.com',
      phone: '+1 (555) 834-1120',
      location: 'Atlanta, GA',
      profileLink: 'linkedin.com/in/brianpatel-ba',
      summary: 'Certified Business Analysis Professional (CBAP) with 6+ years eliciting requirements, optimizing enterprise workflows, and delivering Agile technology initiatives. Expert in SQL, BPMN process modeling, Jira backlog grooming, and executive stakeholder alignment.',
      experience: [
        {
          title: 'Senior Business Analyst',
          company: 'Equinox Financial Solutions',
          location: 'Atlanta, GA',
          dates: '2022 - Present',
          bullets: [
            'Led business requirement gathering across 8 stakeholder departments for multi-million-dollar digital banking platform upgrade.',
            'Mapped "As-Is" and "To-Be" operational workflows using BPMN 2.0 in Lucidchart, eliminating 4 manual verification steps and saving 1,200 annual staff hours.',
            'Authored 140+ detailed user stories with acceptance criteria in Jira and facilitated backlog grooming for a team of 12 software developers.',
            'Executed SQL queries across Oracle databases to validate data migration integrity for 350,000 active customer accounts with 99.98% accuracy.'
          ]
        },
        {
          title: 'Business Analyst',
          company: 'Apex Supply Chain Partners',
          location: 'Atlanta, GA',
          dates: '2019 - 2022',
          bullets: [
            'Created executive Power BI dashboards tracking procurement KPIs and vendor SLA compliance.',
            'Facilitated User Acceptance Testing (UAT) sessions with 45 business users, logging and validating 60+ pre-launch test scenarios.'
          ]
        }
      ],
      education: [
        {
          degree: 'B.S. in Management Information Systems (MIS)',
          school: 'Georgia Institute of Technology',
          year: '2015 - 2019'
        }
      ],
      skills: [
        'Requirement Elicitation & BRD/FRD Documentation',
        'Agile / Scrum (User Stories, Acceptance Criteria)',
        'Business Process Modeling (BPMN 2.0, Lucidchart)',
        'SQL Data Extraction & Validation',
        'Data Visualization (Power BI, Tableau)',
        'Jira, Confluence & Azure DevOps',
        'User Acceptance Testing (UAT) Coordination',
        'Stakeholder Management & Workshop Facilitation'
      ],
      projects: [],
      certifications: ['Certified Business Analysis Professional (CBAP – IIBA)', 'PMI Professional in Business Analysis (PMI-PBA)'],
      languages: ['English (Native)']
    },
    tips: [
      {
        title: 'Include Recognized IIBA / PMI Certifications',
        body: 'Mention CBAP, CCBA, ECBA, or PMI-PBA certifications to demonstrate formal business analysis rigor.'
      },
      {
        title: 'Distinguish Business Analysis from Pure Data Analysis',
        body: 'Showcase process mapping, requirement elicitation, and stakeholder facilitation alongside data queries.'
      },
      {
        title: 'Detail UAT and Implementation Success',
        body: 'Explain how you coordinated User Acceptance Testing (UAT) and managed change management across end users.'
      },
      {
        title: 'Quantify Operational Efficiency Gained',
        body: 'Include numbers on manual hours saved, cycle time reductions, and budget savings delivered.'
      }
    ],
    topSkills: [
      'Business Requirements Gathering (BRD/FRD)',
      'Agile User Stories & Backlog Grooming',
      'Process Flow Mapping (BPMN, UML, Visio)',
      'SQL Data Querying & Reconciliation',
      'User Acceptance Testing (UAT) Management',
      'Business Intelligence (Power BI, Tableau)',
      'Jira, Confluence & Work Tracking',
      'Cross-Functional Stakeholder Alignment'
    ],
    mistakes: [
      {
        mistake: 'Focusing exclusively on technical SQL queries without showing stakeholder collaboration',
        fix: 'Highlight workshop facilitation, requirements elicitation, user interviews, and cross-functional leadership.'
      },
      {
        mistake: 'Failing to mention Agile and project management software',
        fix: 'Include Jira, Confluence, Azure DevOps, and Agile Scrum ceremonial practices.'
      },
      {
        mistake: 'Listing vague tasks without business outcomes',
        fix: 'Frame accomplishments around operational hours saved, defect reduction, or faster time-to-market.'
      },
      {
        mistake: 'Omitting User Acceptance Testing (UAT) experience',
        fix: 'Detail test case writing, defect triage with developers, and stakeholder sign-off facilitation.'
      }
    ],
    faqs: [
      {
        question: 'What is the difference between a Business Analyst and a Data Analyst resume?',
        answer: 'A Data Analyst focuses heavily on quantitative data modeling, SQL/Python scripts, and BI dashboards. A Business Analyst focuses on process mapping (BPMN), requirements documentation (BRD/FRD), user stories in Jira, and bridging business stakeholders with IT development teams.'
      },
      {
        question: 'Which certifications are best for a Business Analyst resume?',
        answer: 'IIBA certifications (ECBA for entry level, CCBA for mid-level, CBAP for senior) and PMI-PBA are the gold standards for business analysts.'
      },
      {
        question: 'Is SQL required for a Business Analyst resume?',
        answer: 'Yes, most modern business analyst roles expect intermediate SQL skills to query databases and validate business logic independently.'
      },
      {
        question: 'How long should a Business Analyst resume be?',
        answer: '1 page for BAs with under 5 years of experience; 2 pages for senior lead BAs with extensive enterprise project history.'
      }
    ],
    relatedSlugs: ['data-analyst', 'product-manager', 'accountant', 'software-engineer'],
    datePublished: '2026-06-01',
    dateModified: '2026-09-08'
  }
];

export const getAllRoleGuides = (): RoleGuide[] => roleGuides;

export const getRoleGuideBySlug = (slug: string): RoleGuide | undefined => {
  const normalized = slug.toLowerCase().trim();
  return roleGuides.find((item) => item.slug === normalized);
};

export const getRelatedRoleGuides = (slug: string, limit = 3): RoleGuide[] => {
  const guide = getRoleGuideBySlug(slug);
  if (!guide) return roleGuides.slice(0, limit);

  const related = guide.relatedSlugs
    .map((s) => getRoleGuideBySlug(s))
    .filter((item): item is RoleGuide => Boolean(item));

  if (related.length < limit) {
    const additional = roleGuides.filter(
      (item) => item.slug !== slug && !related.some((r) => r.slug === item.slug)
    );
    return [...related, ...additional].slice(0, limit);
  }

  return related.slice(0, limit);
};

export const getRoleGuidesByCategory = (category: 'experience' | 'function' | 'format'): RoleGuide[] => {
  return roleGuides.filter((item) => item.category === category);
};
