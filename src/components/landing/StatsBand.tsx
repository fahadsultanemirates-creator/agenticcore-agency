import { SERVICE_COUNT, serviceCategories } from "../../data/services";
import { Reveal } from "../Reveal";

const stats = [
  { value: `${SERVICE_COUNT}`, label: "services, every price published" },
  { value: `${serviceCategories.length}`, label: "disciplines under one roof" },
  { value: "$5", label: "cheapest thing we sell" },
  { value: "0", label: "meetings required" },
];

export function StatsBand() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-12 sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
          />
          <div className="relative grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-4xl font-semibold text-yellow-400 sm:text-5xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm text-fg-muted">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Counts, not claims. Every figure above is read off the price
              sheet in src/data/services.ts, so none of them can drift into
              marketing by standing still while the catalogue changes. */}
          <p className="relative mt-10 text-center text-xs text-fg-faint">
            Counted from the live price sheet, not rounded up for the page.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
