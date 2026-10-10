import { Mail } from "lucide-react";
import type { ComponentType } from "react";
import { TELEGRAM_URL } from "../../data/contact";
import { Link } from "react-router-dom";
import { Logo } from "../Logo";
import { FacebookIcon, InstagramIcon, XIcon, YouTubeIcon } from "../icons/SocialIcons";
import { TelegramIcon } from "../icons/TelegramIcon";

// Every link here is one that already existed on the pre-React pages.
// A footer that invents a channel nobody runs is a dead end with a logo.
const SOCIALS: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { href: "https://x.com/AgenticCoreHQ", label: "X", icon: XIcon },
  { href: "https://www.facebook.com/share/1HppKFetgD/", label: "Facebook", icon: FacebookIcon },
  { href: "https://instagram.com/agenticcore.agency", label: "Instagram", icon: InstagramIcon },
  { href: "https://youtube.com/@AgenticcoreAgency", label: "YouTube", icon: YouTubeIcon },
];

const LEGAL = [
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

// The sister brands, described as what they actually are now. .biz was
// labelled "marketing", which stopped being true when it was
// repositioned around business operations.
const ELSEWHERE = [
  { href: "https://agenticcore.click", label: "agenticcore.click — fast, standardised digital tasks" },
  { href: "https://agenticcore.biz", label: "agenticcore.biz — business setup and back-office" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-void px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10">
        <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo variant="lockup" />
            <p className="text-sm text-fg-faint">
              The technology-development side of the AgenticCore family.
            </p>
          </div>

          <nav className="flex items-center gap-6 text-sm text-fg-muted">
            {LEGAL.map((link) => (
              <Link key={link.href} to={link.href} className="transition-colors hover:text-fg">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold tracking-wide text-fg-faint uppercase">Need help?</p>
          <div className="flex items-center gap-3">
            <a
              href="mailto:hello@agenticcore.agency"
              aria-label="Email us"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-void transition-transform hover:-translate-y-0.5"
            >
              <Mail className="h-5 w-5" />
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Support on Telegram"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-void transition-transform hover:-translate-y-0.5"
            >
              <TelegramIcon className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold tracking-wide text-fg-faint uppercase">Follow us</p>
          <div className="flex items-center gap-3">
            {SOCIALS.map((social) => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
              >
                <social.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-xs text-fg-faint">
          {ELSEWHERE.map((site) => (
            <a key={site.href} href={site.href} className="transition-colors hover:text-fg-muted">
              {site.label}
            </a>
          ))}
        </div>

        <p className="text-xs text-fg-faint">
          © {new Date().getFullYear()} agenticcore.agency
        </p>
      </div>
    </footer>
  );
}
