import { ArrowRight, Clock } from "lucide-react";
import { SERVICE_COUNT, serviceCategories } from "../../data/services";
import { Reveal } from "../Reveal";

// Categories, not individual services. Fifty line items in one grid is a
// price list; six cards is a choice. The items inside each card are what
// somebody picks once they are already in the right place, which is what
// the request page is for.
export function ServicesGrid() {
  return (
    <section id="services" className="bg-surface/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Everything a business needs, for its whole life
          </h2>
          <p className="mt-4 text-lg text-fg-muted">
            {SERVICE_COUNT} services across six disciplines. Every price below is the real one —
            there is no "contact us for pricing" anywhere on this site.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceCategories.map((category, i) => (
            <Reveal key={category.id} delay={(i % 3) * 80} className="h-full">
              <a
                href={`/request.html?category=${encodeURIComponent(category.label)}`}
                className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-yellow-400/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400/10 transition-colors duration-200 group-hover:bg-yellow-400/20">
                    <category.icon className="h-5 w-5 text-yellow-400" strokeWidth={2.25} />
                  </span>
                  <span className="font-display text-sm font-semibold whitespace-nowrap text-yellow-400">
                    ${category.fromUsd}–${category.toUsd}
                  </span>
                </div>

                <div>
                  <p className="font-display text-base font-semibold text-fg">{category.label}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">{category.tagline}</p>
                </div>

                <p className="text-sm text-fg-faint">{category.detail}</p>

                {/* The three best-known items, named. A category card that
                    only says "Design & Media" makes somebody click to find
                    out whether we do the one thing they came for. */}
                <ul className="flex flex-wrap gap-1.5">
                  {category.items.slice(0, 3).map((item) => (
                    <li
                      key={item.name}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted"
                    >
                      {item.name} · ${item.price}
                    </li>
                  ))}
                  {category.items.length > 3 ? (
                    <li className="rounded-full px-2.5 py-1 text-[11px] text-fg-faint">
                      +{category.items.length - 3} more
                    </li>
                  ) : null}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-fg-faint">
                    <Clock className="h-3 w-3" /> {category.eta}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-fg-faint transition-all group-hover:translate-x-0.5 group-hover:text-yellow-400" />
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="/signup.html"
            className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5"
          >
            Create an account to start
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
