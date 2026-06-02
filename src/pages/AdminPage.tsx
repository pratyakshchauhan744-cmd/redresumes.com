import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Section } from '../components/Section';
import { backendApi, type AdminSignInActivityItem } from '../lib/backendApi';
import { getStoredAccessToken } from '../lib/auth';

const methodLabels: Record<AdminSignInActivityItem['method'], string> = {
  google: 'Google',
  email_password: 'Email / password',
  existing_session: 'Existing session',
};

export const AdminPage = () => {
  const [items, setItems] = useState<AdminSignInActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSignIns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error('Admin token missing. Please sign in again.');
      }
      const response = await backendApi.getAdminSignIns(token);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sign-in activity.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSignIns();
  }, []);

  const counts = useMemo(() => ({
    total: items.length,
    google: items.filter((item) => item.method === 'google').length,
    email: items.filter((item) => item.method === 'email_password').length,
    sessions: items.filter((item) => item.method === 'existing_session').length,
  }), [items]);

  return (
    <Section title="Sign-in activity" kicker="Admin">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Visible users', value: counts.total, icon: Users },
          { label: 'Google sign-ins', value: counts.google, icon: ShieldCheck },
          { label: 'Email sign-ins', value: counts.email, icon: ShieldCheck },
          { label: 'Existing sessions', value: counts.sessions, icon: RefreshCw },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <item.icon className="h-4 w-4 text-primary" />
              {item.label}
            </div>
            <div className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">Users who signed in</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              New logins show Google or email/password. Older active sessions appear as existing sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSignIns()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 hover:border-primary hover:text-primary dark:border-zinc-700 dark:text-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100">
                <th className="rounded-l-2xl px-4 py-3 font-extrabold">Signed in at</th>
                <th className="px-4 py-3 font-extrabold">Name</th>
                <th className="px-4 py-3 font-extrabold">Email</th>
                <th className="px-4 py-3 font-extrabold">Role</th>
                <th className="rounded-r-2xl px-4 py-3 font-extrabold">Method</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-semibold text-zinc-500">Loading sign-ins...</td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={`${item.userId}-${item.signedInAt}-${item.method}`} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="border-b border-zinc-100 px-4 py-4 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                      {new Date(item.signedInAt).toLocaleString()}
                    </td>
                    <td className="border-b border-zinc-100 px-4 py-4 font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">{item.name}</td>
                    <td className="border-b border-zinc-100 px-4 py-4 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{item.email}</td>
                    <td className="border-b border-zinc-100 px-4 py-4 capitalize text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">{item.role}</td>
                    <td className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-extrabold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {methodLabels[item.method]}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-semibold text-zinc-500">No sign-ins found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
};
