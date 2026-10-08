import { ArrowRight, Check } from "lucide-react";
import { AGENTICCORE_PACKAGE } from "../../data/services";
import { Reveal } from "../Reveal";
import { Link } from "react-router-dom";

// One bundle, not a tier ladder. The three-tier Low/Mid/High system was
// already removed from the price sheet; selling it again here would be
// the site contradicting its own catalogue.
const INCLUDED = [
  "A multi-page website, written, designed and deployed",
  "Logo and a brand style guide to match",
  "A social media post pack to launch with",
  "Business card, letterhead and receipt design",
  "A marketing strategy and feasibility plan",
  "Invoicing and receipts set up and ready to use",
];

export function PackageSection() {
  return (
    <section id="package" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          Or take the whole thing at once
        </h2>
        <p className="mt-4 text-lg text-fg-muted">
          Everything a business needs to open its doors, bought together instead of one piece at a
          time.
        </p>
      </div>

      <Reveal>
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-400/10 to-transparent p-7 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
          />
          <div className="relative">
            <p className="text-xs font-semibold tracking-wide text-yellow-400 uppercase">
              The one bundle
            </p>
            <h3 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">
              {AGENTICCORE_PACKAGE.label}
            </h3>
            <p className="mt-2 font-display text-5xl font-semibold text-yellow-400">
              ${AGENTICCORE_PACKAGE.priceUsd}
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              Bought separately these come to well over ${AGENTICCORE_PACKAGE.priceUsd * 2}.
            </p>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-fg-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              to="/request?package=1"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5"
            >
              See what's included
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
