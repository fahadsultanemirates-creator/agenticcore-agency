import { AlertTriangle, Check, Copy, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { money } from "../../lib/format";
import { supabase } from "../../lib/supabase";

// Paying for a job in USDT on BNB Smart Chain.
//
// The server opens an invoice and quotes an amount whose last four decimal
// places carry a nonce, so 300.000007 identifies one invoice and nothing
// else. That makes THE EXACT AMOUNT the thing that matters, more than the
// address, which is why it is the biggest thing in the panel and has its
// own copy button. Rounding it is the one mistake the chain watcher cannot
// recover from, and the panel says so where somebody will read it.
//
// Ported from public/usdt-payment.js, which is deleted with this change.

const USDT_BEP20_ADDRESS = "0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC";
const AC_TOKEN_CONTRACT_ADDRESS = "0xe9568888a0bc317519957047cf736e134B097768";
const AC_TOKEN_DISCOUNT_PCT = 15;
const SUPPORT_TELEGRAM_URL = "https://t.me/agenticcore_support";

// Five seconds. The point of watching the chain ourselves is that
// confirmation takes under a minute; a lazy poll would throw that away at
// the one moment the client is actually watching the screen.
const POLL_INTERVAL_MS = 5000;

type Invoice = {
  invoiceId: string;
  requestId: string;
  amount: string;
  baseUsd: number;
  agreedPrice: number;
  upfrontFraction: number;
  address: string;
  network: string;
  expiresAt: string;
};

type CheckResult = {
  status?: string;
  confirmations?: number;
  received?: string;
  error?: string;
};

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          // Some in-app browsers refuse the clipboard outright. Both the
          // amount and the address are selectable text on the page, so a
          // refusal costs the shortcut, not the payment.
        }
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * The AC token option, which stays manual -- honestly.
 *
 * The chain watcher matches transfers of the USDT contract and nothing
 * else, so an AC payment genuinely does need a human to look at it.
 * Saying "verified manually" about the USDT path too, now that it is
 * automatic, would be the sort of stale sentence nobody notices is a lie.
 */
