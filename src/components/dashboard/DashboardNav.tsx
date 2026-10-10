import {
  FileText,
  FolderKanban,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { NavLink } from "react-router-dom";

/**
 * The ten areas, as a horizontal scrolling strip.
 *
 * Not a left rail. The legacy dashboard pinned one down the side of every
 * page and it ate a third of a phone screen before any content drew,
 * which is why it was removed. Ten destinations still need to be
 * reachable from each other though, so they sit in a strip under the
 * header that scrolls sideways on a phone and fits on one line above it.
 *
 * Three of these are the public pages — services, packages and Forge.
 * They are listed because a client looking for "where do I order" should
 * find it here rather than having to leave the dashboard and come back,
 * and they work signed out anyway.
 */
type Area = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number };

export function DashboardNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const AREAS: Area[] = [
    { to: "/dashboard", label: "Overview", icon: LayoutGrid, end: true },
    { to: "/services", label: "Browse Services", icon: ShoppingBag },
    { to: "/packages", label: "Packages", icon: Package },
    { to: "/projects", label: "My Projects", icon: FolderKanban },
    { to: "/forge", label: "Create with Forge", icon: Sparkles },
    { to: "/orders", label: "Orders", icon: FileText },
    { to: "/messages", label: "Messages", icon: MessageSquare, badge: unreadMessages },
    { to: "/invoices", label: "Invoices & Payments", icon: Receipt },
    { to: "/files", label: "Files & Deliverables", icon: FolderKanban },
    { to: "/account", label: "Account Settings", icon: Settings },
  ];

  return (
    <nav
      aria-label="Dashboard sections"
      // -mx-4 plus px-4 lets the strip bleed to the screen edge on a
      // phone, so the last item does not look clipped mid-word.
      className="-mx-4 mb-2 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6"
    >
      <ul className="flex min-w-max items-center gap-1 py-2">
        {AREAS.map((area) => (
          <li key={area.to}>
            <NavLink
              to={area.to}
              end={area.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-cyan-400/10 text-cyan-400"
                    : "text-fg-muted hover:bg-surface hover:text-fg"
                }`
              }
            >
              <area.icon className="h-4 w-4 shrink-0" />
              {area.label}
              {area.badge ? (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[11px] font-bold text-void">
                  {area.badge}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
