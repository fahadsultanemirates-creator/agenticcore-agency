import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout, FieldLabel, SubmitButton, authFieldClass } from "../components/auth/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { useAuth } from "../context/AuthContext";

const MIN_PASSWORD = 8;

/**
 * Where the emailed recovery link lands.
 *
 * Supabase has already put a recovery session in place by the time this
 * renders, so there is no token to read out of the URL -- updateUser()
 * acts on whoever is holding it.
 */
export function ResetPassword() {
  const { setPassword: savePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: saveError } = await savePassword(password);
    setSubmitting(false);
    if (saveError) {
      // Usually "Auth session missing" -- the link was opened in a
      // different browser, or it has expired. Say what to do about it.
      setError(
        saveError.toLowerCase().includes("session")
          ? "That reset link has expired, or was opened in a different browser. Ask for a new one."
          : saveError
      );
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Choose something you'll remember.">
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>New password</FieldLabel>
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            className={authFieldClass}
          />
        </label>
        {error && <p className="text-sm text-yellow-400">{error}</p>}
        <SubmitButton pending={submitting}>
          {submitting ? "Saving…" : "Set new password"}
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
