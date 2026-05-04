import { Users, Layout, CreditCard, BookOpen, FileText, TrendingUp, LifeBuoy, Mail } from 'lucide-react';
import { Section } from '../components/Section';
import { TicketIcon } from '../components/TicketIcon';

export const AdminPage = () => (
  <Section title="Admin panel" kicker="Admin">
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {
        [
          { label: 'User management', icon: Users },
          { label: 'Template management', icon: Layout },
          { label: 'Subscription management', icon: CreditCard },
          { label: 'Coupon codes', icon: TicketIcon },
          { label: 'Blog management', icon: BookOpen },
          { label: 'Resume examples', icon: FileText },
          { label: 'Analytics dashboard', icon: TrendingUp },
          { label: 'Support tickets', icon: LifeBuoy },
          { label: 'Email automation', icon: Mail },
          { label: 'Referral system', icon: Users },
        ]
      .map((item) => (
        <div key={item.label} className="border border-zinc-100 rounded-2xl p-6 bg-white flex items-center gap-3">
          <item.icon className="w-5 h-5 text-primary" />
          <span className="font-semibold text-zinc-900">{item.label}</span>
        </div>
      ))}
    </div>
  </Section>
);

