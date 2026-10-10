import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DashboardNav } from "../components/dashboard/DashboardNav";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";
import { supabase } from "../lib/supabase";

type Profile = {
  full_name: string | null;
  company_name: string | null;
  referral_code: string;
  total_spend: string;
  points_balance: string;
  is_business_pool: boolean;
};

const BUSINESS_POOL_THRESHOLD = 5000;

export function Account() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("full_name, company_name, referral_code, total_spend, points_balance, is_business_pool")
        .maybeSingle();
      if (!active) return;
      if (loadError) console.error("Loading profile failed:", loadError.message);
      const row = (data as Profile | null) ?? null;
      setProfile(row);
      setName(row?.full_name ?? "");
      setCompany(row?.company_name ?? "");
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    // Only these two columns. protect_profile_fields freezes total_spend,
    // points_balance, is_business_pool, referral_code, referred_by and
    // is_admin against anon and authenticated anyway -- sending them
    // would be silently ignored rather than applied, which is worse than
    // not sending them.
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null, company_name: company.trim() || null })
      .eq("id", user?.id ?? "");
    setSaving(false);
    if (saveError) {
      setError("Couldn't save that just now. Please try again.");
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const referralLink = profile ? `https://agenticcore.agency/signup?ref=${profile.referral_code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Some in-app browsers refuse the clipboard. The link is selectable.
    }
  };

  const spend = Number(profile?.total_spend ?? 0);

  return (
    <DashboardShell title="Account Settings">
      <DashboardNav />
      <section className="py-8">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
          Account Settings
        </h1>

        <div className="mt-6 grid max-w-3xl gap-5">
          <form onSubmit={save} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-fg">Your details</h2>

            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  Business name
                </span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                  placeholder="Optional"
                  className="rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  Email
                </span>
                <p className="rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg-muted">
                  {user?.email}
                </p>
                <p className="text-xs text-fg-faint">
                  Changing the address on an account needs a confirmation step we have not built —
                  email us and we will move it.
                </p>
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-cyan-300">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saved ? <Check className="h-4 w-4" /> : null}
              {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
            </button>
          </form>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-fg">Spend &amp; status</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
                  Lifetime spend
                </dt>
                <dd className="mt-1 font-display text-xl font-semibold text-fg">{money(spend)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
                  AgenticCore Points
                </dt>
                <dd className="mt-1 font-display text-xl font-semibold text-fg">
                  {Number(profile?.points_balance ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
                  Business Pool
                </dt>
                <dd className="mt-1 font-display text-xl font-semibold text-fg">
                  {profile?.is_business_pool ? "Member" : "Not yet"}
                </dd>
              </div>
            </dl>
            {!profile?.is_business_pool ? (
              <p className="mt-4 text-xs text-fg-faint">
                {money(Math.max(0, BUSINESS_POOL_THRESHOLD - spend))} more in lifetime spend
                unlocks a dedicated manager, 20% off every service and faster delivery.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-fg">
              <Gift className="h-4 w-4 text-cyan-400" /> Refer someone
            </h2>
            <p className="mt-1.5 text-sm text-fg-muted">
              1 Point = $1 of credit. You earn 20% of a referred client's task value, 10% at the
              second level and 5% at the third — on their first three completed paid tasks.
            </p>
            {profile ? (
              <div className="mt-4 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-void px-3 py-2 font-mono text-xs text-fg sm:text-sm">
                  {referralLink}
                </code>
                <button
                  type="button"
                  onClick={() => void copy()}
                  aria-label="Copy referral link"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-border text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
                >
                  {copied ? <Check className="h-4 w-4 text-cyan-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold text-fg">Session</h2>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 rounded-full border-2 border-border px-5 py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
