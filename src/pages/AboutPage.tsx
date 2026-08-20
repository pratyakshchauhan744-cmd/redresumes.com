import { Section } from '../components/Section';
import { Seo } from '../components/Seo';

export const AboutPage = () => {
  return (
    <>
      <Seo
        title="About Us | Free Online Resume Builder | RedResumes"
        description="Learn about RedResumes, a free online resume builder designed to help job seekers create professional, recruiter-approved, ATS-friendly resumes."
      />
      <Section h1 title="About RedResumes" kicker="About Us">
        <div className="max-w-3xl border border-zinc-100 rounded-2xl p-6 bg-white text-zinc-600 space-y-6 text-sm leading-relaxed shadow-sm">
          <p>
            RedResumes is a free online resume builder designed to help job seekers create
            ATS-friendly resumes quickly and without design expertise. Users fill in their
            work history, education, and skills through a guided step-by-step interface,
            then choose from professionally designed templates optimized for applicant
            tracking systems. An AI writing assistant suggests bullet points and professional
            summary language based on the user's experience and target role. Finished resumes
            can be exported as PDF files and submitted directly to job listings on platforms
            like LinkedIn, Indeed, and Glassdoor. Unlike many resume builders that require a
            paid subscription to download the finished document, RedResumes provides PDF
            export free of charge, making it a cost-accessible option for job seekers at
            any career stage.
          </p>
          <p>
            RedResumes is built specifically for modern job seekers, career changers, students,
            and professionals looking to advance their careers. Whether you are drafting your
            first resume as a recent graduate or tailoring an existing one for a senior leadership
            role, our platform eliminates the friction of formatting and layout design. Our goal is
            to level the playing field for all job seekers by providing professional, clean-cut,
            recruiter-approved resume layouts at absolutely zero cost. We support users across all
            industries, including tech, finance, healthcare, education, sales, and creative arts,
            ensuring that your unique professional narrative is displayed clearly and readably.
          </p>
          <p>
            Building a standout resume on our platform is structured as an intuitive, step-by-step
            journey. You start by selecting one of our curated, ATS-optimized templates that best fits
            your industry's standards. From there, our guided interface walks you through each section
            of your resume—from contact details and a professional summary to work history, education,
            and skills. As you input your information, our built-in AI writing assistant suggests
            action-oriented bullet points and optimized descriptions tailored to your target role,
            helping you overcome writer's block and highlight achievements. Once you're done, you can
            instantly export your resume as a clean, high-quality PDF in just one click—no subscription
            fees, no locked features, and no account signup required.
          </p>
          <p>
            The core advantage of using RedResumes lies in our focus on applicant tracking systems (ATS).
            Most medium-to-large employers use ATS software to filter resumes before a human recruiter
            ever sees them. Generic templates with complex tables, icons, graphics, or unusual font choices
            often fail these scans, leading to immediate rejection. Our templates are designed from the
            ground up to be 100% ATS-friendly, ensuring that your credentials parse perfectly on platforms
            like LinkedIn, Indeed, Glassdoor, and Workday. Combined with our real-time ATS optimization
            score, cover letter builder, and dynamic AI-powered bullet suggestions, RedResumes gives you
            the tools to optimize your application, stand out to hiring managers, and land more interviews.
          </p>
        </div>
      </Section>
    </>
  );
};
