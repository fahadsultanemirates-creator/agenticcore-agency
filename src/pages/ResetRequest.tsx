import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout, FieldLabel, SubmitButton, authFieldClass } from "../components/auth/AuthLayout";
import { useAuth } from "../context/AuthContext";

export function ResetRequest() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await requestPasswordReset(email.trim());
    setSubmitting(false);
    setSent(true);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link to="/login" className="font-semibold text-cyan-400 hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        // Deliberately the same message whatever happened. Saying "no
        // account with that email" would turn this box into a way to find
        // out who has an account here.
        <p className="mt-6 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm text-fg-muted">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
          <SubmitButton pending={submitting}>
            {submitting ? "Sending…" : "Send reset link"}
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
