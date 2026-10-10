import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export function CtaBanner() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Your Next Digital Project Starts Here.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-fg-muted">
          Whether you're launching a professional website or developing an intelligent business
          system, tell us what you need and get a clear path forward.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/request"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 text-base font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 sm:w-auto"
          >
            Start Your Project
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/forge"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-border px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-cyan-400/60 sm:w-auto"
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Talk to Forge
          </Link>
        </div>
      </div>
    </section>
  );
}
