import { ArrowRight, CheckCircle2, Cpu, MessageSquare, UserCheck, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice, serviceById } from "../../data/catalog";

/**
 * The AI section.
 *
 * The flow below ends at a review step on purpose, and the copy says a
 * person signs off. An agent diagram that runs Request → Agent → Done
 * is selling unsupervised authority over somebody's business, which is
 * not what AG-15 or AG-16 are, and not something that should be implied
 * in a graphic the customer reads before the scope.
 */
const FLOW = [
  { icon: MessageSquare, label: "Customer request" },
  { icon: Cpu, label: "AI agent" },
  { icon: Wrench, label: "Connected tools" },
  { icon: UserCheck, label: "Human review" },
  { icon: CheckCircle2, label: "Result" },
];

export function AiShowcase() {
  const single = serviceById("AG-15");
  const multi = serviceById("AG-16");

  return (
    <section id="ai" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Don't Just Use AI. <span className="text-cyan-400">Put It to Work.</span>
          </h2>
          <p className="mt-4 text-fg-muted">
            Build specialised AI systems to process information, respond to enquiries, coordinate
            workflows, prepare documents and assist your team with routine tasks.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {single ? (
              <OfferPill
                name="Single-Task AI Agent"
                price={formatPrice(single)}
                to={`/services/${single.id}`}
              />
            ) : null}
            {multi ? (
              <OfferPill
                name="Multi-Agent Framework"
                price={formatPrice(multi)}
                to={`/services/${multi.id}`}
              />
            ) : null}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/services?capability=ai"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5"
            >
              Explore AI Agents
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/forge"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-border px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-cyan-400/60"
            >
              Describe Your Automation Project
            </Link>
          </div>
        </div>

        <ol className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          {FLOW.map((step, index) => (
            <li key={step.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                <step.icon className="h-4 w-4 text-cyan-400" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-fg">{step.label}</span>
              {index < FLOW.length - 1 ? (
                <span aria-hidden className="text-fg-faint">
                  ↓
                </span>
              ) : null}
            </li>
          ))}
          <li className="mt-2 border-t border-border pt-3 text-xs text-fg-faint">
            A person reviews before anything leaves the system. Agents we build do not approve
            payments or make commitments on your behalf.
          </li>
        </ol>
      </div>
    </section>
  );
}

function OfferPill({ name, price, to }: { name: string; price: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 items-baseline justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-cyan-400/50"
    >
      <span className="text-sm font-semibold text-fg">{name}</span>
      <span className="font-display text-sm font-semibold whitespace-nowrap text-cyan-400">
        {price}
      </span>
    </Link>
  );
}
