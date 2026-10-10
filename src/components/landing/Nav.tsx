import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountMenu } from "../AccountMenu";
import { Logo } from "../Logo";

// Routes first, then in-page anchors. The old nav pointed "Services" at
// an anchor on the homepage, which meant there was no way to reach the
// full catalogue from anywhere else on the site.
const LINKS: { to: string; label: string; anchor?: boolean }[] = [
  { to: "/services", label: "Services" },
  { to: "/services?capability=ai", label: "AI & Automation" },
  { to: "/packages", label: "Packages" },
  { to: "/#how-it-works", label: "How It Works", anchor: true },
  { to: "/forge", label: "Create a Project" },
  { to: "/#family", label: "AgenticCore Family", anchor: true },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-void/85 backdrop-blur transition-colors duration-300 ${
        scrolled || menuOpen ? "border-border" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" aria-label="AgenticCore Agency home" className="shrink-0">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:block" />
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-fg-muted xl:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group relative whitespace-nowrap transition-colors hover:text-fg"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-cyan-400 transition-all duration-200 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* The brief's primary header CTA, but only once there is
              genuinely room for it. At exactly 1280px -- where the six
              nav links first appear -- the links, this button and the
              signed-out Log in / Get started pair came to 1290px and
              pushed the page into horizontal scroll. Below 2xl it lives
              in the mobile menu instead, and "Create a Project" is
              already among the links. */}
          <Link
            to="/request"
            className="hidden rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold whitespace-nowrap text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 2xl:inline-flex"
          >
            Start Your Project
          </Link>
          <AccountMenu />
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg xl:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="animate-fade-up border-t border-border bg-void px-4 pb-4 sm:px-6 xl:hidden">
          <ul className="flex flex-col py-2">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-3 font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              <Link
                to="/request"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl bg-cyan-400 px-3 py-3 text-center font-semibold text-void"
              >
                Start Your Project
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
