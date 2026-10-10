import { ArrowRight, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice, packages } from "../../data/catalog";

export function PackageSection() {
  return (
    <section id="packages" className="border-t border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Choose Your Starting Point.
        </h2>
        <p className="mt-2 max-w-xl text-fg-muted">
          Three bundles at a fixed price. Every one lists what it does not cover, because that is
          the half people find out about later.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-cyan-400/40"
            >
              <h3 className="font-display text-xl font-semibold text-fg">{pkg.name}</h3>
              <p className="mt-1 font-display text-3xl font-semibold text-cyan-400">
                {formatPrice(pkg)}
              </p>
              <p className="mt-2 text-sm text-fg-muted">{pkg.audience}</p>

              <ul className="mt-5 flex flex-col gap-2">
                {pkg.included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-xs font-semibold tracking-wide text-fg-faint uppercase">
                Not included
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {pkg.excluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs text-fg-faint">
                    <X className="mt-0.5 h-3 w-3 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs text-fg-faint">
                {pkg.deliveryEstimate} · {pkg.revisions} revision round
              </p>

              <Link
                to={`/packages#${pkg.id}`}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
              >
                {pkg.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
