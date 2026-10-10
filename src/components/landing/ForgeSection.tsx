import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const EXAMPLES = [
  "I need a professional website for my consulting business.",
  "Build a customer dashboard with login and order tracking.",
  "I need a Telegram bot that organises customer requests.",
  "I want an AI assistant that answers questions about my business.",
  "Automate repetitive tasks between my CRM and other tools.",
  "Build a multi-agent framework with specialised agents.",
];

export function ForgeSection() {
  return (
    <section id="forge" className="border-t border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" /> Forge
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              Have an Idea? Let Forge Help You Build It.
            </h2>
            <p className="mt-4 text-fg-muted">
              Describe the website, application or automation you want. Forge helps clarify your
              requirements, identify the right services and prepare a structured project brief.
            </p>
            {/* What it does not do, said here rather than discovered later.
                Forge drafts a brief; a person prices it. */}
            <p className="mt-3 text-sm text-fg-faint">
              Forge prepares the brief and suggests services from the catalogue. It does not issue
              a binding quote or take payment — a person reviews the scope and prices it.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/forge"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
              >
                Create a Project with Forge
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-cyan-400/60"
              >
                Browse Technical Services
              </Link>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <Link
                  to={`/forge?prompt=${encodeURIComponent(example)}`}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
                >
                  “{example}”
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
