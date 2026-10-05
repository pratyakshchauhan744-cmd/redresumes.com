import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { backendApi, type AuthUser } from "../lib/backendApi";
import { setStoredAuthTokens, USER_STORAGE_KEY } from "../lib/auth";
import {
  classifyInvitationFailure,
  validateInvitationPasswords,
  type InvitationFailureState,
} from "../utils/invitationActivation";

export function SetupPasswordPage({
  onLoginSuccess,
  invitationToken,
}: {
  onLoginSuccess: (user: AuthUser) => void;
  invitationToken?: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = invitationToken || searchParams.get("token") || "";
  const [invitation, setInvitation] = useState<{
    email: string;
    role: string;
    collegeName: string;
    metadata?: { name?: string; enrollmentNumber?: string };
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureState, setFailureState] = useState<InvitationFailureState | null>(null);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setInvitation(null);
    setFailureState(null);
    setError(null);
    if (!token) {
      setError("This password setup link is invalid or incomplete.");
      setFailureState("invalid");
      setLoading(false);
      return () => { active = false; };
    }

    backendApi.enterprise.verifyInvitation(token)
      .then((response) => {
        if (active) setInvitation(response.invitation);
      })
      .catch((verifyError) => {
        if (active) {
          const message = verifyError instanceof Error ? verifyError.message : "This invitation link is invalid.";
          setFailureState(classifyInvitationFailure(message));
          setError(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    setError(null);
    const validationError = validateInvitationPasswords(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    submissionInFlightRef.current = true;
    setSubmitting(true);
    try {
      const response = await backendApi.enterprise.acceptInvitation({ tokenHash: token, password });
      setStoredAuthTokens(response.accessToken);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      onLoginSuccess(response.user);
      navigate(response.user.role === "student" ? "/dashboard" : "/enterprise", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to set your password.";
      const state = classifyInvitationFailure(message);
      if (state !== "network") {
        setInvitation(null);
        setFailureState(state);
      }
      setError(message);
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title="Set Up Password | Red Resumes" description="Securely choose a password for your RedResumes account." />
      <section className="min-h-[75vh] bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            {invitation?.role?.includes("faculty") ? "Activate your faculty account" : "Choose a new password"}
          </h1>
          {loading ? (
            <p className="mt-4 text-sm text-zinc-500">Validating your secure setup link…</p>
          ) : invitation ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="font-semibold text-zinc-900 dark:text-white">{invitation.metadata?.name || invitation.email}</p>
                <p className="mt-1 text-zinc-500">{invitation.email}</p>
                <p className="mt-1 text-zinc-500">{invitation.collegeName}</p>
              </div>
              <div>
                <label htmlFor="setup-password" className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">New password</label>
                <div className="relative">
                  <input
                    id="setup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-zinc-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-3.5 text-zinc-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="setup-confirm-password" className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">Confirm password</label>
                <input
                  id="setup-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>
              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
              <button type="submit" disabled={submitting} className="w-full rounded-full bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Setting password…" : "Set password and continue"}
              </button>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <p className="font-semibold">
                  {failureState === "expired"
                    ? "This invitation has expired."
                    : failureState === "used"
                      ? "This invitation has already been used."
                      : failureState === "network"
                        ? "We could not verify this invitation."
                        : "This invitation link is invalid or no longer available."}
                </p>
                <p className="mt-1 text-xs">
                  {failureState === "used"
                    ? "If your account is already activated, sign in normally."
                    : failureState === "expired"
                      ? "Please ask your administrator to send a new faculty invitation."
                      : failureState === "network"
                        ? "Check your connection and try opening the link again."
                        : "Please check the link or ask your administrator for a new invitation."}
                </p>
              </div>
              <button type="button" onClick={() => navigate("/login")} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">Return to login</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
