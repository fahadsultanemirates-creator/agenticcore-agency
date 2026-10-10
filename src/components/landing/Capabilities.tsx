import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { capabilities } from "../../data/catalog";

/**
 * The four front doors.
 *
 * Four cards over three catalogue categories, because "AI agents" and
 * "integrations" are different questions in a visitor's head even though
 * both are automation work. Each card carries real service ids and links
 * into the directory filtered by them, so a card can never advertise
 * something the catalogue does not sell -- there is a test for that.
 */
export function Capabilities() {
  return (
    <section id="capabilities" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
        Everything You Need to Build Your Digital Business.
      </h2>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((capability) => (
          <Link
            key={capability.id}
            to={`/services?capability=${capability.id}`}
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-surface-2"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 transition-colors duration-200 group-hover:bg-cyan-400/20">
              <capability.icon className="h-5 w-5 text-cyan-400" strokeWidth={2.25} />
            </span>

            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-fg">{capability.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{capability.blurb}</p>
            </div>

            <span className="mt-auto flex items-center gap-1.5 pt-1 text-sm font-semibold text-cyan-400">
              {capability.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
