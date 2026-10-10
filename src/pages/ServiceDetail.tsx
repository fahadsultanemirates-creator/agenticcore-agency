import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock, Info, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import {
  archivedById,
  categories,
  formatPrice,
  needsQuote,
  packages,
  serviceById,
} from "../data/catalog";
import { NotFound } from "./NotFound";

const SISTER = {
  click: { name: "AgenticCore.click", href: "https://agenticcore.click" },
  biz: { name: "AgenticCore.biz", href: "https://agenticcore.biz" },
} as const;

export function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const service = id ? serviceById(id) : undefined;
  const archived = id && !service ? archivedById(id) : undefined;

  // A retired service gets an explanation and a door, not a 404. These
  // links are in people's inboxes and in search results.
  if (!service && archived) return <Retired entry={archived} />;
  if (!service) return <NotFound />;

  const category = categories.find((c) => c.id === service.category);
  const inPackages = packages.filter((p) => p.serviceIds.includes(service.id));

  return (
    <PublicShell title={service.name}>
      <article className="py-10 sm:py-14">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> All services
        </Link>

        <div className="mt-6 flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10">
            <service.icon className="h-6 w-6 text-cyan-400" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
              {service.id} · {category?.label}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              {service.name}
            </h1>
            <p className="mt-2 max-w-2xl text-fg-muted">{service.summary}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="font-display text-3xl font-semibold text-cyan-400">
            {formatPrice(service)}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-fg-muted">
            <Clock className="h-4 w-4 shrink-0" /> {service.deliveryEstimate}
          </span>
          <span className="text-sm text-fg-muted">
            {service.revisions === 0
              ? "No revision round"
              : `${service.revisions} revision round`}
          </span>
        </div>

        {needsQuote(service) ? (
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-sm text-fg-muted">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              {formatPrice(service)} is where this starts, not what it costs. The final figure
              depends on the scope, and you see it in writing before anything is charged.
            </span>
          </p>
        ) : null}

        <div className="mt-9 grid gap-5 lg:grid-cols-2">
          <Panel title="What you get" items={service.deliverables} tone="good" />
          <Panel title="What the base scope covers" items={service.scopeLimits} tone="info" />
          <Panel title="Not included" items={service.exclusions} tone="bad" />
          <Panel title="What we need from you" items={service.customerInputs} tone="info" />
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-fg">
            <Info className="h-4 w-4 shrink-0 text-cyan-400" /> Costs you pay someone else
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {service.externalCosts.map((cost) => (
              <li key={cost} className="flex items-start gap-2 text-sm text-fg-muted">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
                {cost}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-faint">
            These are not ours and are not in the price above. They are listed so the quotation
            holds no surprises.
          </p>
        </div>

        {inPackages.length > 0 ? (
          <p className="mt-5 text-sm text-fg-muted">
            Also part of{" "}
            {inPackages.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? " and " : ""}
                <Link to={`/packages#${p.id}`} className="font-semibold text-cyan-400 hover:underline">
                  {p.name}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : null}

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            to={`/request?service=${service.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
          >
            {needsQuote(service) ? "Request a quote" : "Start this project"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/forge"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-3.5 text-sm font-semibold text-fg transition-colors hover:border-cyan-400/60"
          >
            Not sure? Ask Forge
          </Link>
        </div>
      </article>
    </PublicShell>
  );
}

function Panel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "bad" | "info";
}) {
  const Icon = tone === "good" ? Check : tone === "bad" ? X : Info;
  const colour = tone === "bad" ? "text-fg-faint" : "text-cyan-400";
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${colour}`} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Retired({
  entry,
}: {
  entry: { id: string; name: string; replacedBy?: string; movedTo?: "click" | "biz"; note: string };
}) {
  const successor = entry.replacedBy ? serviceById(entry.replacedBy) : undefined;
  const sister = entry.movedTo ? SISTER[entry.movedTo] : undefined;

  return (
    <PublicShell title={entry.name}>
      <article className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg-muted">
            No longer offered here
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg">
            {entry.name}
          </h1>
          <p className="mt-3 text-fg-muted">{entry.note}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {successor ? (
              <Link
                to={`/services/${successor.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
              >
                Go to {successor.name}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            {sister ? (
              <a
                href={sister.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
              >
                Visit {sister.name}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
            <Link
              to="/services"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-cyan-400/60"
            >
              All services
            </Link>
          </div>

          <p className="mt-8 text-sm text-fg-faint">
            If you already ordered this, your project is unaffected — it keeps the scope and the
            price you agreed, and it is still in your dashboard.
          </p>
        </div>
      </article>
    </PublicShell>
  );
}
