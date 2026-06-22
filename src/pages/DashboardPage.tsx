import { useState, useEffect, type ChangeEvent } from 'react';
import { FileText, Clock, Settings, User, Trash2, Edit3, Save, ExternalLink, QrCode } from 'lucide-react';
import { Section } from '../components/Section';
import { Seo } from '../components/Seo';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { APPLIED_JOBS_STORAGE_KEY, LOCAL_ACCOUNTS_STORAGE_KEY, RESUME_HISTORY_STORAGE_KEY, SAVED_JOBS_STORAGE_KEY, USER_STORAGE_KEY, buildUserScopedStorageKey, getStoredAccessToken, isLocalAccessToken, readStoredUser } from '../lib/auth';
import { backendApi, type AuthUser } from '../lib/backendApi';
import type { LocalAccount } from '../types';
import type { Page } from '../types';
import { useNavigate } from 'react-router-dom';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const sanitizeProfilePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 10);

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
  const [profilePhone, setProfilePhone] = useState(sanitizeProfilePhone(currentUser?.phone ?? ''));
  const [profileLocation, setProfileLocation] = useState(currentUser?.location ?? '');
  const [profileBio, setProfileBio] = useState(currentUser?.bio ?? '');
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [creditsBalance, setCreditsBalance] = useState<number>(currentUser?.credits ?? 0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [devAmount, setDevAmount] = useState<number>(5);

  const savedJobsStorageKey = buildUserScopedStorageKey(SAVED_JOBS_STORAGE_KEY, user?.id ?? currentUser?.id);
  const appliedJobsStorageKey = buildUserScopedStorageKey(APPLIED_JOBS_STORAGE_KEY, user?.id ?? currentUser?.id);
  const resumeHistoryStorageKey = buildUserScopedStorageKey(RESUME_HISTORY_STORAGE_KEY, user?.id ?? currentUser?.id);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true' || params.get('mock_success') === 'true') {
      setProfileMessage('Payment successful! Your account has been credited.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('payment_cancelled') === 'true') {
      setProfileError('Payment was cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleBuyCredits = async (packageKey: string) => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setPurchaseError("Please log in to purchase credits.");
      return;
    }

    setPurchaseLoading(packageKey);
    setPurchaseError(null);

    try {
      const res = await backendApi.createCreditCheckoutSession(packageKey, accessToken);
      
      // Handle mock dev bypass or redirect URL if provided
      if (res.url) {
        window.location.href = res.url;
        return;
      }

      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const options = {
        key: res.keyId,
        amount: res.amount,
        currency: res.currency,
        name: res.productName,
        description: res.productDescription,
        order_id: res.orderId,
        handler: async function (response: any) {
          setPurchaseLoading(packageKey);
          setProfileMessage("Verifying payment...");
          try {
            const verifyResult = await backendApi.verifyCreditPayment({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              packageKey
            }, accessToken);

            setCreditsBalance(verifyResult.balance);
            if (user) {
              const updatedUser = { ...user, credits: verifyResult.balance };
              saveUserLocally(updatedUser);
            }

            // Refresh transactions list
            try {
              const data = await backendApi.getCreditTransactions(accessToken);
              setTransactions(data.transactions || []);
            } catch (txErr) {
              console.error("Failed to refresh transactions log:", txErr);
            }

            setProfileMessage("Payment successful! Your credits have been updated.");
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            setPurchaseError(err.message || "Payment verification failed. Please contact support.");
          } finally {
            setPurchaseLoading(null);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: "#e11d48", // matches the theme rose-600
        },
        modal: {
          ondismiss: function () {
            setPurchaseLoading(null);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || "An error occurred initiating checkout.");
      setPurchaseError(err.message || "An error occurred initiating checkout.");
      setPurchaseLoading(null);
    }
  };

  const handleDevAddCredits = async () => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) return;

    try {
      const res = await backendApi.devAddCredits(devAmount, accessToken);
      setCreditsBalance(res.balance);
      
      if (user) {
        const updatedUser = { ...user, credits: res.balance };
        saveUserLocally(updatedUser);
      }

      // Refresh transactions
      const data = await backendApi.getCreditTransactions(accessToken);
      setTransactions(data.transactions || []);
      setProfileMessage(`Successfully added ${devAmount} dev credits.`);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    const storedUser = readStoredUser();
    const accessToken = getStoredAccessToken();

    if (storedUser) {
      setUser(storedUser);
      setProfileName(storedUser.name ?? '');
      setProfilePhone(sanitizeProfilePhone(storedUser.phone ?? ''));
      setProfileLocation(storedUser.location ?? '');
      setProfileBio(storedUser.bio ?? '');
    }

    if (!accessToken || isLocalAccessToken(accessToken)) {
      return;
    }

    void backendApi
      .getMe(accessToken)
      .then((me) => {
        const stored = readStoredUser();
        const mergedUser = {
          ...stored,
          ...me,
          // Preserve local-only fields if they are missing/empty in me and IDs match
          phone: (stored && stored.id === me.id) ? (me.phone || stored.phone || '') : (me.phone || ''),
          location: (stored && stored.id === me.id) ? (me.location || stored.location || '') : (me.location || ''),
          bio: (stored && stored.id === me.id) ? (me.bio || stored.bio || '') : (me.bio || ''),
          photoDataUrl: (stored && stored.id === me.id) ? (me.photoDataUrl || stored.photoDataUrl || '') : (me.photoDataUrl || ''),
        };
        setUser(mergedUser);
        setProfileName(mergedUser.name ?? '');
        setProfilePhone(sanitizeProfilePhone(mergedUser.phone ?? ''));
        setProfileLocation(mergedUser.location ?? '');
        setProfileBio(mergedUser.bio ?? '');
        if (typeof mergedUser.credits === 'number') {
          setCreditsBalance(mergedUser.credits);
        }
        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mergedUser));
        onUserUpdated(mergedUser);
      })
      .catch(() => {
        setProfileError('Showing saved profile details because the live account service is unavailable.');
      });
      
    // Fetch interview history
    backendApi.getInterviewHistory(accessToken)
      .then(data => {
        if (Array.isArray(data)) {
          setInterviewHistory(data);
        }
      })
      .catch(console.error);

    // Fetch credit balance & transactions
    backendApi.getCreditTransactions(accessToken)
      .then(data => {
        setCreditsBalance(data.balance);
        setTransactions(data.transactions || []);
      })
      .catch(console.error);
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
    
    const phoneTrimmed = sanitizeProfilePhone(profilePhone);
    if (phoneTrimmed !== '') {
      if (phoneTrimmed.length !== 10) {
        setProfileError('Please enter exactly 10 digits for the phone number.');
        setProfileMessage(null);
        return;
      }
    }

    const updatedUser: AuthUser = {
      ...user,
      name: profileName.trim() || user.name,
      phone: phoneTrimmed,
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
      <>
        <Seo
          title="Dashboard | Manage Your Resumes | Red Resumes"
          description="Access your saved resumes, draft cover letters, job tracking boards, and AI mock interview history in your account dashboard."
        />
        <Section h1 title="Your dashboard" kicker="Account">
          <div className="rounded-[30px] border border-zinc-200 bg-white p-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-bold text-zinc-900">Sign in to view your profile</h2>
            <p className="mt-3 text-zinc-500">Your account dashboard shows profile details, saved jobs, applications, and resume history.</p>
            <button onClick={() => navigate('/login')} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white">
              Go to login
            </button>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <Seo
        title="Dashboard | Manage Your Resumes | Red Resumes"
        description="Access your saved resumes, draft cover letters, job tracking boards, and AI mock interview history in your account dashboard."
      />
      <Section h1 title="Your dashboard" kicker="Account">
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
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900">{user.name}</h2>
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

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Saved jobs', value: savedJobs.length },
              { label: 'Applied', value: appliedCount },
              { label: 'Interviews', value: interviewCount },
              { label: 'Credits Remaining', value: creditsBalance },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
                <p className="mt-3 text-3xl font-black tracking-tight text-zinc-900">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Billing & Credits Manager Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-150 pb-4 mb-4">
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">Interview Credits</h2>
                <p className="text-sm text-zinc-500 mt-0.5">Use credits to run interactive AI mock interviews. 1 Interview = 1 Credit.</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-right">
                <span className="text-xs text-zinc-450 font-bold uppercase tracking-wider block">Remaining Balance</span>
                <span className="text-2xl font-black text-primary">{creditsBalance} Credits</span>
              </div>
            </div>

            {purchaseError && (
              <p className="mb-4 rounded-xl border border-red-250 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{purchaseError}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              {/* Starter Pack */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 flex flex-col justify-between hover:border-primary/20 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[50px] -z-10" />
                <div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Starter Pack</span>
                  <h3 className="text-2xl font-black text-zinc-950 mt-1">5 Credits</h3>
                  <p className="text-xs text-zinc-500 mt-2">Practice up to 5 complete rounds with AI feedback.</p>
                </div>
                <button
                  disabled={purchaseLoading !== null}
                  onClick={() => handleBuyCredits('starter')}
                  className="mt-6 w-full rounded-xl bg-zinc-905 hover:bg-zinc-800 text-white font-bold py-2.5 text-sm transition-all disabled:opacity-50"
                >
                  {purchaseLoading === 'starter' ? 'Loading...' : 'Buy for ₹499'}
                </button>
              </div>

              {/* Pro Pack */}
              <div className="rounded-xl border-2 border-primary bg-white p-5 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                  Popular
                </div>
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">Pro Pack</span>
                  <h3 className="text-2xl font-black text-zinc-950 mt-1">15 Credits</h3>
                  <p className="text-xs text-zinc-500 mt-2">Practice 15 complete rounds. Best value for active job hunters.</p>
                </div>
                <button
                  disabled={purchaseLoading !== null}
                  onClick={() => handleBuyCredits('pro')}
                  className="mt-6 w-full rounded-xl bg-primary hover:bg-primary-container text-white font-bold py-2.5 text-sm transition-all disabled:opacity-50"
                >
                  {purchaseLoading === 'pro' ? 'Loading...' : 'Buy for ₹999'}
                </button>
              </div>
            </div>


            {/* Transaction Log */}
            {transactions.length > 0 && (
              <div className="border-t border-zinc-100 pt-6 mt-6">
                <h3 className="font-bold text-zinc-900 text-sm mb-3">Billing History</h3>
                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg text-xs border border-zinc-100">
                      <div>
                        <p className="font-bold text-zinc-800">{tx.packageName}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(tx.createdAt).toLocaleDateString()} • Ref: {tx.razorpayPaymentId ? tx.razorpayPaymentId.slice(0, 15) : ''}...</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-600">+{tx.creditsAdded} Credits</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">₹{tx.paymentAmount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-900">Full user profile</h2>
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
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                value={profilePhone}
                onChange={(event) => setProfilePhone(sanitizeProfilePhone(event.target.value))}
                className="rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                placeholder="Phone number"
                aria-label="Profile phone number"
              />
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
              <h2 className="font-semibold text-zinc-900">AI Mock Interviews</h2>
              <button onClick={() => navigate('/interview/setup')} className="text-sm font-semibold text-primary hover:underline">Practice now</button>
            </div>
            <div className="mt-4 space-y-3">
              {interviewHistory.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                  <p className="text-sm text-zinc-500 mb-3">No completed interviews yet.</p>
                  <button onClick={() => navigate('/interview/setup')} className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-lg text-sm shadow-sm transition-all hover:scale-105">
                    Start Your First Interview
                  </button>
                </div>
              ) : (
                interviewHistory.slice(0, 5).map((session: any) => (
                  <div key={session.id} onClick={() => navigate(`/interview/report/${session.id}`)} className="flex items-center justify-between rounded-xl border border-zinc-100 hover:border-primary/30 hover:bg-primary/5 cursor-pointer px-4 py-3 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{session.targetRole}</p>
                      <p className="text-xs text-zinc-500">{new Date(session.createdAt).toLocaleDateString()} • {session.companyType}</p>
                    </div>
                    {session.report && (
                      <div className="text-right">
                        <span className={`text-sm font-bold ${session.report.overallScore >= 8 ? 'text-green-600' : session.report.overallScore >= 6 ? 'text-amber-600' : 'text-red-600'}`}>
                          {session.report.overallScore.toFixed(1)}/10
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
    </>
  );
};
