import { Bullets, Clause, LegalLayout } from "./LegalLayout";

/**
 * Ported from public/terms.html, with two corrections that were not
 * styling.
 *
 * The old page promised "simple services are typically delivered within
 * 24 hours" and described billing for "the AgenticCore Package". Neither
 * is true any more: nothing Agency builds lands in a day, and that $150
 * package is retired. Leaving them would have meant customers agreeing
 * to terms the catalogue contradicts.
 */
export function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      eyebrow="Read before you order"
      intro="How delivery, payment, ownership and liability work — the important parts, in one place, without the usual legal padding."
    >
      <Clause heading="Delivery timeframes">
        <Bullets
          items={[
            "Every service carries its own delivery estimate, shown on the service page before you order. The quickest are a few working days.",
            "Larger builds — full websites, custom applications and multi-agent frameworks — run to several weeks, and the estimate says so.",
            "Some services are ongoing and billed monthly rather than delivered once.",
            "Estimates start when we have everything the service page lists under “What we need from you”, not when the order is placed.",
          ]}
        />
      </Clause>

      <Clause heading="Prices and quotations">
        <p>
          A service with a fixed price is that price. A service shown as “From” starts at that
          figure and is quoted once the scope is agreed — we put the scope, the price and the
          timeline in writing, and nothing is charged until you accept it.
        </p>
        <p>
          Hosting, domains, model and API usage, messaging fees, platform subscriptions and
          third-party licences are billed to you by those providers. They are not included unless
          your quotation says so explicitly, and each service page lists the ones that apply.
        </p>
      </Clause>

      <Clause heading="Payment">
        <p>
          Every service and every package follows the same structure:{" "}
          <span className="font-semibold text-fg">30% upfront</span> to begin work, and the
          remaining <span className="font-semibold text-fg">70% on completion</span>.
        </p>
        <p>
          Payment is in USDT on BNB Smart Chain (BEP-20). A payment is confirmed by our system
          seeing it on the chain — a screenshot or a transaction hash sent to us is not, by itself,
          confirmation.
        </p>
      </Clause>

      <Clause heading="Revisions">
        <p>
          Each service states its revision rounds on its own page — most include one. Changes
          beyond that, or changes that alter the agreed scope, are quoted separately.
        </p>
      </Clause>

      <Clause heading="Review before handover">
        <p>
          Before your final payment we show you the finished work for review. That is a review, not
          full handover. Once the remaining 70% is paid you get complete handover of everything the
          scope covers.
        </p>
        <p>
          This protects both sides: you see exactly what you are paying for before the balance is
          due, and we are never left having delivered finished work with no payment behind it.
        </p>
      </Clause>

      <Clause heading="Ownership and handover">
        <p>
          Once a project is paid in full, what we built for it — code, designs, copy, and accounts
          or frameworks set up as part of it — is yours. Until then, work in progress and any
          preview access stays ours.
        </p>
        <p>
          Some things are not ours to transfer. Third-party platforms, licensed fonts, stock
          assets, model providers and hosted services remain subject to their own terms, and
          anything in that category is named in your quotation rather than promised as yours.
        </p>
        <p>
          If you cancel partway through, the 30% upfront covers the work already done and is not
          refunded. Anything finished at that point is handed over on request.
        </p>
      </Clause>

      <Clause heading="Cancellation and refunds">
        <Bullets
          items={[
            "Before work starts, the 30% deposit is refundable in full.",
            "Once work has started the deposit covers work already performed and is not refundable, but you are not charged the balance for anything not delivered.",
            "If we cannot deliver what was agreed, you are refunded in full — including the deposit.",
            "Monthly services can be cancelled any time before the next billing date and run to the end of the cycle already paid for. We do not pro-rate part-months.",
            "Where work is delivered and you believe it does not match what was agreed, tell us within 14 days and we will correct it or refund that service.",
          ]}
        />
      </Clause>

      <Clause heading="What AI agents we build will and will not do">
        <p>
          Agents and automations we build operate within the scope agreed, and a person reviews
          anything consequential before it leaves the system. We do not build agents that approve
          payments, sign agreements or make commitments on your behalf without human approval, and
          we do not describe any system we deliver as running your business unsupervised.
        </p>
      </Clause>

      <Clause heading="Acceptable use and liability">
        <p>
          Don't use AgenticCore to build or run anything illegal, fraudulent or knowingly harmful.
          We will refuse or stop work on a project that turns out to be, without a refund on work
          already done.
        </p>
        <p>
          Beyond that: we deliver what we agree to deliver, built properly and tested before
          handover. We are not liable for losses arising from how you run your business
          afterwards, or for a third-party service — hosting, a payment processor, an AI provider —
          having an outage or an issue of its own.
        </p>
      </Clause>
    </LegalLayout>
  );
}
