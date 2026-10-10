import { AlertTriangle, ArrowRight, Check, Clock, FileText, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { UsdtPayment } from "../components/payment/UsdtPayment";
import {
  categories,
  formatPrice,
  needsQuote,
  packageById,
  serviceById,
  servicesIn,
  type Package,
  type Service,
} from "../data/catalog";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";
import { upfrontAmountDue } from "../lib/pricing";
import { supabase } from "../lib/supabase";

/**
 * requests.tier is a not-null column with a check constraint of
 * ('low','mid','top') left over from a three-tier pricing system that no
 * longer exists. Writing 'low' satisfies the constraint without a
 * migration and without inventing a tier nobody chose.
 */
const LEGACY_TIER_DB_VALUE = "low";

/** Placed with a price agreed: there is a deposit to pay right now. */
type Invoiced = { kind: "invoiced"; id: string; agreedPrice: number };
/** Placed for scoping: no price yet, so nothing to pay. */
type Quoting = { kind: "quoting"; id: string };
type Placed = Invoiced | Quoting;

export function Request() {
  const [params] = useSearchParams();
  const { user } = useAuth();

  // ?package=PKG-… orders a bundle; ?service=AG-… preselects one service.
  const pkg = useMemo(() => packageById(params.get("package") ?? ""), [params]);
  const preselected = useMemo(() => serviceById(params.get("service") ?? ""), [params]);

  const [service, setService] = useState<Service | null>(preselected ?? null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);

  const chosen: Service | Package | null = pkg ?? service;

  /**
   * Whether a price can be agreed at the point of ordering.
   *
   * Packages and fixed-price services can: the figure is the figure, so
   * the request goes straight to awaiting_payment and the deposit is due.
   *
   * A "From" service cannot. Writing the catalogue floor into
   * agreed_price would let a customer order a $499 multi-agent framework
   * and a $4,000 one at the same price, and agreed_price is the column
   * the invoice and the 30% deposit are both computed from. Those go in
   * as drafts with a null price, and a person quotes them.
   */
  const quoteFirst = Boolean(service && needsQuote(service));
  const agreedPrice = chosen && !quoteFirst ? chosen.priceUsd : null;

  const ready = Boolean(chosen) && description.trim().length > 0;

  const submit = async () => {
    if (!user || !ready || !chosen) return;
    setError("");
    setSubmitting(true);

    let attachmentPath: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("request-attachments")
        .upload(path, file);
      if (uploadError) {
        setSubmitting(false);
        setError(`Attachment failed to upload: ${uploadError.message}`);
        return;
      }
      attachmentPath = path;
    }

    const categoryLabel = pkg
      ? "Package"
      : (categories.find((c) => c.id === service?.category)?.label ?? "Service");

    const { data, error: insertError } = await supabase
      .from("requests")
      .insert({
        user_id: user.id,
        service_category: categoryLabel,
        // The catalogue id, not the name. Names get reworded; AG-07 does
        // not, and it is what the dashboard looks up to render a request
        // later. Rows written before this change hold a service name, and
        // the dashboard falls back to showing that text as-is.
        task_type: chosen.id,
        tier: LEGACY_TIER_DB_VALUE,
        description: description.trim(),
        agreed_price: agreedPrice,
        // 'confirmed' is not ours to set — the chain watcher moves a
        // request there once the deposit lands, and nothing else may.
        status: quoteFirst ? "draft" : "awaiting_payment",
        attachment_path: attachmentPath,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not submit the request. Please try again.");
      return;
    }

    setPlaced(
      agreedPrice === null
        ? { kind: "quoting", id: data.id as string }
        : { kind: "invoiced", id: data.id as string, agreedPrice },
    );
  };

  // ---- after submitting ------------------------------------------------
  if (placed?.kind === "quoting") {
    return (
      <DashboardShell title="Request received">
        <section className="py-10">
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-5">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-fg">Request received</h1>
              <p className="mt-1 text-sm text-fg-muted">
                This one is priced on scope, so there is nothing to pay yet. We read what you sent,
                come back with a specification, a price and a timeline, and only then is there a
                deposit. You will find it on{" "}
                <Link to="/projects" className="font-semibold text-cyan-400 hover:underline">
                  your projects page
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </DashboardShell>
    );
  }

  if (placed?.kind === "invoiced") {
    return (
      <DashboardShell title="Payment">
        <section className="py-10">
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-5">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-fg">Request submitted</h1>
              <p className="mt-1 text-sm text-fg-muted">
                Pay the deposit below and we'll start. You can follow it on{" "}
                <Link to="/projects" className="font-semibold text-cyan-400 hover:underline">
                  your projects page
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-semibold text-fg">Pay with USDT</h2>
            <p className="mt-1 mb-5 text-sm text-fg-muted">
              BNB Smart Chain (BEP-20). Confirmation usually takes under a minute.
            </p>
            <UsdtPayment requestId={placed.id} amountDue={upfrontAmountDue(placed.agreedPrice)} />
          </div>
        </section>
      </DashboardShell>
    );
  }

  // ---- the wizard ------------------------------------------------------
  return (
    <DashboardShell title={pkg ? pkg.name : "New request"}>
      <section className="py-10">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
          {pkg ? pkg.name : "New request"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {pkg
            ? `${money(pkg.priceUsd)} — ${pkg.audience}`
            : "Pick what you need and tell us about it. Fixed-price work takes a 30% deposit to start; anything priced on scope is quoted first."}
        </p>

        {!pkg && (
          <Step n={1} title="Choose a service">
            <div className="flex flex-col gap-6">
              {categories.map((category) => (
                <div key={category.id}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <category.icon className="h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2.25} />
                    <h3 className="font-display text-sm font-semibold text-fg">{category.label}</h3>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {servicesIn(category.id).map((item) => {
                      const active = service?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setService(item)}
                          aria-pressed={active}
                          className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                            active
                              ? "border-cyan-400 bg-cyan-400/5"
                              : "border-border hover:border-cyan-400/50"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-fg">{item.name}</span>
                            <span className="mt-0.5 block text-xs text-fg-faint">
                              {item.deliveryEstimate}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-cyan-400">
                            {formatPrice(item)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Step>
        )}

        {service ? (
          <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="font-display text-lg font-semibold text-cyan-400">
                {formatPrice(service)}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-fg-muted">
                <Clock className="h-3.5 w-3.5 shrink-0" /> {service.deliveryEstimate}
              </span>
              <Link
                to={`/services/${service.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-cyan-400 hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> Full scope
              </Link>
            </div>
            {quoteFirst ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-fg-muted">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  This one is priced on scope. Sending it costs nothing — we come back with a
                  specification and a figure before any deposit is due.
                </span>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-fg-faint">
              You will also pay directly for: {service.externalCosts.join(", ")}.
            </p>
          </div>
        ) : null}

        <Step n={pkg ? 1 : 2} title="Tell us about it">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="What the business does, what you need built, and anything it has to work with."
            className="w-full rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
          />

          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-fg-muted">
            <span className="flex items-center gap-1.5 rounded-full border-2 border-border px-3.5 py-2 font-semibold transition-colors hover:border-cyan-400/50">
              <Paperclip className="h-3.5 w-3.5" />
              {file ? "Change file" : "Attach a file"}
            </span>
            {file ? <span className="min-w-0 truncate text-xs text-fg-faint">{file.name}</span> : null}
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Step>

        <Step n={pkg ? 2 : 3} title="Confirm">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">What</dt>
              <dd className="text-right text-fg">{chosen ? chosen.name : "Nothing chosen yet"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Price</dt>
              <dd className="text-right text-fg">
                {chosen ? formatPrice(chosen) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Due now</dt>
              <dd className="text-right text-fg">
                {agreedPrice === null
                  ? "Nothing until it is quoted"
                  : `${money(upfrontAmountDue(agreedPrice))} (30% deposit)`}
              </dd>
            </div>
          </dl>

          {error ? <p className="mt-3 text-sm text-cyan-300">{error}</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={!ready || submitting}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : agreedPrice === null ? "Request a quote" : "Submit and pay deposit"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </Step>
      </section>
    </DashboardShell>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-semibold text-fg">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-void">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}
