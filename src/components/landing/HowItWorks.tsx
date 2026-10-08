import { FileSearch, Handshake, PackageCheck, Wallet } from "lucide-react";
import { Reveal } from "../Reveal";

// Four steps, not .click's three. The extra one is the quote, and it is
// the whole difference between the two businesses: a $5 logo can be
// priced from a price list, and a $1,000 multi-agent framework cannot.
const steps = [
  {
    icon: FileSearch,
    title: "Tell us the job",
    body: "What the business is, what it needs, and what done looks like. A paragraph beats a form.",
  },
  {
    icon: Handshake,
    title: "Get a scope and a price",
    body: "A written scope with the real figure and a real timeline. Nothing starts until you agree to both.",
  },
  {
    icon: Wallet,
    title: "Pay the invoice in USDT",
    body: "One invoice for that job, on BNB Smart Chain. No subscription, no credits, no card.",
  },
  {
    icon: PackageCheck,
    title: "Get the work",
    body: "Delivered to your dashboard and to Telegram, with the files you own outright.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          Four steps. Still no meetings.
        </h2>
        <p className="mt-4 text-lg text-fg-muted">
          You see the scope and the price before anything is charged, and the timeline before you
          commit to it.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 100}>
            <div className="group relative h-full rounded-2xl border border-border bg-surface p-7 transition-all duration-200 hover:-translate-y-1 hover:border-yellow-400/40">
              <span className="absolute -top-4 -left-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-void font-display text-sm font-semibold text-fg">
                {i + 1}
              </span>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 transition-colors duration-200 group-hover:bg-yellow-400/20">
                <step.icon className="h-6 w-6 text-yellow-400" strokeWidth={2.25} />
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{step.title}</h3>
              <p className="mt-2 text-fg-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
