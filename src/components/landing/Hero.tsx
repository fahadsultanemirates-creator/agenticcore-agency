import { ArrowRight, Cpu, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import dashboardPreview from "../../assets/dashboard-preview.webp";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl px-6 pt-16 pb-20 text-center md:pt-24 md:pb-28">
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold tracking-wide text-fg-muted uppercase sm:text-sm">
          <Cpu className="h-4 w-4 shrink-0 text-cyan-400" />
          Custom technology. Built for your business.
        </span>

        <h1 className="animate-fade-up mt-8 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-fg sm:text-6xl md:text-7xl">
          We Build the Technology <span className="text-cyan-400">Behind Your Business.</span>
        </h1>

        <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg text-fg-muted sm:text-xl">
          Websites. Applications. AI Agents. Automation.
        </p>

        <p className="animate-fade-up mx-auto mt-4 max-w-2xl text-base text-fg-muted">
          Launch a professional website, build a custom application, automate business workflows or
          create intelligent AI agents — with affordable starting prices, defined deliverables and a
          project dashboard that keeps everything organised.
        </p>

        <div className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/services"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 text-base font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
          >
            Explore Our Services
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/forge"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-border px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-cyan-400/60 sm:w-auto"
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Create a Project with Forge
          </Link>
        </div>

        {/* Two real catalogue floors, named because "affordable" on its own
            is not a price. Both are asserted in catalog.test.ts. */}
        <p className="animate-fade-up mt-5 text-sm text-fg-muted">
          Professional websites from <span className="font-semibold text-fg">$49</span>. Custom AI
          agents from <span className="font-semibold text-fg">$149</span>.
        </p>

        {/* An illustration, not a screenshot. It makes no claim to be the
            real dashboard, so it cannot go stale the way a hand-built mock
            of one does every time the catalogue moves. */}
        <div
          className="animate-fade-up mx-auto mt-14 max-w-3xl md:mt-20"
          style={{ animationDelay: "150ms" }}
        >
          <img src={dashboardPreview} alt="" aria-hidden width={1100} height={867} className="h-auto w-full" />
        </div>
      </div>
    </section>
  );
}
