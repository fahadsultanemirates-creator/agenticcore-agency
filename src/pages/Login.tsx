import { ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout, FieldLabel, SubmitButton, authFieldClass } from "../components/auth/AuthLayout";
import { GoogleButton } from "../components/auth/GoogleButton";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Back to whatever page bounced them here. A router path from our own
  // location state, never a query string -- the legacy page took
  // ?redirect= and had to pattern-match it to avoid being an open
  // redirect. Not taking it from the URL at all is the simpler fix.
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter an email and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: loginError } = await login(email.trim(), password);
    setSubmitting(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see your projects and requests."
      footer={
        <>
          Don't have an account?{" "}
          {/* Symmetrical with Signup's "Log in" link: the return path has to
              survive a bounce between the two, or a part-written request is
              lost by going the long way round. */}
          <Link
            to="/signup"
            state={{ from }}
            className="font-semibold text-cyan-400 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <GoogleButton onError={setError} />

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
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel>Password</FieldLabel>
            <Link to="/reset" className="text-xs font-semibold text-cyan-400 hover:underline">
              Forgot?
            </Link>
          </div>
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            className={authFieldClass}
          />
        </label>

        {error && <p className="text-sm text-cyan-400">{error}</p>}

        <SubmitButton pending={submitting}>
          {submitting ? "Logging in…" : "Log in"}
          <ArrowRight className="h-4 w-4" />
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
