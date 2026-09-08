import { useState } from 'react';
import { Link } from 'wouter';
import { useAgencyForgotPassword } from '@workspace/api-client-react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const { mutate, isPending } = useAgencyForgotPassword({
    mutation: {
      onSuccess: () => setSent(true),
    },
  });

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    mutate({ data: { email } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background bg-grid">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-2xl font-black gradient-text tracking-tight">AGENTICCORE</span>
          </Link>
          <p className="text-muted-foreground mt-2">Reset your password</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Check your email</h3>
              <p className="text-sm text-muted-foreground mb-6">
                If an account exists for <strong>{email}</strong>, we've sent a reset link. Check your inbox (and spam folder).
              </p>
              <Link href="/login">
                <span className="text-primary hover:underline text-sm">← Back to sign in</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
              <p className="text-center text-sm">
                <Link href="/login">
                  <span className="text-primary hover:underline">← Back to sign in</span>
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
