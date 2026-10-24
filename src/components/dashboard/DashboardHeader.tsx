import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AccountMenu } from "../AccountMenu";
import { Logo } from "../Logo";

type Props = {
  /** Current page name, or null on the dashboard root. */
  crumb: string | null;
  backTo: string;
  backLabel: string;
};

export function DashboardHeader({ crumb, backTo, backLabel }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-void/90 backdrop-blur">
      {/* gap-1.5/px-3 under sm. /request is public now, so a signed-out
          visitor sees Maya + Log in + Get started in here, and at 390px
          that row was 10px wider than the viewport -- every element in the
          header is shrink-0, so nothing gave way and the page scrolled
          sideways. Tightening the two smallest-screen gaps buys ~16px and
          keeps every entry point. */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5 px-3 py-3 sm:gap-3 sm:px-6">
        <Link
          to={backTo}
          aria-label={`Back to ${backLabel}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg sm:px-3.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>

        <Link to="/dashboard" aria-label="Dashboard" className="min-w-0 shrink-0">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:block" />
        </Link>

        {crumb && (
          <span className="hidden min-w-0 items-center gap-2 text-sm text-fg-faint md:flex">
            <span aria-hidden>/</span>
            <span className="truncate font-medium text-fg-muted">{crumb}</span>
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to="/maya"
            title="Talk to Maya"
            className="hidden h-9 items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/20 min-[380px]:flex sm:px-3.5"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Maya</span>
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