function AcTokenOption({ requestId, depositUsd }: { requestId: string; depositUsd: number }) {
  const acAmount = Math.round(depositUsd * (1 - AC_TOKEN_DISCOUNT_PCT / 100) * 100) / 100;
  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
        Or pay in AC token — {AC_TOKEN_DISCOUNT_PCT}% off
      </p>
      <p className="mt-1.5 text-sm text-fg-muted">
        {money(acAmount)} of AC token, to the same address. AC payments are still checked by hand:
        send it, then message us on{" "}
        <a
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener"
          className="font-semibold text-cyan-400 hover:underline"
        >
          Telegram
        </a>{" "}
        with request <code className="text-xs text-fg">{requestId}</code> and your transaction hash.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-void px-3 py-2 font-mono text-xs text-fg">
          {USDT_BEP20_ADDRESS}
        </code>
        <CopyButton text={USDT_BEP20_ADDRESS} />
      </div>
      <p className="mt-2 text-xs text-fg-faint">
        AC token contract:{" "}
        <a
          href={`https://bscscan.com/token/${AC_TOKEN_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener"
          className="hover:underline"
        >
          <code>{AC_TOKEN_CONTRACT_ADDRESS}</code>
        </a>
      </p>
    </div>
  );
}

/**
 * What the page shows if no invoice could be opened.
 *
 * Kept deliberately rather than left as a dead end: if the chain watcher
 * is down, a client who has just agreed a price must still have a way to
 * pay. It says plainly that this one is checked by hand.
 */
function ManualFallback({
  requestId,
  amountDue,
  reason,
}: {
  requestId: string;
  amountDue: number;
  reason: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
        Pay {money(amountDue)} in USDT — BEP-20 / BNB Smart Chain
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-void px-3 py-2 font-mono text-sm text-fg">
          {USDT_BEP20_ADDRESS}
        </code>
        <CopyButton text={USDT_BEP20_ADDRESS} />
      </div>
      <p className="text-sm text-fg-muted">
        Automatic confirmation isn't available right now{reason ? ` (${reason})` : ""}, so this one
        is checked by hand. Send the amount, then message us on{" "}
        <a
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener"
          className="font-semibold text-cyan-400 hover:underline"
        >
          Telegram
        </a>{" "}
        with request <code className="text-xs text-fg">{requestId}</code> and your transaction hash.
      </p>
    </div>
  );
}

export function UsdtPayment({ requestId, amountDue }: { requestId: string; amountDue: number }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, setOpening] = useState(true);
  const [status, setStatus] = useState<"waiting" | "confirming" | "paid" | "problem">("waiting");
  const [statusText, setStatusText] = useState("Waiting for your payment…");
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Polls this invoice until it settles. The cron sweep confirms the
  // request anyway if the tab is closed; this exists so somebody watching
  // the screen sees it happen rather than reloading and wondering.
  const poll = useCallback((open: Invoice) => {
    async function tick(): Promise<void> {
      const token = await accessToken();
      if (!token) {
        setStatus("problem");
        setStatusText("Your session expired — reload the page to keep watching for the payment.");
        return;
      }

      let data: CheckResult | null = null;
      try {
        const response = await supabase.functions.invoke<CheckResult>("usdt-check", {
          body: { invoiceId: open.invoiceId },
          headers: { Authorization: `Bearer ${token}` },
        });
        data = response.data;
      } catch (err) {
        // A failed poll is not a failed payment, and saying so would send
        // a client who has already paid to support. Keep waiting.
        console.error("usdt-check threw:", err);
      }

      if (data?.status === "paid") {
        setStatus("paid");
        setStatusText("Payment confirmed — your request is in. We'll be in touch shortly.");
        return;
      }
      if (data?.status === "wrong_amount") {
        setStatus("problem");
        setStatusText(
          `${data.received ?? "A different amount"} USDT arrived, but this invoice is for ${open.amount}. It has not been confirmed automatically — we've been notified and will sort it out.`
        );
      } else if (data?.status === "confirming") {
        setStatus("confirming");
        setStatusText(`Payment seen — ${data.confirmations ?? 0} confirmations, confirming shortly…`);
      } else if (data?.status === "expired" || data?.status === "cancelled") {
        setStatus("problem");
        setStatusText("That invoice expired. Reload the page to get a fresh amount.");
        return;
      }

      pollRef.current = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    }

    pollRef.current = setTimeout(() => void tick(), POLL_INTERVAL_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await accessToken();
      if (!token) {
        if (!cancelled) {
          setFailure("you are not signed in");
          setOpening(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke<Invoice & { error?: string }>(
          "usdt-invoice",
          { body: { requestId }, headers: { Authorization: `Bearer ${token}` } }
        );
        if (cancelled) return;

        if (data?.amount) {
          setInvoice(data);
          setOpening(false);
          poll(data);
          return;
        }

        // The function's own message where there is one -- "this request
        // has no agreed price yet" is worth reading, and burying it
        // behind a generic failure is what makes a payment page
        // unsupportable.
        const reason = data?.error ?? error?.message ?? null;
        console.error("usdt-invoice did not return an invoice:", reason, data);
        setFailure(reason);
        setOpening(false);
      } catch (err) {
        console.error("usdt-invoice threw:", err);
        if (!cancelled) {
          setFailure("the payment service could not be reached");
          setOpening(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [requestId, poll]);

  if (opening) {
    return (
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening your payment details for {money(amountDue)}…
      </p>
    );
  }

  if (!invoice) {
    return (
      <>
        <ManualFallback requestId={requestId} amountDue={amountDue} reason={failure} />
        <AcTokenOption requestId={requestId} depositUsd={amountDue} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        <span className="font-semibold text-fg">{money(invoice.baseUsd)} due now</span> to start —{" "}
        {Math.round((invoice.upfrontFraction || 0.3) * 100)}% of {money(invoice.agreedPrice)}. The
        rest is billed on delivery.
      </p>

      {/* The amount is the biggest thing here on purpose. The address is
          shared by every invoice; the amount is the only thing that says
          which one this is. */}
      <div className="rounded-xl border-2 border-cyan-400 bg-cyan-400/5 p-4">
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          Send exactly this amount
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className="font-display text-3xl font-semibold tabular-nums text-fg">{invoice.amount}</p>
          <span className="text-sm font-semibold text-fg-muted">USDT</span>
          <span className="ml-auto">
            <CopyButton text={invoice.amount} label="Copy amount" />
          </span>
        </div>
        <p className="mt-2 text-xs text-fg-faint">
          The last digits identify your payment. Rounding the amount means we can't match it to your
          request.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          To this address — {invoice.network}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-void px-3 py-2 font-mono text-sm text-fg">
            {invoice.address}
          </code>
          <CopyButton text={invoice.address} label="Copy" />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-400/5 px-3 py-2.5 text-xs text-fg-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
        <span>
          Only send USDT on BNB Smart Chain to this address. Another coin, or USDT on another
          network, cannot be recovered.
        </span>
      </div>

      <p
        className={`flex items-center gap-1.5 text-sm ${
          status === "paid"
            ? "font-semibold text-cyan-400"
            : status === "problem"
              ? "text-orange-300"
              : "text-fg-muted"
        }`}
      >
        {status !== "paid" && status !== "problem" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === "paid" && <Check className="h-4 w-4" />}
        {statusText}
      </p>

      <p className="text-xs text-fg-faint">
        You can close this page. Your request is confirmed as soon as the payment confirms, either
        way.
      </p>

      <AcTokenOption requestId={invoice.requestId} depositUsd={invoice.baseUsd} />
    </div>
  );
}
