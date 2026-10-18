import { Mail } from "lucide-react";
import type { ComponentType } from "react";
import { SOCIAL_LINKS, SUPPORT_EMAIL, TELEGRAM_URL, whatsAppUrl, type SocialKey } from "../../data/contact";
import { Link } from "react-router-dom";
import { Logo } from "../Logo";
import { FacebookIcon, InstagramIcon, TikTokIcon, XIcon, YouTubeIcon } from "../icons/SocialIcons";
import { TelegramIcon } from "../icons/TelegramIcon";
import { WhatsAppIcon } from "../icons/WhatsAppIcon";

// The accounts themselves live in data/contact.ts, shared with .biz and
// .click so the three footers cannot drift apart. Only the drawing of
// them is local.
//
// Record<SocialKey, ...> rather than a loose lookup: adding an account to
// that list without giving it an icon here fails the build instead of
// rendering a hole.
const ICONS: Record<SocialKey, ComponentType<{ className?: string }>> = {
  x: XIcon,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  "telegram-channel": TelegramIcon,
};

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
              href={`mailto:${SUPPORT_EMAIL}`}
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
            {/* Support, not ordering. The project/order bot is a separate
                destination and is not linked from here. */}
            {whatsAppUrl() ? (
              <a
                href={whatsAppUrl() as string}
                target="_blank"
                rel="noreferrer"
                aria-label="Support on WhatsApp"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-void transition-transform hover:-translate-y-0.5"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold tracking-wide text-fg-faint uppercase">Follow us</p>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => {
              const Icon = ICONS[social.key];
              return (
                <a
                  key={social.key}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
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
