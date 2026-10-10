import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The three brands, each in its own colour.
 *
 * .click stays yellow and .biz stays orange here, on Agency's cyan page,
 * deliberately. These cards are the one place all three appear together,
 * and painting them all cyan would lose the only visual cue that says
 * they are different companies doing different work.
 */
const BRANDS = [
  {
    id: "click",
    name: "AgenticCore.click",
    headline: "Need something done fast?",
    description:
      "Affordable, standardised digital tasks including quick websites, images, documents, logos, videos and other creative services.",
    note: "Selected services offer estimated turnaround times as fast as 20 minutes.",
    cta: "Visit AgenticCore.click",
    href: "https://agenticcore.click",
    // Hard-coded hexes rather than Tailwind colour classes: Agency's theme
    // defines cyan only, and the sister brands' yellow and orange are not
    // in its token set. Inventing tokens for two colours used in one
    // component would put three palettes in the stylesheet for ever.
    accent: "#ffd400",
    tint: "rgba(255, 212, 0, 0.1)",
    border: "rgba(255, 212, 0, 0.35)",
  },
  {
    id: "biz",
    name: "AgenticCore.biz",
    headline: "Need help running your business?",
    description:
      "Business planning, administration, bookkeeping assistance, customer management, back-office operations and ongoing business support.",
    note: null,
    cta: "Visit AgenticCore.biz",
    href: "https://agenticcore.biz",
    accent: "#fb7701",
    tint: "rgba(251, 119, 1, 0.1)",
    border: "rgba(251, 119, 1, 0.35)",
  },
  {
    id: "agency",
    name: "AgenticCore.agency",
    headline: "Need custom technology?",
    description:
      "Professional websites, custom applications, AI agents, dashboards, integrations and intelligent automation.",
    note: "You are here.",
    cta: "Explore Agency Services",
    href: "/services",
    accent: "#00e5ee",
    tint: "rgba(0, 229, 238, 0.1)",
    border: "rgba(0, 229, 238, 0.35)",
  },
];

export function FamilySection() {
  return (
    <section id="family" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
        Three Specialisations. One Connected AgenticCore Ecosystem.
      </h2>
      <p className="mt-2 max-w-xl text-fg-muted">
        If what you need is somebody else's speciality, we will say so.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {BRANDS.map((brand) => {
          const internal = brand.href.startsWith("/");
          const body = (
            <>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase"
                style={{ backgroundColor: brand.tint, color: brand.accent }}
              >
                {brand.name}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-fg">{brand.headline}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{brand.description}</p>
              {brand.note ? <p className="mt-3 text-xs text-fg-faint">{brand.note}</p> : null}
              <span
                className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold"
                style={{ color: brand.accent }}
              >
                {brand.cta}
                {internal ? (
                  <ArrowRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
              </span>
            </>
          );

          const className =
            "flex flex-col rounded-2xl border bg-surface p-6 transition-transform hover:-translate-y-1";

          return internal ? (
            <Link
              key={brand.id}
              to={brand.href}
              className={className}
              style={{ borderColor: brand.border }}
            >
              {body}
            </Link>
          ) : (
            <a
              key={brand.id}
              href={brand.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              style={{ borderColor: brand.border }}
            >
              {body}
            </a>
          );
        })}
      </div>
    </section>
  );
}
