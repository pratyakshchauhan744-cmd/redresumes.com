import { Section } from '../components/Section';
import { resumeExamplePresets } from '../data/resumeExamples';
import { useNavigate } from 'react-router-dom';

export const ExamplesPage = ({ onViewExample }: { onViewExample: (role: string) => void }) => {
  const navigate = useNavigate();

  return (
    <Section title="Resume examples" kicker="Examples">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          'Software Engineer',
          'Digital Marketer',
          'Sales Manager',
          'Graphic Designer',
          'HR Executive',
          'Accountant',
          'Data Analyst',
          'Teacher',
          'Nurse',
          'Fresher / Internship',
          'Senior-level',
          'Executive',
        ].map((role) => (
          <div key={role} className="border border-zinc-100 rounded-2xl p-6 bg-white hover:shadow-sm transition-shadow">
            <div className="space-y-3">
              <h3 className="font-semibold text-zinc-900">{role}</h3>
              <p className="text-sm text-zinc-500">Editable example with ATS tips.</p>
              <button
                onClick={() => {
                  onViewExample(role);
                  navigate('/builder');
                }}
                className="text-sm font-semibold text-primary"
              >
                View example
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};
