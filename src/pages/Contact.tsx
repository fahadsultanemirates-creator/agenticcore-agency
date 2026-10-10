import { ArrowRight, Mail, MessageCircle, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicShell } from "../components/PublicShell";
import { SUPPORT_EMAIL, TELEGRAM_HANDLE, TELEGRAM_URL } from "../data/contact";

/**
 * There was no way to reach a person from this site that did not involve
 * creating an account first. For a business asking strangers to send money
 * for custom work, "who are these people and how do I reach them" is a
 * reasonable question to be able to answer before signing up.
 *
 * Deliberately no response-time promise. One would be a commitment the
 * owner has not made, and an unmet "we reply within an hour" is worse than
 * no number at all.
 */
export function Contact() {
  return (
    <PublicShell title="Contact">
      <article className="py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-cyan-400 uppercase">
            Talk to a person
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Contact us
          </h1>
          <p className="mt-3 text-fg-muted">
            No account needed. If you are weighing up a project and want to ask something first,
            any of these reaches us.
          </p>
        </div>

        <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Channel
            icon={<Send className="h-5 w-5" aria-hidden />}
            title="Telegram"
            detail={`@${TELEGRAM_HANDLE}`}
            body="The fastest way to reach us, and where an existing project is usually discussed."
            href={TELEGRAM_URL}
            external
          />
          <Channel
            icon={<Mail className="h-5 w-5" aria-hidden />}
            title="Email"
            detail={SUPPORT_EMAIL}
            body="Best for anything with attachments, or if you want a written record."
            href={`mailto:${SUPPORT_EMAIL}`}
            external
          />
          <Channel
            icon={<MessageCircle className="h-5 w-5" aria-hidden />}
            title="Ask Forge"
            detail="On this site"
            body="Our assistant knows the catalogue, the prices and what each service excludes. It will tell you when something needs a person."
            href="/forge"
          />
          <Channel
            icon={<ArrowRight className="h-5 w-5" aria-hidden />}
            title="Start a project"
            detail="Scope and price first"
            body="Describe what you need and get a written scope and price back. Nothing is charged until you accept it."
            href="/request"
          />
        </div>

        <div className="mt-12 max-w-2xl rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-fg">Two things worth knowing</h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-fg-muted">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
              <span>
              We will never ask you for a password or a login code. If someone does, in our name,
              it is not us.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
              <span>
              If what you need is really a quick logo or a short video, or bookkeeping and
              back-office work, we will say so and point you to{" "}
              <a
                href="https://agenticcore.click"
                className="font-semibold text-cyan-400 hover:underline"
              >
                .click
              </a>{" "}
              or{" "}
              <a
                href="https://agenticcore.biz"
                className="font-semibold text-cyan-400 hover:underline"
              >
                .biz
              </a>{" "}
              rather than sell you the wrong thing.
              </span>
            </li>
          </ul>
        </div>
      </article>
    </PublicShell>
  );
}

function Channel({
  icon,
  title,
  detail,
  body,
  href,
  external = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  body: string;
  href: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-2 text-cyan-400">
        {icon}
        <span className="font-display text-base font-semibold text-fg">{title}</span>
      </span>
      <span className="mt-1 block text-sm font-medium text-cyan-400">{detail}</span>
      <span className="mt-2 block text-sm leading-relaxed text-fg-muted">{body}</span>
    </>
  );

  const className =
    "block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-cyan-400/40";

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link to={href} className={className}>
      {inner}
    </Link>
  );
}
