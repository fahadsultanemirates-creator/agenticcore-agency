import { Reveal } from "../Reveal";

// The things worth knowing before paying, said plainly. The full terms
// are still a page; this is the part people actually need.
const POINTS = [
  {
    heading: "You see the price before you pay",
    body: "Every service has a published figure, and bigger work gets a written scope with a real number and a real timeline. Nothing is charged until you agree to both.",
  },
  {
    heading: "One invoice per job",
    body: "Paid in USDT on BNB Smart Chain. No subscription, no credits that expire, no card on file. When a job is done you pay for that job.",
  },
  {
    heading: "Nothing here takes twenty minutes",
    body: "A logo is a day or two; a multi-agent framework is weeks. The card for each category says how long, and we would rather tell you up front than apologise later.",
  },
  {
    heading: "The work is yours",
    body: "Files, source, accounts — handed over outright. Frameworks can be hosted by us or handed over for you to run, and that is a price on the sheet, not a negotiation.",
  },
];

export function TermsSummary() {
  return (
    <section id="terms" className="bg-surface/40 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
            Before you order
          </h2>
          <p className="mt-4 text-lg text-fg-muted">
            The four things worth knowing, without reading the terms page.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {POINTS.map((point, i) => (
            <Reveal key={point.heading} delay={(i % 2) * 80}>
              <div className="h-full rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-lg font-semibold text-fg">{point.heading}</h3>
                <p className="mt-2 text-sm text-fg-muted">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-fg-faint">
          The full version is on the{" "}
          <a href="/terms.html" className="font-semibold text-yellow-400 hover:underline">
            terms page
          </a>
          .
        </p>
      </div>
    </section>
  );
}
