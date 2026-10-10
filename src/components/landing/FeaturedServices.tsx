import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { featuredServices, formatPrice, needsQuote, SERVICE_COUNT } from "../../data/catalog";

export function FeaturedServices() {
  return (
    <section id="services" className="border-t border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              Professional Development. Affordable Starting Prices.
            </h2>
            <p className="mt-2 max-w-xl text-fg-muted">
              Six of the {SERVICE_COUNT}. Every price below is the catalogue price, and every
              "from" says so.
            </p>
          </div>
          <Link
            to="/services"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-border px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-cyan-400/60"
          >
            Explore All {SERVICE_COUNT} Services
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredServices.map((service) => (
            <Link
              key={service.id}
              to={`/services/${service.id}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 transition-colors duration-200 group-hover:bg-cyan-400/20">
                  <service.icon className="h-5 w-5 text-cyan-400" strokeWidth={2.25} />
                </span>
                <span className="font-display text-base font-semibold whitespace-nowrap text-cyan-400">
                  {formatPrice(service)}
                </span>
              </div>

              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-fg">{service.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{service.summary}</p>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
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
      </div>
    </section>
  );
}
