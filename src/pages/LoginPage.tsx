import { useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { backendApi, type AuthUser } from '../lib/backendApi';
import { LOCAL_ACCOUNTS_STORAGE_KEY, setStoredAuthTokens, USER_STORAGE_KEY } from '../lib/auth';
import type { LocalAccount } from '../types';

export const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'candidate' | 'employer' | 'admin'>('candidate');
  const [acceptedAccessTerms, setAcceptedAccessTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [backendOtpSessionId, setBackendOtpSessionId] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'otp' | 'new-password'>('email');
  const DEMO_EMAILS = ['candidate@example.com', 'employer@example.com', 'admin@example.com'] as const;
  const getFriendlyLoginError = (attemptedEmail: string) => {
    const normalized = attemptedEmail.trim().toLowerCase();
    if (DEMO_EMAILS.includes(normalized as (typeof DEMO_EMAILS)[number])) {
      return 'Demo account password is incorrect. Use Password@123.';
    }
    return 'Invalid email or password. If this is your first time, create account first.';
  };

  const getFriendlyRegisterError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('email already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (
      lower.includes('can\'t reach database server') ||
      lower.includes('cant reach database server') ||
      lower.includes('postgres:5432') ||
      lower.includes('cannot reach backend')
    ) {
      return 'Backend signup is unavailable right now, so your account will be created in local mode on this browser.';
    }
    return message;
  };

  const getSafeAuthError = (message: string) => {
    const lower = message.toLowerCase();
    if (
      lower.includes("prisma.") ||
      lower.includes("findunique") ||
      lower.includes("can't reach database server") ||
      lower.includes("cant reach database server") ||
      lower.includes("postgres:5432") ||
      lower.includes("/users/") ||
      lower.includes("invocation in")
    ) {
      return "Login service is temporarily unavailable. Please try again in a few minutes.";
    }
    if (lower.includes("cannot reach backend")) {
      return "Cannot reach backend right now. Please check server connection and try again.";
    }
    return message || "Unable to sign in right now. Please try again.";
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());

  const readLocalAccounts = (): LocalAccount[] => {
    try {
      const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<LocalAccount & { password?: string }>;
      return parsed.map(({ password: _password, ...account }) => account);
    } catch {
      return [];
    }
  };

  const writeLocalAccounts = (accounts: LocalAccount[]) => {
    const sanitized = accounts.map(({ ...account }) => account);
    window.localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(sanitized));
  };

  const persistSignedInUser = (user: AuthUser, accessToken: string) => {
    setStoredAuthTokens(accessToken);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  };

  const signIn = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    if (!acceptedAccessTerms) {
      setError('Please confirm the customer access terms before signing in.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await backendApi.login({ email: email.trim(), password });
      persistSignedInUser(response.user, response.accessToken);
      onLoginSuccess(response.user);
    } catch (signInError) {
      const message = signInError instanceof Error ? signInError.message : "";
      setError(message.toLowerCase().includes("invalid credentials") ? getFriendlyLoginError(email) : getSafeAuthError(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySignupOtp = async () => {
    setError(null);
    if (!backendOtpSessionId) {
      setError('OTP session expired. Please create account again.');
      setSignupStep('form');
      return;
    }
    try {
      const response = await backendApi.verifyRegisterOtp({ sessionId: backendOtpSessionId, otp: enteredOtp.trim() });
      persistSignedInUser(response.user, response.accessToken);
      onLoginSuccess(response.user);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Invalid OTP. Please try again.');
      return;
    }
  };

  const startForgotPassword = async () => {
    setError(null);
    setSuccessMessage(null);
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await backendApi.startForgotPasswordOtp({ email: email.trim() });
      setBackendOtpSessionId(response.sessionId);
      setEnteredOtp('');
      setOtpMessage(response.message || `OTP sent to ${email.trim()}.`);
      setForgotPasswordStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyForgotPassword = async () => {
    setError(null);
    if (enteredOtp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    if (!backendOtpSessionId) {
      setError('Session expired. Please request OTP again.');
      return;
    }
    setIsSubmitting(true);
    try {
      await backendApi.verifyForgotPasswordOtp({ sessionId: backendOtpSessionId, otp: enteredOtp.trim() });
      setOtpMessage('OTP verified. Please enter your new password.');
      setForgotPasswordStep('new-password');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const doResetPassword = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!backendOtpSessionId) {
      setError('Session expired. Please request OTP again.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await backendApi.resetPassword({ sessionId: backendOtpSessionId, password });
      setSuccessMessage(response.message || 'Password reset successful. You can now log in.');
      setAuthMode('login');
      setForgotPasswordStep('email');
      setBackendOtpSessionId(null);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signUp = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!acceptedAccessTerms) {
      setError('Please confirm the customer access terms before creating an account.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await backendApi.startRegisterOtp({
        name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      setBackendOtpSessionId(response.sessionId);
      setEnteredOtp('');
      setOtpMessage(`OTP sent to ${email.trim()}. Please verify to complete account creation.`);
      setSignupStep('otp');
    } catch (signUpError) {
      const accounts = readLocalAccounts();
      const alreadyExists = accounts.some((account) => account.email.toLowerCase() === email.trim().toLowerCase());

      if (alreadyExists) {
        setError('An account with this email already exists in local mode. Try signing in instead.');
        setIsSubmitting(false);
        return;
      }
      setError(getFriendlyRegisterError(signUpError instanceof Error ? signUpError.message : 'Unable to create account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1.05fr_0.95fr] gap-10 items-stretch">
        <div className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff9f9_50%,#f8fafc_100%)] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Account Access</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: 'login', label: 'Sign in' },
              { id: 'signup', label: 'Create account' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAuthMode(item.id as 'login' | 'signup');
                  setError(null);
                  setSuccessMessage(null);
                  setSignupStep('form');
                  setBackendOtpSessionId(null);
                  setEnteredOtp('');
                  setOtpMessage(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  authMode === item.id
                    ? 'bg-primary text-white shadow-[0_10px_22px_rgba(177,18,23,0.22)]'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-zinc-900">
            {authMode === 'signup' && signupStep === 'otp' ? 'Verify OTP' : authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-3 max-w-md text-base leading-7 text-zinc-500">
            {authMode === 'signup' && signupStep === 'otp'
              ? 'Enter the 6-digit OTP sent to your email to verify your account.'
              : authMode === 'login'
                ? 'Sign in to access your resumes, cover letters, saved jobs, and application tracker.'
                : 'Sign up to save resume versions, manage applications, and build your full profile in one place.'}
          </p>

          {authMode === 'login' && (
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Test Credentials</p>
              <p className="mt-1 text-xs text-zinc-400">Password for all: Password@123</p>
              <p className="mt-2 text-xs text-zinc-500">Emails: candidate@example.com, employer@example.com, admin@example.com</p>
              <p className="mt-1 text-xs text-zinc-400">For your own email, use Create account first, then Sign in.</p>
            </div>
          )}

          <div className="mt-8 space-y-4">
            {authMode === 'signup' && signupStep === 'otp' && (
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Enter OTP</label>
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="6-digit OTP"
                  value={enteredOtp}
                  onChange={(event) => setEnteredOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {otpMessage && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{otpMessage}</p>}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={verifySignupOtp}
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Verify OTP
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (backendOtpSessionId) {
                        try {
                          const response = await backendApi.startRegisterOtp({
                            name: fullName.trim(),
                            email: email.trim(),
                            password,
                            role,
                          });
                          setBackendOtpSessionId(response.sessionId);
                          setOtpMessage(`OTP re-sent to ${email.trim()}. Please check your email inbox.`);
                        } catch (resendError) {
                          setError(resendError instanceof Error ? resendError.message : 'Unable to resend OTP.');
                        }
                        return;
                      }
                      setError('Please go back and create account again to request a new OTP.');
                    }}
                    className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep('form');
                      setBackendOtpSessionId(null);
                      setEnteredOtp('');
                      setOtpMessage(null);
                    }}
                    className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 hover:border-zinc-500"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
            {!(authMode === 'signup' && signupStep === 'otp') && authMode !== 'forgot-password' && (
              <>
            {authMode === 'signup' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Full name</label>
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-700">Email</label>
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isSubmitting) {
                    void signIn();
                  }
                }}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-zinc-700">Password</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot-password');
                      setForgotPasswordStep('email');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-semibold text-primary hover:text-red-700 transition"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isSubmitting) {
                      void signIn();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 inline-flex items-center text-zinc-500 hover:text-zinc-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {authMode === 'signup' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Confirm password</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Re-enter your password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute inset-y-0 right-3 inline-flex items-center text-zinc-500 hover:text-zinc-900"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Account type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'candidate', label: 'Candidate' },
                      { id: 'employer', label: 'Employer' },
                      { id: 'admin', label: 'Admin' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRole(item.id as 'candidate' | 'employer' | 'admin')}
                        className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                          role === item.id ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 bg-white text-zinc-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
              </>
            )}
            {!(authMode === 'signup' && signupStep === 'otp') && authMode !== 'forgot-password' && (
              <>
                <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    checked={acceptedAccessTerms}
                    onChange={(event) => setAcceptedAccessTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                  />
                  <span>
                    I confirm that I am a genuine customer or authorized user, and I agree to use this account truthfully and in line with platform terms and acceptable use requirements.
                  </span>
                </label>
                <p className="text-xs leading-6 text-zinc-400">
                  Only genuine customers and authorized users may access RedResumes accounts. Misuse, impersonation, or unauthorized access is not allowed.
                </p>
              </>
            )}
            {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
            {successMessage && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</p>}
            {!(authMode === 'signup' && signupStep === 'otp') && authMode !== 'forgot-password' && (
              <button
                onClick={authMode === 'login' ? signIn : signUp}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-[0_16px_36px_rgba(177,18,23,0.24)] transition hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? (authMode === 'login' ? 'Signing in...' : 'Creating account...') : authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            )}

            {authMode === 'forgot-password' && (
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
                {forgotPasswordStep === 'email' && (
                  <>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Account Email</label>
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={startForgotPassword}
                        disabled={isSubmitting}
                        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
                {forgotPasswordStep === 'otp' && (
                  <>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Enter OTP</label>
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="6-digit OTP"
                      value={enteredOtp}
                      onChange={(event) => setEnteredOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    {otpMessage && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{otpMessage}</p>}
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={verifyForgotPassword}
                        disabled={isSubmitting}
                        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {isSubmitting ? 'Verifying...' : 'Verify OTP'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordStep('email')}
                        className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500"
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}
                {forgotPasswordStep === 'new-password' && (
                  <>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">New Password</label>
                    <div className="relative mb-4">
                      <input
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        placeholder="Enter your new password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-3 inline-flex items-center text-zinc-500 hover:text-zinc-900"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Confirm New Password</label>
                    <div className="relative mb-4">
                      <input
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                        placeholder="Re-enter your new password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute inset-y-0 right-3 inline-flex items-center text-zinc-500 hover:text-zinc-900"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={doResetPassword}
                        disabled={isSubmitting}
                        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {isSubmitting ? 'Resetting password...' : 'Reset Password'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-[32px] border border-zinc-200 bg-zinc-50 p-8 shadow-[0_16px_44px_rgba(15,23,42,0.05)] md:p-10">
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900">Why professionals choose RedResumes</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Everything stays focused on clarity, speed, and recruiter-friendly presentation.</p>
          <div className="mt-6 space-y-4">
            {[
              { title: 'ATS-friendly templates', desc: 'Clean layouts that stay readable and parser-safe.' },
              { title: 'AI writing suggestions', desc: 'Sharper summaries and bullets for stronger applications.' },
              { title: 'Saved versions and job tracking', desc: 'Keep multiple resume versions and manage applications in one place.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900">{item.title}</h4>
                    <p className="mt-1 text-sm text-zinc-500">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff4f4_100%)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Quick Access</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { value: 'ATS', label: 'Resume checks' },
                { value: 'PDF', label: 'Exports' },
                { value: 'Jobs', label: 'Apply faster' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white px-3 py-4 text-center">
                  <div className="text-lg font-black tracking-tight text-zinc-900">{item.value}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
