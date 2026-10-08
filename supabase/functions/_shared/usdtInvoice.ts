// Opening a USDT invoice for one job.
//
// Separate from the HTTP function so the Telegram bot can open one
// directly in stage 3: a client who ordered in the chat should not have to
// find the website to pay. The nonce logic, the chain-height bound and the
// contract check are subtle enough that a second copy of them in the bot
// would be a second place for a payment to go unattributed.
import { allocateNonce, invoiceAmount, MAX_NONCE } from './usdtAmount.ts';
import { currentBlock, RECEIVING_ADDRESS, USDT_CONTRACT, verifyContract } from './usdtChain.ts';
import { supabaseAdmin } from './supabaseAdmin.ts';
import { upfrontAmountDue, UPFRONT_FRACTION } from './pricing.ts';

/**
 * How long an invoice stays payable.
 *
 * Longer than .click's hour, because the amounts are bigger: moving $800
 * of USDT often means a transfer from an exchange, which is not a
 * two-minute job and sometimes waits on a withdrawal window. An expired
 * invoice is not a lost payment -- money that arrives late still appears
 * in the sweep and is reported.
 */
export const INVOICE_HOURS = 24;

export interface OpenInvoice {
  invoiceId: string;
  requestId: string;
  amount: string;
  /** The deposit this invoice collects. */
  baseUsd: number;
  /** The whole job, so the page can show what the deposit is a share of. */
  agreedPrice: number;
  upfrontFraction: number;
  address: string;
  contract: string;
  network: string;
  decimals: number;
  expiresAt: string;
}

export type InvoiceResult =
  | { ok: true; invoice: OpenInvoice }
  | { ok: false; status: number; error: string; detail?: string };

interface RequestRow {
  id: string;
  user_id: string;
  agreed_price: number | null;
  status: string;
}

/**
 * Opens an invoice for a request, or explains why it could not.
 *
 * `userId` is checked against the request's own owner rather than trusted:
 * this runs as the service role, which bypasses RLS, so somebody else's
 * request id would otherwise resolve and quote them a payable amount
 * against a job that is not theirs.
 */
