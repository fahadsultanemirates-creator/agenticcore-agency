import { MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../components/auth/AuthLayout";

export function CheckEmail() {
  return (
    <AuthLayout
      title="Check your email"
      subtitle="Your account is made — one link to go."
      footer={
        <Link to="/login" className="font-semibold text-yellow-400 hover:underline">
          Back to log in
        </Link>
      }
    >
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
        <p className="text-sm text-fg-muted">
          We've sent a confirmation link to the address you signed up with. Click it and you'll be
          taken straight to your dashboard. If it hasn't arrived in a minute or two, check your spam
          folder — it comes from Supabase on our behalf.
        </p>
      </div>
    </AuthLayout>
  );
}
