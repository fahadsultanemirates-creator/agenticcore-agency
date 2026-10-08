import { ArrowRight, Check, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { UsdtPayment } from "../components/payment/UsdtPayment";
import { AGENTICCORE_PACKAGE, serviceCategories, type ServiceCategory } from "../data/services";
import { useAuth } from "../context/AuthContext";
import { money } from "../lib/format";
import { upfrontAmountDue } from "../lib/pricing";
import { supabase } from "../lib/supabase";

/**
 * requests.tier is a not-null column with a check constraint of
 * ('low','mid','top') left over from a three-tier pricing system that no
 * longer exists. Every price on the sheet is what used to be the low
 * tier's number, so writing 'low' satisfies the constraint without a
 * migration and without inventing a tier nobody chose.
 */
const LEGACY_TIER_DB_VALUE = "low";

type Placed = { id: string; agreedPrice: number };

export function Request() {
  const [params] = useSearchParams();
  const { user } = useAuth();

  // ?package=1 is the bundle, which skips service and task selection --
  // there is only one of it, at one price.
  const isPackage = params.get("package") === "1";

  const preselected = useMemo(
    () => serviceCategories.find((c) => c.id === params.get("service")) ?? null,
    [params]
  );

  const [category, setCategory] = useState<ServiceCategory | null>(preselected);
  const [task, setTask] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);

  const price = isPackage
    ? AGENTICCORE_PACKAGE.priceUsd
    : (category?.items.find((i) => i.name === task)?.price ?? 0);

  const ready = isPackage ? description.trim().length > 0 : Boolean(category && task && description.trim());

  const submit = async () => {
    if (!user || !ready) return;
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

    const { data, error: insertError } = await supabase
      .from("requests")
      .insert({
        user_id: user.id,
        service_category: isPackage ? "AgenticCore Package" : category!.label,
        task_type: isPackage ? AGENTICCORE_PACKAGE.label : task,
        tier: LEGACY_TIER_DB_VALUE,
        description: isPackage
          ? `${AGENTICCORE_PACKAGE.label} package order — priority handling, no additional scoping needed. ${description.trim()}`
          : description.trim(),
        agreed_price: price,
        // Not 'confirmed'. The chain watcher moves it there once the
        // deposit lands, and nothing else may.
        status: "awaiting_payment",
        attachment_path: attachmentPath,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not submit the request. Please try again.");
      return;
    }

    setPlaced({ id: data.id as string, agreedPrice: price });
  };

  // ---- after submitting: the invoice ----------------------------------
  if (placed) {
    return (
      <DashboardShell title="Payment">
        <section className="py-10">
          <div className="flex items-start gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-5">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold text-fg">Request submitted</h1>
              <p className="mt-1 text-sm text-fg-muted">
                Pay the deposit below and we'll start. You can follow it on{" "}
                <Link to="/projects" className="font-semibold text-yellow-400 hover:underline">
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

  // ---- the wizard -----------------------------------------------------
  return (
    <DashboardShell title={isPackage ? "AgenticCore Package" : "New request"}>
      <section className="py-10">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
          {isPackage ? AGENTICCORE_PACKAGE.label : "New request"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {isPackage
            ? `${money(AGENTICCORE_PACKAGE.priceUsd)} — priority handling, and every service after it at 50% off.`
            : "Pick what you need, tell us about it, and pay a 30% deposit to start."}
        </p>

        {!isPackage && (
          <>
            <Step n={1} title="Choose a service">
              <div className="grid gap-2 sm:grid-cols-2">
                {serviceCategories.map((c) => {
                  const Icon = c.icon;
                  const selected = category?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategory(c);
                        setTask(null);
                      }}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-colors ${
                        selected
                          ? "border-yellow-400 bg-yellow-400/5"
                          : "border-border bg-surface hover:border-yellow-400/40"
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${selected ? "text-yellow-400" : "text-fg-faint"}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-fg">{c.label}</span>
                        <span className="block text-xs text-fg-muted">From ${c.fromUsd}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Step>

            {category && (
              <Step n={2} title={`What do you need from ${category.label}?`}>
                <div className="flex flex-col gap-2">
                  {category.items.map((item) => {
                    const selected = task === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setTask(item.name)}
                        className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-yellow-400 bg-yellow-400/5"
                            : "border-border bg-surface hover:border-yellow-400/40"
                        }`}
                      >
                        <span className="min-w-0 text-sm font-medium text-fg">{item.name}</span>
                        <span className="shrink-0 text-sm font-semibold text-yellow-400">
                          ${item.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Step>
            )}
          </>
        )}

        {(isPackage || task) && (
          <Step n={isPackage ? 1 : 3} title="Tell us what you need">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What is it for, who is it for, and anything we must get right — names, colours, deadlines, links to things you like."
              className="w-full rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:border-yellow-400 focus:outline-none"
            />

            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-fg-muted">
              <span className="flex items-center gap-1.5 rounded-full border-2 border-border px-3.5 py-2 font-semibold transition-colors hover:border-yellow-400/50">
                <Paperclip className="h-4 w-4" />
                {file ? "Change file" : "Attach a file"}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <span className="min-w-0 truncate text-xs text-fg-faint">{file.name}</span>}
            </label>
          </Step>
        )}

        {ready && (
          <Step n={isPackage ? 2 : 4} title="Confirm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
              <dt className="text-fg-faint">Service</dt>
              <dd className="text-fg">{isPackage ? AGENTICCORE_PACKAGE.label : category!.label}</dd>
              {!isPackage && (
                <>
                  <dt className="text-fg-faint">Task</dt>
                  <dd className="text-fg">{task}</dd>
                </>
              )}
              <dt className="text-fg-faint">Price</dt>
              <dd className="text-fg">{money(price)}</dd>
              <dt className="text-fg-faint">Due now</dt>
              <dd className="font-semibold text-yellow-400">
                {money(upfrontAmountDue(price))}{" "}
                <span className="font-normal text-fg-faint">(30% deposit)</span>
              </dd>
            </dl>

            {error && <p className="mt-3 text-sm text-yellow-400">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit and pay deposit"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </Step>
        )}
      </section>
    </DashboardShell>
  );
}

/**
 * One step, revealed as the one before it is answered.
 *
 * The legacy wizard hid steps behind Back/Next buttons, which meant you
 * could not see what you had already chosen without stepping backwards.
 * Everything stays on screen here; the page just grows.
 */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-semibold text-fg">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-void">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}
