import { ArrowRight, MousePointerClick, Sparkles } from "lucide-react";
import dashboardPreview from "../../assets/dashboard-preview.webp";
import { CHEAPEST_USD, SERVICE_COUNT } from "../../data/services";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-yellow-400/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl px-6 pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-fg-muted">
          <MousePointerClick className="h-4 w-4 text-yellow-400" />
          AI-run, not AI-assisted
        </span>

        <h1 className="animate-fade-up mt-8 font-display text-5xl leading-[1.05] font-semibold tracking-tight text-fg sm:text-6xl md:text-7xl">
          Launch a real, working <span className="text-yellow-400">business</span> — not just a website.
        </h1>

        <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg text-fg-muted sm:text-xl">
          Websites, brand, marketing, bookkeeping, audits and custom AI agents. {SERVICE_COUNT} services
          across six disciplines, scoped properly and priced in the open — from ${CHEAPEST_USD} for a logo
          to a full multi-agent business system.
        </p>

        <p className="animate-fade-up mx-auto mt-4 max-w-2xl text-base text-fg-muted">
          This is the long-scope side of AgenticCore. Real work takes real time, and every quote says
          how long before you pay a cent.
        </p>

        <div className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/signup.html"
            className="group inline-flex items-center gap-2 rounded-full bg-yellow-400 px-7 py-3.5 text-base font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Start your business
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#services"
            className="inline-flex items-center gap-2 rounded-full border-2 border-border px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-yellow-400/60"
          >
            See all {SERVICE_COUNT} services
          </a>
          <a
            href="/forge.html"
            className="inline-flex items-center gap-2 rounded-full border-2 border-border px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-yellow-400/60"
          >
            <Sparkles className="h-4 w-4 text-yellow-400" />
            Talk to Forge
          </a>
        </div>

        <p className="animate-fade-up mt-4 text-xs text-fg-faint">
          Paid in USDT on BNB Smart Chain. One invoice per job — no subscription, no credits.
        </p>

        {/* An illustration, not a screenshot. It makes no claim to be the
            real dashboard, so it cannot go stale the way a hand-built mock
            of one does every time the catalogue moves. */}
        <div className="animate-fade-up mx-auto mt-16 max-w-3xl md:mt-20" style={{ animationDelay: "150ms" }}>
          <img src={dashboardPreview} alt="" aria-hidden width={1100} height={867} className="h-auto w-full" />
        </div>
      </div>
    </section>
  );
}
