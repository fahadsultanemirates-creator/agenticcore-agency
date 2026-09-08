import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAgencyResetPassword } from '@workspace/api-client-react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [location] = useLocation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, [location]);

  const { mutate, isPending } = useAgencyResetPassword({
    mutation: {
      onSuccess: () => setDone(true),
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? 'Reset failed. The link may have expired.');
      },
    },
  });

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    mutate({ data: { token, password } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background bg-grid">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-2xl font-black gradient-text tracking-tight">AGENTICCORE</span>
          </Link>
          <p className="text-muted-foreground mt-2">Set new password</p>
        </div>
        <div className="glass rounded-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Password updated!</h3>
              <p className="text-sm text-muted-foreground mb-6">You can now sign in with your new password.</p>
              <Link href="/login">
                <span className="inline-block px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all">Sign In</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!token && (
                <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  Invalid reset link. Please request a new one.
                </div>
              )}
              {error && (
                <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters"
                  className="w-full px-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} placeholder="Repeat password"
                  className="w-full px-4 py-2.5 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              </div>
              <button type="submit" disabled={isPending || !token}
                className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reset Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
