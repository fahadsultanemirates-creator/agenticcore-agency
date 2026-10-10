import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicShell } from "../../components/PublicShell";

export function LegalLayout({
  title,
  eyebrow,
  intro,
  children,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <PublicShell title={title}>
      <article className="py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-cyan-400 uppercase">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-fg-muted">{intro}</p>
        </div>

        <div className="mt-10 flex max-w-2xl flex-col gap-8">{children}</div>

        <p className="mt-12 max-w-2xl text-sm text-fg-muted">
          Questions about any of this?{" "}
          <a
            href="mailto:hello@agenticcore.agency"
            className="font-semibold text-cyan-400 hover:underline"
          >
            hello@agenticcore.agency
          </a>{" "}
          or{" "}
          <Link to="/forge" className="font-semibold text-cyan-400 hover:underline">
            ask Forge
          </Link>
          .
        </p>
      </article>
    </PublicShell>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-fg">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}
