import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { backendApi, type AuthUser } from '../lib/backendApi';
import { LOCAL_ACCOUNTS_STORAGE_KEY, setStoredAuthTokens, USER_STORAGE_KEY } from '../lib/auth';
import type { LocalAccount } from '../types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

export const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'candidate' | 'employer' | 'admin'>('candidate');
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
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const DEMO_EMAILS = ['candidate@example.com', 'employer@example.com', 'admin@example.com'] as const;
  const getFriendlyLoginError = (attemptedEmail: string) => {
    const normalized = attemptedEmail.trim().toLowerCase();
    if (DEMO_EMAILS.includes(normalized as (typeof DEMO_EMAILS)[number])) {
      return 'Demo account password is incorrect. Use Password@123.';
    }
    return 'Invalid email or password. If this is your first time, create account first.';
  };

  const getFriendlyRegisterError = (message: string) => {
    const raw = message || '';
    const lower = raw.toLowerCase();
    if (
      lower.includes('request failed') ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('network error') ||
      lower.includes('cannot reach backend')
    ) {
      return 'Cannot reach signup service right now. Please check server connection and try again.';
    }
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
    return raw || 'Unable to create account right now. Please try again.';
  };

  const getSafeAuthError = (message: string) => {
    const lower = message.toLowerCase();
    if (
      lower.includes("unable to complete request") ||
      lower.includes("check your input") ||
      lower.includes("bad request")
    ) {
      return "Sign-in could not be completed. Refresh the page and try again.";
    }
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

  const getGoogleAuthError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("google login is not configured")) {
      return "Google login is not configured yet. Please contact support or use email sign-in.";
    }
    if (lower.includes("oauth client mismatch")) {
      return "Google sign-in is misconfigured on the server. Please contact support or use email sign-in.";
    }
    if (
      lower.includes("could not be verified") ||
      lower.includes("wrong number of segments") ||
      lower.includes("malformed") ||
      lower.includes("unreadable")
    ) {
      return message || "Google sign-in could not be verified. Refresh this page and try again.";
    }
    if (
      lower.includes("unable to complete request") ||
      lower.includes("check your input")
    ) {
      return "Google sign-in could not be completed. Refresh this page and try again.";
    }
    return getSafeAuthError(message || "Google sign-in failed.");
  };

  const getFriendlyOtpError = (message: string, fallback: string) => {
    const raw = message || "";
    const lower = raw.toLowerCase();
    if (
      lower.includes("request failed") ||
      lower.includes("failed to fetch") ||
      lower.includes("networkerror") ||
      lower.includes("network error") ||
      lower.includes("cannot reach backend")
    ) {
      return "Cannot reach OTP service right now. Please check server connection and try again.";
    }
    if (lower.includes("invalid otp")) {
      return "Invalid OTP. Please check and try again.";
    }
    if (lower.includes("expired")) {
      return "OTP expired. Please request a new OTP.";
    }
    if (
      lower.includes("unable to complete request") ||
      lower.includes("bad request") ||
      lower.includes("validation failed") ||
      lower.includes("check your input")
    ) {
      return fallback;
    }
    return raw || fallback;
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

  const handleGoogleCredential = async (credential?: string) => {
    setError(null);
    setSuccessMessage(null);

    if (!credential) {
      setError('Google did not return a login credential. Please try again.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await backendApi.googleLogin({ credential });
      persistSignedInUser(response.user, response.accessToken);
      onLoginSuccess(response.user);
    } catch (googleError) {
      setError(getGoogleAuthError(googleError instanceof Error ? googleError.message : 'Google sign-in failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const renderGoogleButton = () => {
      const container = googleButtonRef.current;
      const googleId = window.google?.accounts?.id;
      if (!container || !googleId) return;

      container.innerHTML = '';
      googleId.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void handleGoogleCredential(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleId.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: authMode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'pill',
        width: Math.min(container.clientWidth || 360, 400),
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    const script = existingScript ?? document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    if (!existingScript) {
      document.head.appendChild(script);
    }
  }, [authMode, googleClientId]);

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
      setError(getFriendlyOtpError(verifyError instanceof Error ? verifyError.message : "", "Invalid OTP. Please try again."));
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
      setOtpMessage(response.devOtp ? response.message : response.message || `OTP sent to ${email.trim()}.`);
      setForgotPasswordStep('otp');
    } catch (err) {
      setError(getFriendlyOtpError(err instanceof Error ? err.message : "", "Unable to send a reset OTP for this email. Check the address and try again."));
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
      setError(getFriendlyOtpError(err instanceof Error ? err.message : "", "Invalid OTP. Please try again."));
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
      setError(getFriendlyOtpError(err instanceof Error ? err.message : "", "Unable to reset password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const authTitle =
    authMode === 'forgot-password'
      ? forgotPasswordStep === 'email'
        ? 'Reset your password'
        : forgotPasswordStep === 'otp'
          ? 'Verify reset OTP'
          : 'Create new password'
      : authMode === 'signup' && signupStep === 'otp'
        ? 'Verify OTP'
        : authMode === 'login'
          ? 'Welcome back'
          : 'Create your account';

  const authDescription =
    authMode === 'forgot-password'
      ? forgotPasswordStep === 'email'
        ? 'Enter your account email and we will send a one-time password to reset your login.'
        : forgotPasswordStep === 'otp'
          ? 'Enter the 6-digit OTP sent to your email to continue resetting your password.'
          : 'Choose a new password for your RedResumes account.'
      : authMode === 'signup' && signupStep === 'otp'
        ? 'Enter the 6-digit OTP sent to your email to verify your account.'
        : authMode === 'login'
          ? 'Sign in to access your resumes, cover letters, saved jobs, and application tracker.'
          : 'Sign up to save resume versions, manage applications, and build your full profile in one place.';

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
      const response = await backendApi.register({
        name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      persistSignedInUser(response.user, response.accessToken);
      onLoginSuccess(response.user);
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
    <section className="py-10 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:items-stretch">
        <div className="rounded-2xl border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff9f9_50%,#f8fafc_100%)] p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)] md:rounded-[32px] md:p-10 md:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary md:text-xs md:tracking-[0.24em]">Account Access</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:mt-4">
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
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-zinc-900 md:mt-5 md:text-4xl">
            {authTitle}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500 md:text-base md:leading-7">
            {authDescription}
          </p>



          <div className="mt-6 space-y-4 md:mt-8">
            {authMode !== 'forgot-password' && !(authMode === 'signup' && signupStep === 'otp') && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                {googleClientId ? (
                  <div ref={googleButtonRef} className="flex min-h-11 justify-center" />
                ) : (
                  <p className="text-sm text-zinc-500">Google login is not configured yet.</p>
                )}
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-zinc-200" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">or</span>
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              </div>
            )}
            {authMode === 'signup' && signupStep === 'otp' && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:rounded-3xl md:p-6">
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
                          setOtpMessage(response.devOtp ? response.message : `OTP re-sent to ${email.trim()}. Please check your email inbox.`);
                        } catch (resendError) {
                          setError(getFriendlyOtpError(resendError instanceof Error ? resendError.message : "", "Unable to resend OTP."));
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
                    void (authMode === 'login' ? signIn() : signUp());
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
                      void (authMode === 'login' ? signIn() : signUp());
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
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'candidate', label: 'Candidate' },
                      { id: 'employer', label: 'Employer' },
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
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:rounded-3xl md:p-6">
                {forgotPasswordStep === 'email' && (
                  <>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Account Email</label>
                    <input
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <div className="mt-4 grid gap-3 sm:flex">
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
                        onClick={() => {
                          setAuthMode('login');
                          setError(null);
                          setSuccessMessage(null);
                          setOtpMessage(null);
                        }}
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
                    <div className="mt-4 grid gap-3 sm:flex">
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
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:rounded-[32px] md:p-10 md:shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 md:text-2xl">Why professionals choose RedResumes</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Everything stays focused on clarity, speed, and recruiter-friendly presentation.</p>
          <div className="mt-4 space-y-3 md:mt-6 md:space-y-4">
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
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-[linear-gradient(145deg,#ffffff_0%,#fff4f4_100%)] p-4 md:mt-6 md:p-5">
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
