import { Section } from '../components/Section';
import { Seo } from '../components/Seo';

const PRIVACY_POLICY = [
  "Last Updated: June 2026",
  "At RedResumes, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and safeguard the information you provide while using our resume-building, interview preparation, and career assistance services.",
  "When you create an account, we may collect information such as your name, email address, and login credentials. We also collect the information you choose to upload or enter into the platform, including resumes, cover letters, employment history, educational background, skills, certifications, and job descriptions. In addition, we automatically collect certain technical information such as browser type, device information, IP address, usage patterns, and analytics data to help improve our services and maintain platform security.",
  "The information we collect is used to provide and improve RedResumes' features, including resume generation, ATS optimization, interview practice, job-search assistance, customer support, and platform performance. Some features may utilize artificial intelligence technologies to generate content, provide recommendations, or simulate interview experiences. While we strive to provide accurate and helpful results, AI-generated content may contain inaccuracies, and users are responsible for reviewing all generated content before using it professionally.",
  "RedResumes does not sell personal information to third parties. We may share information with trusted service providers who help us operate the platform, such as cloud hosting providers, authentication providers, analytics services, and payment processors. We may also disclose information when required by law, legal process, or to protect the rights, safety, and security of our users and services.",
  "We implement reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction. However, no method of electronic storage or transmission over the internet can be guaranteed to be completely secure.",
  "You retain ownership of all content you upload to RedResumes. We store your information only for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. You may request access to your information, correction of inaccurate data, export of your data, or deletion of your account by contacting us at support@redresumes.com.",
  "By using RedResumes, you acknowledge and agree to the practices described in this Privacy Policy. We may update this Privacy Policy from time to time, and any changes will be posted on this page with an updated revision date."
];

const TERMS_OF_SERVICE = [
  "Last Updated: June 2026",
  "Welcome to RedResumes. By accessing or using our website, applications, and related services, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you should not use our services.",
  "RedResumes provides online tools and services designed to assist users with resume creation, ATS optimization, cover letter generation, interview preparation, job-search assistance, and related career development activities. We reserve the right to modify, suspend, or discontinue any feature of the service at any time without prior notice.",
  "Users are responsible for maintaining the confidentiality of their account credentials and for all activities that occur under their account. You agree to provide accurate information during registration and to keep your account information updated.",
  "All resumes, documents, and content uploaded by users remain the property of the respective user. By submitting content to RedResumes, you grant us a limited license to store, process, analyze, and display that content solely for the purpose of providing the requested services. We do not claim ownership of your resumes or personal documents.",
  "You agree not to use RedResumes for any unlawful, fraudulent, abusive, or harmful purpose. You may not attempt to gain unauthorized access to the platform, interfere with system operations, upload malicious software, or engage in activities that could disrupt the service for other users.",
  "Certain features of RedResumes may use artificial intelligence to generate recommendations, resumes, cover letters, interview responses, and other content. These outputs are provided for informational purposes only and should not be considered professional, legal, employment, or career advice. Users are solely responsible for reviewing and validating all generated content before submitting it to employers or third parties.",
  "The RedResumes platform, including its software, design, branding, logos, content, and technology, is protected by intellectual property laws and remains the exclusive property of RedResumes and its licensors. Unauthorized copying, reproduction, or distribution of platform materials is prohibited.",
  "To the fullest extent permitted by law, RedResumes is provided on \"as is\" and \"as available\" basis without warranties of any kind. We do not guarantee employment outcomes, interview success, ATS acceptance, uninterrupted availability, or error-free operation of the service.",
  "In no event shall RedResumes, its owners, employees, partners, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of or inability to use the platform.",
  "These Terms of Service shall be governed by and interpreted in accordance with the laws of India. Any disputes arising out of or relating to these terms shall be subject to the exclusive jurisdiction of the courts located in India.",
  "If you have any questions regarding these Terms of Service, please contact us at support@redresumes.com"
];

export const LegalPage = ({ title }: { title: string }) => {
  const content = title === 'Privacy Policy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <>
      <Seo
        title={`${title} | Red Resumes`}
        description={`Read the official ${title} for Red Resumes. Understand your rights and how we manage security and data collection.`}
      />
      <Section h1 title={title} kicker="Legal">
        <div className="max-w-3xl border border-zinc-100 rounded-2xl p-6 bg-white text-sm text-zinc-600 space-y-4">
          {content.map((paragraph, i) => (
            <p key={i}>
              {paragraph.split('support@redresumes.com').map((part, index, array) => (
                <span key={index}>
                  {part}
                  {index < array.length - 1 && (
                    <a href="mailto:support@redresumes.com" className="text-primary hover:underline">
                      support@redresumes.com
                    </a>
                  )}
                </span>
              ))}
            </p>
          ))}
        </div>
      </Section>
    </>
  );
};
