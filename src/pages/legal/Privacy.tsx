import { Bullets, Clause, LegalLayout } from "./LegalLayout";

export function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      eyebrow="Last updated 2026"
      intro="What we collect, why we collect it, and how it is kept."
    >
      <Clause heading="What we collect">
        <Bullets
          items={[
            "Account information — your email and password. The password is handled by our authentication provider; we never see or store it.",
            "Project details — the descriptions, files and requirements you submit with a request or a package order.",
            "Payment information — for USDT payments, the on-chain transaction and the amount. We do not process or store card numbers.",
            "Communications — messages through the dashboard, Telegram, WhatsApp or the on-site assistant, so we can respond and keep a record of what was agreed.",
            "Basic usage data — standard technical information such as browser type and access logs, to keep the service running and secure.",
          ]}
        />
      </Clause>

      <Clause heading="How we use it">
        <p>
          Strictly to run your projects: scoping and delivering the work you request, verifying
          payment, and communicating with you about your account. We do not use your information
          for anything beyond operating AgenticCore.
        </p>
      </Clause>

      <Clause heading="Access you give us to your own systems">
        <p>
          Some projects need access to systems you own — a repository, a hosting account, an API.
          We ask for the narrowest access that does the job, use it only for the agreed work, and
          you can withdraw it at any time from the service itself. Where a project involves
          credentials, they are held server-side and never placed in anything the browser can read.
        </p>
      </Clause>

      <Clause heading="What we don't do">
        <p>
          We don't sell your data. We don't share it with third parties except the service
          providers that keep AgenticCore running — our database, authentication and hosting
          providers — and only as far as providing the service requires.
        </p>
        <p>
          We don't send your project details to our sister sites. If what you need is better suited
          to AgenticCore.click or AgenticCore.biz we will say so and give you the link; taking it
          there is your decision, and you carry the details across yourself.
        </p>
      </Clause>

      <Clause heading="How long we keep it">
        <p>
          We keep account and project data while your account is active, and afterwards as far as
          legal, accounting or dispute-resolution obligations require.
        </p>
      </Clause>

      <Clause heading="Your choices">
        <p>
          You can ask for a copy of what we hold, ask us to correct it, or ask for your account and
          data to be deleted — email{" "}
          <a href="mailto:hello@agenticcore.agency" className="font-semibold text-cyan-400 hover:underline">
            hello@agenticcore.agency
          </a>
          .
        </p>
      </Clause>
    </LegalLayout>
  );
}