export async function createUsdtInvoice(userId: string, requestId: string): Promise<InvoiceResult> {
  const { data: request, error: readError } = await supabaseAdmin
    .from('requests')
    .select('id, user_id, agreed_price, status')
    .eq('id', requestId)
    .maybeSingle<RequestRow>();

  if (readError) {
    console.error('createUsdtInvoice: could not read the request', readError);
    return { ok: false, status: 500, error: 'Could not open an invoice. Please try again.' };
  }
  if (!request || request.user_id !== userId) {
    return { ok: false, status: 404, error: 'No such request.' };
  }
  if (request.status === 'confirmed') {
    return { ok: false, status: 409, error: 'This request is already paid for.' };
  }

  const agreedPrice = Number(request.agreed_price);
  if (!Number.isFinite(agreedPrice) || agreedPrice <= 0) {
    // A request with no agreed price has not been quoted yet. Quoting one
    // here would be this function inventing a figure for somebody's work.
    return { ok: false, status: 409, error: 'This request has no agreed price yet.' };
  }

  // The deposit, not the whole job. Computed here from the request's own
  // agreed_price and never taken from the caller: a client who could name
  // their own amount could pay $1 for a $1,000 build and have the chain
  // watcher confirm it.
  const baseUsd = upfrontAmountDue(agreedPrice);
  if (baseUsd <= 0) {
    return { ok: false, status: 409, error: 'This request has no agreed price yet.' };
  }

  // An invoice already open for this job is returned rather than replaced.
  // Issuing a second amount for one piece of work means paying the first
  // one looks like not paying at all.
  const { data: existing } = await supabaseAdmin
    .from('usdt_invoices')
    .select('id, amount, base_usd, expires_at')
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .maybeSingle<{ id: string; amount: string; base_usd: number; expires_at: string }>();

  // Before anything is quoted, confirm the contract we will watch really is
  // USDT. Watching a lookalike would settle a job for somebody who paid in
  // a worthless token -- the one failure in this scheme that is not
  // fail-safe. Cheap, and it fails the request rather than the payment.
  let decimals: number;
  try {
    ({ decimals } = await verifyContract());
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('createUsdtInvoice: contract verification failed', detail);
    return {
      ok: false,
      status: 503,
      error: 'Could not verify the payment token right now. Please try again shortly.',
      detail
    };
  }

  if (existing) {
    return {
      ok: true,
      invoice: {
        invoiceId: existing.id,
        requestId,
        amount: existing.amount,
        baseUsd: Number(existing.base_usd),
        agreedPrice,
        upfrontFraction: UPFRONT_FRACTION,
        address: RECEIVING_ADDRESS,
        contract: USDT_CONTRACT,
        network: 'BNB Smart Chain (BEP-20)',
        decimals,
        expiresAt: existing.expires_at
      }
    };
  }

  // The chain height now, so a payment mined before this invoice existed
  // can never settle it. Amounts are reused once an invoice closes, and
  // without this bound a slow payment for an expired invoice settles
  // whoever holds that amount next.
  let fromBlock: string;
  try {
    fromBlock = (await currentBlock()).toString();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('createUsdtInvoice: could not read the chain height', detail);
    return { ok: false, status: 503, error: 'Could not reach the chain right now. Please try again shortly.', detail };
  }

  const expiresAt = new Date(Date.now() + INVOICE_HOURS * 3_600_000).toISOString();

  // Nonce allocation reads the open invoices and then writes, so two
  // requests can read the same gap. The partial unique index on (amount)
  // where status = 'pending' is what actually prevents a collision; this
  // loop is how the loser of that race recovers.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: open, error: openError } = await supabaseAdmin
      .from('usdt_invoices')
      .select('nonce')
      .eq('status', 'pending')
      .eq('base_usd', baseUsd);

    if (openError) {
      console.error('createUsdtInvoice: could not read open invoices', openError);
      return { ok: false, status: 500, error: 'Could not open an invoice. Please try again.' };
    }

    let nonce: number;
    try {
      nonce = allocateNonce((open ?? []).map((row) => row.nonce as number));
    } catch {
      console.error(`createUsdtInvoice: all ${MAX_NONCE} nonces are in use at $${baseUsd}`);
      return { ok: false, status: 503, error: 'Too many payments in progress. Please try again in a few minutes.' };
    }

    const amount = invoiceAmount(baseUsd, nonce);

    const { data: invoice, error: insertError } = await supabaseAdmin
      .from('usdt_invoices')
      .insert({
        user_id: userId,
        request_id: requestId,
        base_usd: baseUsd,
        amount,
        nonce,
        expires_at: expiresAt,
        from_block: fromBlock
      })
      .select('id, amount, expires_at')
      .single<{ id: string; amount: string; expires_at: string }>();

    if (!insertError && invoice) {
      // Only now does the request say it is waiting on money. Doing this
      // before the insert would leave a request stuck in awaiting_payment
      // with no invoice behind it if the insert then failed.
      await supabaseAdmin
        .from('requests')
        .update({ status: 'awaiting_payment' })
        .eq('id', requestId)
        .eq('status', 'draft')
        .then(({ error }) => error && console.error('createUsdtInvoice: could not mark awaiting_payment', error));

      return {
        ok: true,
        invoice: {
          invoiceId: invoice.id,
          requestId,
          // Everything the client needs to pay and nothing they have to
          // work out. The exact amount matters more than the address: a
          // near-miss on the amount is what cannot be attributed.
          amount: invoice.amount,
          baseUsd,
          agreedPrice,
          upfrontFraction: UPFRONT_FRACTION,
          address: RECEIVING_ADDRESS,
          contract: USDT_CONTRACT,
          network: 'BNB Smart Chain (BEP-20)',
          decimals,
          expiresAt: invoice.expires_at
        }
      };
    }

    // 23505 is unique_violation: somebody took this amount between the read
    // and the write. Try the next free nonce.
    if ((insertError as { code?: string } | null)?.code !== '23505') {
      console.error('createUsdtInvoice: insert failed', insertError);
      return { ok: false, status: 500, error: 'Could not open an invoice. Please try again.' };
    }
  }

  console.error('createUsdtInvoice: lost the nonce race five times running');
  return { ok: false, status: 503, error: 'Could not open an invoice. Please try again.' };
}
