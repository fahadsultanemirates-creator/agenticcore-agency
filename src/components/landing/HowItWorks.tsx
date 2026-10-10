import { ClipboardCheck, FileSearch, MessageSquarePlus, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: MessageSquarePlus,
    title: "Describe Your Requirements",
    detail: "Choose a service, or explain the idea to Forge in your own words.",
  },
  {
    icon: FileSearch,
    title: "Review the Scope",
    detail: "You get a proposed specification, deliverables, a price and a timeline before anything is charged.",
  },
  {
    icon: ClipboardCheck,
    title: "Approve Your Project",
    detail: "Confirm the scope, then pay the deposit in USDT on BNB Smart Chain to start the work.",
  },
  {
    icon: Rocket,
    title: "Track Development & Receive Your Work",
    detail: "Follow progress in your dashboard and receive the deliverables you agreed.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
        From Your Idea to a Working Digital Solution.
      </h2>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                <step.icon className="h-5 w-5 text-cyan-400" strokeWidth={2.25} />
              </span>
              <span className="font-display text-sm font-semibold text-fg-faint">
                Step {index + 1}
              </span>
            </div>
            <h3 className="mt-3 font-display text-base font-semibold text-fg">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
