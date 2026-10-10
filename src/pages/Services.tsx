import { ArrowRight, Clock, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import {
  activeServices,
  capabilities,
  categories,
  formatPrice,
  needsQuote,
  SERVICE_COUNT,
  type Service,
} from "../data/catalog";

/**
 * The full directory. Prices are public — a visitor can see what
 * everything costs without an account, and only ordering needs one.
 *
 * Filters by catalogue category and by homepage capability, because the
 * two are different cuts of the same list and a visitor arriving from
 * "Explore AI Solutions" should land on exactly those services.
 */
export function Services() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const capabilityId = params.get("capability");
  const categoryId = params.get("category");
  const capability = capabilities.find((c) => c.id === capabilityId) ?? null;

  const filtered = useMemo(() => {
    let list: Service[] = activeServices;
    if (capability) list = list.filter((s) => capability.serviceIds.includes(s.id));
    if (categoryId) list = list.filter((s) => s.category === categoryId);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        `${s.id} ${s.name} ${s.summary} ${s.deliverables.join(" ")}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [capability, categoryId, query]);

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // One filter at a time: a capability and a category together produce
    // confusing near-empty results for no benefit.
    if (key === "capability") next.delete("category");
    if (key === "category") next.delete("capability");
    setParams(next, { replace: true });
  };

  const activeFilterLabel = capability?.title ?? categories.find((c) => c.id === categoryId)?.label;

  return (
    <PublicShell title="Services">
      <section className="py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          All {SERVICE_COUNT} services
        </h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Every price here is the catalogue price. Anything marked “From” starts there and is
          quoted once the scope is agreed — it is never charged as if it were the final figure.
        </p>

        <div className="mt-7 flex flex-col gap-4">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-fg-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              aria-label="Search services"
              className="w-full rounded-xl border-2 border-border bg-surface py-2.5 pr-3.5 pl-10 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={!capabilityId && !categoryId} onClick={() => setParams({}, { replace: true })}>
              Everything
            </FilterChip>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setFilter("category", categoryId === category.id ? null : category.id)}
              >
                {category.label}
              </FilterChip>
            ))}
          </div>

          {capability ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              Showing <span className="font-semibold text-fg">{capability.title}</span>
              <button
                type="button"
                onClick={() => setFilter("capability", null)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-sm text-fg-faint">
          {filtered.length} {filtered.length === 1 ? "service" : "services"}
          {activeFilterLabel ? ` in ${activeFilterLabel}` : ""}
          {query.trim() ? ` matching “${query.trim()}”` : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-fg-muted">
              Nothing matches that. Try a different word, or{" "}
              <Link to="/forge" className="font-semibold text-cyan-400 hover:underline">
                describe it to Forge
              </Link>{" "}
              and it will work out which service fits.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((service) => (
              <Link
                key={service.id}
                to={`/services/${service.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 transition-colors group-hover:bg-cyan-400/20">
                    <service.icon className="h-5 w-5 text-cyan-400" strokeWidth={2.25} />
                  </span>
                  <span className="font-display text-base font-semibold whitespace-nowrap text-cyan-400">
                    {formatPrice(service)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-fg">{service.name}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{service.summary}</p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-fg-faint">
                    <Clock className="h-3 w-3 shrink-0" /> {service.deliveryEstimate}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-fg-muted transition-colors group-hover:text-cyan-400">
                    {needsQuote(service) ? "Get a quote" : "See the scope"}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
          : "border-border text-fg-muted hover:border-cyan-400/50 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
