import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../Logo";

/**
 * The frame every auth page shares: logo, card, footer line.
 *
 * The legacy pages each rebuilt this, which is how login.html and
 * signup.html ended up with differently sized cards.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-void px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-7">
          <h1 className="font-display text-2xl font-semibold text-fg">{title}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
      </div>
    </div>
  );
}

/** Shared input styling, so every auth field looks like the others. */
export const authFieldClass =
  "rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none";

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{children}</span>;
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
