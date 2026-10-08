import { ArrowRight, FolderKanban, Package, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { AGENTICCORE_PACKAGE, serviceCategories } from "../data/services";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";
import { supabase } from "../lib/supabase";
import { statusClass, statusLabel } from "../lib/status";

type BillingRow = { id: number; amount: number; payment_type: string; status: string };

export function Dashboard() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingRow[] | null>(null);

  const [billingFailed, setBillingFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("billing")
          .select("id, amount, payment_type, status")
          .eq("user_id", user.id)
          .order("id", { ascending: false });
        if (cancelled) return;
        if (error) throw error;
        setBilling(data ?? []);
      } catch (err) {
        // Said, not swallowed. billing === null renders "Loading…", so a
        // query that never resolves leaves that word on screen for good
        // and a client reads it as "my payments are missing".
        console.error("Could not load billing", err);
        if (!cancelled) {
          setBilling([]);
          setBillingFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <DashboardShell title="Dashboard">
      <section className="pt-8 pb-10 sm:pt-12">
        <h1 className="font-display text-3xl font-semibold text-fg sm:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Pick a service below to place a request, or describe what you need to Forge and get it
          scoped and priced.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/projects"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5"
          >
            <FolderKanban className="h-4 w-4" />
            Your projects
          </Link>
          <Link
            to="/forge"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-yellow-400/50"
          >
            <Sparkles className="h-4 w-4" />
            Chat with Forge
          </Link>
        </div>
      </section>

      {/* ---- services ---- */}
      <section className="border-t border-border py-10">
        <h2 className="font-display text-2xl font-semibold text-fg">Place a request</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          {serviceCategories.length} categories, every price fixed up front.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {serviceCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.id}
                to={`/request?service=${category.id}`}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-yellow-400/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-void text-yellow-400">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-fg">{category.label}</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">{category.tagline}</span>
                  <span className="mt-1.5 block text-xs font-semibold text-yellow-400">
                    From ${category.fromUsd}
                  </span>
                </span>
                <ArrowRight className="mt-1 ml-auto h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-yellow-400" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- the one bundle ---- */}
      <section className="border-t border-border py-10">
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold text-fg">
                {AGENTICCORE_PACKAGE.label} — {money(AGENTICCORE_PACKAGE.priceUsd)}
              </h2>
              <p className="mt-1.5 text-sm text-fg-muted">
                Priority handling with no scoping back-and-forth, and every service after it at 50%
                off.
              </p>
              <Link
                to="/request?package=1"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
              >
                Order the package
                <Send className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- billing ---- */}
      <section className="border-t border-border py-10">
        <h2 className="font-display text-2xl font-semibold text-fg">Billing</h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          30% upfront, 70% on completion, for every service and package.{" "}
          <Link to="/terms" className="font-semibold text-yellow-400 hover:underline">
            Read the full payment &amp; delivery policy
          </Link>
          .
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {billing === null ? (
            <p className="text-sm text-fg-faint">Loading…</p>
          ) : billingFailed ? (
            <p className="rounded-xl border border-orange-400/30 bg-orange-400/5 px-4 py-5 text-sm text-orange-300">
              Couldn't load your billing history just now — reload the page to try again.
            </p>
          ) : billing.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-5 text-sm text-fg-faint">
              No billing activity yet.
            </p>
          ) : (
            billing.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <p className="min-w-0 truncate text-sm font-semibold text-fg">
                  {money(row.amount)} — {row.payment_type}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
