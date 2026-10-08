import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";

type Props = {
  /** Page name — the header crumb, and the browser tab title. */
  title: string;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
};

/**
 * One frame for every page behind the login.
 *
 * Deliberately not the legacy left rail. That sidebar pinned a 64–256px
 * column down the side of every page, which on a phone -- most of the
 * traffic -- ate a third of the screen before any content was drawn, and
 * it duplicated the service list that the dashboard's own grid already
 * shows. Navigation lives in the grid; the frame is a slim sticky header
 * and the page scrolls normally underneath it.
 */
export function DashboardShell({ title, children, backTo, backLabel }: Props) {
  const { pathname } = useLocation();
  const isRoot = pathname === "/dashboard";

  // On the dashboard itself, "back" means out to the public site. The
  // legacy pages called this "Exit", which read like logging out.
  const resolvedBackTo = backTo ?? (isRoot ? "/" : "/dashboard");
  const resolvedBackLabel = backLabel ?? (isRoot ? "Home" : "Dashboard");

  useEffect(() => {
    document.title = isRoot ? "Dashboard — agenticcore.agency" : `${title} — agenticcore.agency`;
  }, [title, isRoot]);

  return (
    <div className="min-h-screen bg-void">
      <DashboardHeader crumb={isRoot ? null : title} backTo={resolvedBackTo} backLabel={resolvedBackLabel} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
