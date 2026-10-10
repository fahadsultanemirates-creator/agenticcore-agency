const FAQS = [
  {
    q: "Can I purchase a single service?",
    a: "Yes. Every service is available on its own; the packages are optional bundles.",
  },
  {
    q: "Are prices fixed?",
    a: "Standard services have a defined scope at a fixed price. Anything marked “From” starts at the published rate and gets a reviewed quotation once the scope is agreed.",
  },
  {
    q: "Can Forge plan my project?",
    a: "Forge helps clarify your requirements and prepare a structured project brief. It suggests services from the real catalogue, but it does not issue a binding quote — a person reviews and prices the work.",
  },
  {
    q: "Do you build custom AI agents?",
    a: "Yes — single-task agents, website chatbots, voice assistants and multi-agent frameworks. Each is scoped before it is built, and a person reviews anything consequential before it goes out.",
  },
  {
    q: "Can I own my project's source code?",
    a: "Handover and ownership depend on the agreed scope and on any third-party licences involved. Some platforms and assets are not ours to transfer, and the quotation says which.",
  },
  {
    q: "Are hosting and API costs included?",
    a: "Only when the quotation or package explicitly lists them. Model usage, hosting, domains and third-party subscriptions are normally billed to you by those providers.",
  },
  {
    q: "Can I track development?",
    a: "Yes, through your dashboard — status, milestones and messages against the project.",
  },
  {
    q: "Can I order quick images and small creative tasks?",
    a: "AgenticCore.click specialises in fast, affordable digital tasks like logos, images, documents and short videos. It will be cheaper and quicker there.",
  },
  {
    q: "Do you provide ongoing bookkeeping and administration?",
    a: "AgenticCore.biz handles those. Agency can build the tools and automations behind them, but does not run them day to day.",
  },
  {
    q: "Can you integrate my existing business software?",
    a: "Usually, yes — through a supported API, application or MCP-compatible tool. Tell us which systems and we will confirm before quoting.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Questions, answered plainly.
        </h2>

        <div className="mt-8 flex flex-col gap-2">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-cyan-400/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg">
                {faq.q}
                <span
                  aria-hidden
                  className="shrink-0 text-cyan-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
