import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout, FieldLabel, SubmitButton, authFieldClass } from "../components/auth/AuthLayout";
import { GoogleButton } from "../components/auth/GoogleButton";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";

/** Supabase's own floor. Saying it up front beats failing on submit. */
const MIN_PASSWORD = 8;

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to land once the account exists. Same rule as Login: a path from
  // our own router state, never a query parameter, so this cannot be turned
  // into an open redirect by handing someone a crafted signup link.
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Enter your name and email to continue.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: signupError, needsConfirmation } = await signup(name.trim(), email.trim(), password);
    setSubmitting(false);
    if (signupError) {
      setError(signupError);
      return;
    }
    // Two different successes. Going straight on in the confirmation case
    // would hit RequireAuth, find no session, and land the client back on
    // /login having just chosen a password.
    navigate(needsConfirmation ? "/check-email" : from, { replace: true });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Order a service, track it, and get it delivered."
      footer={
        <>
          Already have one?{" "}
          {/* Carries the return path, so someone who already has an account
              and clicks through from a part-written request still gets back
              to it. */}
          <Link
            to="/login"
            state={{ from }}
            className="font-semibold text-cyan-400 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <GoogleButton onError={setError} />

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Full name</FieldLabel>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={authFieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className={authFieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Password</FieldLabel>
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            className={authFieldClass}
          />
        </label>

        {error && <p className="text-sm text-cyan-400">{error}</p>}

        <SubmitButton pending={submitting}>
          {submitting ? "Creating…" : "Create account"}
          <ArrowRight className="h-4 w-4" />
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
