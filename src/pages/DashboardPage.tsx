import { useState, useEffect, type ChangeEvent } from 'react';
import { FileText, Clock, Settings, User, Trash2, Edit3, Save, ExternalLink, QrCode } from 'lucide-react';
import { Section } from '../components/Section';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { APPLIED_JOBS_STORAGE_KEY, LOCAL_ACCOUNTS_STORAGE_KEY, RESUME_HISTORY_STORAGE_KEY, SAVED_JOBS_STORAGE_KEY, USER_STORAGE_KEY, buildUserScopedStorageKey, getStoredAccessToken, readStoredUser } from '../lib/auth';
import { backendApi, type AuthUser } from '../lib/backendApi';
import type { LocalAccount } from '../types';
import type { Page } from '../types';
import { useNavigate } from 'react-router-dom';

export const DashboardPage = ({
  currentUser,
  onLogout,
  onUserUpdated,
}: {
  currentUser: AuthUser | null;

  onLogout: () => void;
  onUserUpdated: (user: AuthUser) => void;
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(currentUser);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(currentUser?.name ?? '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone ?? '');
  const [profileLocation, setProfileLocation] = useState(currentUser?.location ?? '');
  const [profileBio, setProfileBio] = useState(currentUser?.bio ?? '');
  const savedJobsStorageKey = buildUserScopedStorageKey(SAVED_JOBS_STORAGE_KEY, user?.id ?? currentUser?.id);
  const appliedJobsStorageKey = buildUserScopedStorageKey(APPLIED_JOBS_STORAGE_KEY, user?.id ?? currentUser?.id);
  const resumeHistoryStorageKey = buildUserScopedStorageKey(RESUME_HISTORY_STORAGE_KEY, user?.id ?? currentUser?.id);

  useEffect(() => {
    const storedUser = readStoredUser();
    const accessToken = getStoredAccessToken();

    if (storedUser) {
      setUser(storedUser);
      setProfileName(storedUser.name ?? '');
      setProfilePhone(storedUser.phone ?? '');
      setProfileLocation(storedUser.location ?? '');
      setProfileBio(storedUser.bio ?? '');
    }

    if (!accessToken || accessToken.startsWith('offline-')) {
      return;
    }

    void backendApi
      .getMe(accessToken)
      .then((me) => {
        setUser(me);
        setProfileName(me.name ?? '');
        setProfilePhone(me.phone ?? '');
        setProfileLocation(me.location ?? '');
        setProfileBio(me.bio ?? '');
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me));
        onUserUpdated(me);
      })
      .catch(() => {
        setProfileError('Showing saved profile details because the live account service is unavailable.');
      });
  }, [onUserUpdated]);

  const saveUserLocally = (updatedUser: AuthUser) => {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    try {
      const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
      const localAccounts = raw ? (JSON.parse(raw) as Array<LocalAccount & { password?: string }>) : [];
      const nextAccounts = localAccounts.map((account) => (account.id === updatedUser.id ? { ...account, ...updatedUser } : account));
      const sanitized = nextAccounts.map(({ password: _password, ...account }) => account);
      window.localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore local storage parse failures
    }
    setUser(updatedUser);
    onUserUpdated(updatedUser);
  };

  const handleProfileSave = () => {
    if (!user) return;
    const updatedUser: AuthUser = {
      ...user,
      name: profileName.trim() || user.name,
      phone: profilePhone.trim(),
      location: profileLocation.trim(),
      bio: profileBio.trim(),
    };
    saveUserLocally(updatedUser);
    setProfileMessage('Profile updated successfully.');
    setProfileError(null);
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const updatedUser: AuthUser = { ...user, photoDataUrl: reader.result };
        saveUserLocally(updatedUser);
        setProfileMessage('Profile photo updated.');
      }
    };
    reader.readAsDataURL(file);
  };


  const savedJobs = (() => {
    try {
      const raw = window.localStorage.getItem(savedJobsStorageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  })();

  const appliedJobs = (() => {
    try {
      const raw = window.localStorage.getItem(appliedJobsStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, 'applied' | 'interview'>) : {};
    } catch {
      return {};
    }
  })();

  const resumeHistory = (() => {
    try {
      const raw = window.localStorage.getItem(resumeHistoryStorageKey);
      return raw ? (JSON.parse(raw) as Array<{ id: string; savedAt: string; snapshot: { jobTitle?: string } }>) : [];
    } catch {
      return [];
    }
  })();

  const interviewCount = Object.values(appliedJobs).filter((value) => value === 'interview').length;
  const appliedCount = Object.keys(appliedJobs).length;
  const createdLabel = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Local account';

  if (!user) {
    return (
      <Section title="Your dashboard" kicker="Account">
        <div className="rounded-[30px] border border-zinc-200 bg-white p-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <h3 className="text-2xl font-bold text-zinc-900">Sign in to view your profile</h3>
          <p className="mt-3 text-zinc-500">Your account dashboard shows profile details, saved jobs, applications, and resume history.</p>
          <button onClick={() => navigate('/login')} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white">
            Go to login
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Your dashboard" kicker="Account">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff7f7_52%,#f8fafc_100%)] p-7 shadow-[0_18px_54px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {user.photoDataUrl ? (
                  <img src={user.photoDataUrl} alt="Profile" className="h-16 w-16 rounded-2xl object-cover border border-zinc-200" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-zinc-900">{user.name}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      {user.role}
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-500">
                      Joined {createdLabel}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={onLogout} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                Log out
              </button>
            </div>
            {profileError && <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">{profileError}</p>}
            {profileMessage && <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{profileMessage}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Saved jobs', value: savedJobs.length },
              { label: 'Applied', value: appliedCount },
              { label: 'Interviews', value: interviewCount },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-zinc-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="font-semibold text-zinc-900">Full user profile</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2 text-sm">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Full name</p>
                <p className="mt-2 font-semibold text-zinc-900">{user.name}</p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Email</p>
                <p className="mt-2 font-semibold text-zinc-900 break-all">{user.email}</p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Role</p>
                <p className="mt-2 font-semibold text-zinc-900 capitalize">{user.role}</p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Account status</p>
                <p className="mt-2 font-semibold text-emerald-700">Active</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm" placeholder="Full name" />
              <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm" placeholder="Phone number" />
              <input value={profileLocation} onChange={(event) => setProfileLocation(event.target.value)} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm md:col-span-2" placeholder="Location" />
              <textarea value={profileBio} onChange={(event) => setProfileBio(event.target.value)} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm md:col-span-2 h-28" placeholder="Short profile bio" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="max-w-xs rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
              <button onClick={handleProfileSave} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
                Save profile
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Resume history</h3>
              <button onClick={() => navigate('/builder')} className="text-sm font-semibold text-primary">Open builder</button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {resumeHistory.length === 0 ? (
                <p className="text-zinc-500">No saved resume versions yet.</p>
              ) : (
                resumeHistory.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3">
                    <span className="text-zinc-700">{entry.snapshot.jobTitle || 'Untitled resume'}</span>
                    <span className="text-xs text-zinc-400">{new Date(entry.savedAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="font-semibold text-zinc-900">Quick actions</h3>
            <div className="mt-4 grid gap-3">
              <button onClick={() => navigate('/builder')} className="rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                Create or edit resume
              </button>
              <button onClick={() => navigate('/job-finder')} className="rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                Browse jobs and apply
              </button>
              <button onClick={() => navigate('/cover-letter')} className="rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-semibold text-zinc-700 hover:border-zinc-400">
                Generate cover letter
              </button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};
