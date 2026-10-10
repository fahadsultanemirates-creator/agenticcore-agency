import { ArrowRight, Check, Clock, Info, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import { formatPrice, packages, serviceById } from "../data/catalog";

export function Packages() {
  return (
    <PublicShell title="Packages">
      <section className="py-10 sm:py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Business packages
        </h1>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Three bundles at a fixed price, each built from services in the catalogue. Every one
          states what it does not cover and what you will still pay other providers.
        </p>

        <div className="mt-9 flex flex-col gap-5">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              id={pkg.id}
              className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-semibold text-fg">{pkg.name}</h2>
                  <p className="mt-1.5 max-w-lg text-sm text-fg-muted">{pkg.audience}</p>
                </div>
                <p className="font-display text-3xl font-semibold whitespace-nowrap text-cyan-400">
                  {formatPrice(pkg)}
                </p>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                    Included
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {pkg.included.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                    Not included
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {pkg.excluded.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-fg-faint">
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-sm text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> {pkg.deliveryEstimate}
                </span>
                <span>
                  {pkg.revisions === 0 ? "No revision round" : `${pkg.revisions} revision round`}
                </span>
              </div>

              <p className="mt-3 flex items-start gap-2 text-xs text-fg-faint">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>You still pay directly for: {pkg.externalCosts.join(", ")}.</span>
              </p>

              {/* Built from real catalogue entries, so the package and the
                  service it contains can never describe different scopes. */}
              <p className="mt-3 text-xs text-fg-faint">
                Built from{" "}
                {pkg.serviceIds.map((id, i) => {
                  const service = serviceById(id);
                  if (!service) return null;
                  return (
                    <span key={id}>
                      {i > 0 ? " + " : ""}
                      <Link
                        to={`/services/${service.id}`}
                        className="text-fg-muted hover:text-cyan-400 hover:underline"
                      >
                        {service.name}
                      </Link>
                    </span>
                  );
                })}
                .
              </p>

              <Link
                to={`/request?package=${pkg.id}`}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
              >
                {pkg.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-fg-muted">
          None of these quite right?{" "}
          <Link to="/services" className="font-semibold text-cyan-400 hover:underline">
            Browse all 19 services
          </Link>{" "}
          or{" "}
          <Link to="/forge" className="font-semibold text-cyan-400 hover:underline">
            describe the project to Forge
          </Link>
          .
        </p>
      </section>
    </PublicShell>
  );
}
