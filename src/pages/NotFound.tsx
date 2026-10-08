import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-void px-6 text-center">
      <Link to="/">
        <Logo />
      </Link>
      <div>
        <p className="font-display text-5xl font-semibold text-yellow-400">404</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-fg">Nothing here</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          That page doesn't exist, or it moved when the site was rebuilt.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
        >
          Home
        </Link>
        <Link
          to="/dashboard"
          className="rounded-full border-2 border-border px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-yellow-400/50"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
