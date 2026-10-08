import { ArrowRight } from "lucide-react";
import { Reveal } from "../Reveal";
import { Link } from "react-router-dom";

export function CtaBanner() {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 md:pb-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-yellow-400 px-6 py-16 text-center sm:px-12">
          <h2 className="relative font-display text-4xl font-semibold tracking-tight text-void sm:text-5xl">
            Ready to start?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-void/80">
            Open an account, describe the job, and you get a scope and a price back before anything
            is charged.
          </p>
          <Link
            to="/signup"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-void px-7 py-3.5 text-base font-semibold text-fg transition-transform hover:-translate-y-0.5"
          >
            Create your account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
