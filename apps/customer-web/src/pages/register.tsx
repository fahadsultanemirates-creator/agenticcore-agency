import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAgencyRegister, getGetAgencyAuthMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LOGO = `${BASE}/images/logo-agency.svg`;

export default function Register() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useAgencyRegister({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAgencyAuthMeQueryKey() });
        navigate('/dashboard');
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? 'Registration failed. Please try again.');
      },
    },
  });

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    mutate({ data: { fullName, email, company: company || undefined, password } });
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="px-6 h-16 flex items-center justify-between border-b border-border">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </div>
        </Link>
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src={LOGO} alt="AgenticCore" className="h-8 w-8 object-contain" />
            <span className="text-sm font-black text-foreground tracking-tight">
              AGENTICCORE<span className="gradient-text">.AGENCY</span>
            </span>
          </div>
        </Link>
        <Link href="/login">
          <span className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Sign In
          </span>
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <div className="p-3 rounded-2xl bg-white border border-border shadow-lg">
                <img src={LOGO} alt="AgenticCore" className="h-14 w-14 object-contain" />
              </div>
            </div>
            <h1 className="text-2xl font-black text-foreground mb-1">Create your account</h1>
            <p className="text-sm text-muted-foreground">Get access to 22 specialist AI agents</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Smith"
                autoComplete="name"
                className="w-full px-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email <span className="text-destructive">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Company <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc."
                autoComplete="organization"
                className="w-full px-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Password <span className="text-destructive">*</span></label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                minLength={8}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 gradient-bg text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-md mt-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login">
              <span className="text-primary hover:text-primary/80 font-semibold cursor-pointer">Sign In</span>
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground/60 mt-4 leading-relaxed">
            By registering you agree to our terms of service.<br />
            Credits are assigned by your account manager after signup.
          </p>
        </div>
      </div>
    </div>
  );
}
