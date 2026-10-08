// Looks for the payment an invoice is waiting on, and settles the job.
//
// Two callers, one path. The client's page polls it for a single invoice
// while somebody watches; pg_cron calls it with no body to sweep
// everything still pending, so a payment that lands after the client has
// closed the tab still settles.
//
// It does NOT ask the chain "what arrived recently" and match against
// that, which is how .click works. An .agency invoice is payable for
// twenty-four hours and a node will only serve a window of minutes, so a
// recent-window scan would never look at a payment that landed an hour in.
// Instead the sweep scans FORWARD from where it last got to, keeps every
// transfer it sees in usdt_transfers, and matches invoices against that
// record. Nothing is forgotten, and nothing is scanned twice.
//
// Settling is an atomic RPC, not an update followed by an update: a crash
// between those two leaves either a confirmed job nobody paid for or --
// the one a client reports -- a paid invoice against a job still marked
// unpaid.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { matchPayment, type Transfer } from '../_shared/usdtAmount.ts';
import {
  chainConfigured,
  coldStartBlock,
  currentBlock,
  scanStart,
  MIN_CONFIRMATIONS,
  RECEIVING_ADDRESS,
  transfersSince,
  verifyContract
} from '../_shared/usdtChain.ts';
import { notifyOwner } from '../_shared/ownerAlert.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface InvoiceRow {
  id: string;
  user_id: string;
  request_id: string;
  amount: string;
  base_usd: number;
  status: string;
  /** Chain height when the invoice was opened. */
  from_block: string | null;
}

interface StoredTransfer {
  tx_hash: string;
  log_index: number;
  block_number: string;
  from_address: string;
  value_raw: string;
}

async function resolveCaller(authHeader: string): Promise<{ id: string } | null> {
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

/**
 * Scans whatever is new and records it.
 *
 * Returns the chain head, because confirmations are derived from it and a
 * stored transfer has none of its own -- it gets deeper every block, and
 * storing a number that was true once is how a one-confirmation payment
 * gets treated as settled forever.
 */
async function ingest(oldestPendingBlock: bigint | null): Promise<{ head: bigint; caughtUp: boolean }> {
  const head = await currentBlock();

  const { data: state } = await supabaseAdmin
    .from('usdt_scan_state')
    .select('last_block')
    .maybeSingle<{ last_block: string }>();

  // Where to start, including the floor at the oldest open invoice --
  // see scanStart, which is pure and tested because getting it wrong
  // either stalls the sweep or steps over somebody's payment.
  const lastBlock = state?.last_block == null ? null : BigInt(state.last_block);
  const from = scanStart({ lastBlock, oldestPendingBlock, head });

  if (lastBlock !== null && from > lastBlock + 1n) {
    console.log(`usdt-check: skipped ${from - lastBlock - 1n} blocks older than any open invoice`);
  }

  const { head: scanHead, scannedTo, transfers, caughtUp } = await transfersSince(from, head);
  void scanHead;

  if (transfers.length > 0) {
    // Upserted, because a sweep that dies after the node call but before
    // the cursor moves will see the same logs again. The primary key is
    // (tx_hash, log_index) -- one transaction can hold several transfers
    // to the same address, so the hash alone would drop some of them.
    const { error } = await supabaseAdmin.from('usdt_transfers').upsert(
      transfers.map((t) => ({
        tx_hash: t.txHash,
        log_index: t.logIndex ?? 0,
        block_number: t.blockNumber.toString(),
        from_address: t.from,
        value_raw: t.valueRaw
      })),
      { onConflict: 'tx_hash,log_index' }
    );

    if (error) {
      // The cursor is NOT advanced. Better to rescan these blocks next
      // minute than to move past a transfer that was never recorded.
      console.error('usdt-check: could not record transfers', error);
      return { head, caughtUp: false };
    }
  }

  if (scannedTo >= from) {
    await supabaseAdmin
      .rpc('advance_usdt_scan', { p_last_block: Number(scannedTo) })
      .then(({ error }) => error && console.error('usdt-check: could not advance the cursor', error));
  }

  return { head, caughtUp };
}

/** The opening height of the oldest invoice still waiting to be paid. */
async function oldestPendingFromBlock(): Promise<bigint | null> {
  const { data } = await supabaseAdmin
    .from('usdt_invoices')
    .select('from_block')
    .eq('status', 'pending')
    .not('from_block', 'is', null)
    .order('from_block', { ascending: true })
    .limit(1)
    .maybeSingle<{ from_block: string }>();

  return data?.from_block == null ? null : BigInt(data.from_block);
}

/** Transfers that could still settle this invoice, deepest first. */
async function candidatesFor(invoice: InvoiceRow, head: bigint): Promise<Transfer[]> {
  // Bounded by the invoice's own opening height, so a payment mined before
  // the invoice existed cannot settle it. Amounts are reused once an
  // invoice closes, and without this a slow payment for an expired invoice
  // settles whoever holds that amount next.
  const minBlock = invoice.from_block == null ? 0n : BigInt(invoice.from_block);

  const { data, error } = await supabaseAdmin
    .from('usdt_transfers')
    .select('tx_hash, log_index, block_number, from_address, value_raw')
    .gte('block_number', minBlock.toString())
    // Oldest first, so if a client pays twice it is the first payment that
    // settles the invoice and the second that gets reported.
    .order('block_number', { ascending: true })
    // An invoice lives 24 hours, so this covers a day of payments into one
    // address. If that ever stops being generous, the symptom is a payment
    // that is seen on the chain and never matched -- so it is a bound to
    // raise rather than to leave implicit.
    .limit(1000);

  if (error) {
    console.error('usdt-check: could not read stored transfers', error);
    return [];
  }

  return (data ?? []).map((row: StoredTransfer) => {
    const block = BigInt(row.block_number);
    return {
      txHash: row.tx_hash,
      from: row.from_address,
      to: RECEIVING_ADDRESS,
      valueRaw: row.value_raw,
      // Derived now, never stored: a transfer gets deeper every block.
      confirmations: head >= block ? Number(head - block) + 1 : 0,
      blockNumber: block
    };
  });
}

async function settle(
  invoice: InvoiceRow,
  head: bigint,
  decimals: number,
  creditedHashes: string[]
): Promise<{ status: string; confirmations?: number; received?: string; txHash?: string }> {
  const result = matchPayment(await candidatesFor(invoice, head), {
    expected: invoice.amount,
    decimals,
    receivingAddress: RECEIVING_ADDRESS,
    minConfirmations: MIN_CONFIRMATIONS,
    alreadyCredited: creditedHashes,
    minBlock: invoice.from_block == null ? null : BigInt(invoice.from_block)
  });

  if (result.status === 'paid') {
    const { data: settled, error } = await supabaseAdmin.rpc('settle_usdt_invoice', {
      p_invoice_id: invoice.id,
      p_tx_hash: result.txHash
    });

    if (error) {
      console.error(`usdt-check: settling ${invoice.id} failed`, error);
      return { status: 'pending' };
    }
    if (!settled) {
      // Somebody already settled it, or the hash belongs to another
      // invoice. Both mean "not ours to settle", and neither is an error.
      console.log(`usdt-check: ${invoice.id} was already settled`);
      return { status: 'paid', txHash: result.txHash };
    }

    // Who paid, for support. Separate from the settlement on purpose: it
    // is an audit note, so a failure here must not undo a job that is
    // already correctly confirmed.
    await supabaseAdmin
      .from('usdt_invoices')
      .update({ paid_from: result.from })
      .eq('id', invoice.id)
      .then(({ error }) => error && console.error('usdt-check: could not record the payer', error));

    await notifyOwner(
      [
        `PAID — $${Number(invoice.base_usd).toFixed(2)} deposit received.`,
        '',
        `Request: ${invoice.request_id}`,
        `Sent ${invoice.amount} USDT from ${result.from}`,
        `tx ${result.txHash}`,
        '',
        'The request is now confirmed and is yours to start. The balance is still billed on delivery.'
      ].join('\n')
    ).catch(() => {});

    return { status: 'paid', txHash: result.txHash };
  }

  if (result.status === 'wrong_amount') {
    // Reported, never settled: the amount is the only thing identifying
    // the invoice, so money that arrived for a different one cannot be
    // attributed without a human looking at it.
    console.warn(`usdt-check: ${invoice.amount} expected, ${result.received} arrived (tx ${result.txHash})`);
    await notifyOwner(
      [
        'A USDT payment arrived for the WRONG AMOUNT and has NOT been credited.',
        '',
        `Expected ${invoice.amount}, received ${result.received}.`,
        `From ${result.from}`,
        `tx ${result.txHash}`,
        `Request: ${invoice.request_id}`
      ].join('\n')
    ).catch(() => {});

    // Stamped so reportUnattributed below does not say the same thing
    // again next minute. This alert is the better one -- it names the
    // request and what was expected.
    if (result.txHash) await markAlerted(result.txHash);

    return { status: 'wrong_amount', received: result.received };
  }

  if (result.status === 'confirming') {
    return { status: 'confirming', confirmations: result.confirmations };
  }

  return { status: 'pending' };
}

/** Records that the owner has been told about a transfer. */
async function markAlerted(txHash: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('usdt_transfers')
    .update({ alerted_at: new Date().toISOString() })
    .eq('tx_hash', txHash);
  if (error) console.error('usdt-check: could not mark a transfer as reported', error);
}

/**
 * Tells the owner about money that arrived and settled nothing.
 *
 * Without this, the only failure mode left in the scheme is the quiet one:
 * a client sends a rounded figure, or pays two hours after their invoice
 * expired, and the transfer is recorded, matched against nothing, and
 * nobody ever hears about it. They find out when the client asks where
 * their build is.
 *
 * Only confirmed transfers, so a payment that is still settling is not
 * reported as a problem, and only once each.
 */
async function reportUnattributed(head: bigint, settledHashes: string[]): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('usdt_transfers')
    .select('tx_hash, block_number, from_address, value_raw')
    .is('alerted_at', null)
    .order('block_number', { ascending: true })
    .limit(20);

  if (error) {
    console.error('usdt-check: could not look for unattributed transfers', error);
    return 0;
  }

  let reported = 0;
  for (const row of data ?? []) {
    const block = BigInt(row.block_number as string);
    const confirmations = head >= block ? Number(head - block) + 1 : 0;
    if (confirmations < MIN_CONFIRMATIONS) continue;
    if (settledHashes.includes(row.tx_hash as string)) {
      // It paid an invoice. Nothing to report, but stamp it so it stops
      // being looked at.
      await markAlerted(row.tx_hash as string);
      continue;
    }

    await notifyOwner(
      [
        'USDT ARRIVED THAT MATCHES NO OPEN INVOICE.',
        '',
        `${fromRawUsdt(row.value_raw as string)} USDT from ${row.from_address}`,
        `tx ${row.tx_hash}`,
        `block ${row.block_number}`,
        '',
        'Nothing has been confirmed for it. Most likely the amount was',
        'rounded, or it arrived after the invoice expired. Find the client',
        'by the sending address and settle it by hand.'
      ].join('\n')
    ).catch(() => {});

    await markAlerted(row.tx_hash as string);
    reported++;
  }

  return reported;
}

/**
 * Raw 18-decimal units as a readable figure, for the alert only.
 *
 * Nothing is decided from this -- matching compares integers. It is here
 * so the message says "300.5" instead of a thirty-digit number, which is
 * the difference between an alert somebody acts on and one they skim.
 */
function fromRawUsdt(valueRaw: string): string {
  try {
    const units = BigInt(valueRaw);
    const whole = units / 10n ** 18n;
    const fraction = (units % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return valueRaw;
  }
}

/** Hashes already attached to an invoice, so none is ever settled twice. */
async function creditedHashes(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('usdt_invoices').select('tx_hash').not('tx_hash', 'is', null);
  return (data ?? []).map((row) => row.tx_hash as string);
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  if (!chainConfigured()) return jsonResponse({ error: 'Crypto payment is not configured.' }, 503);

  let body: { invoiceId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // No body: the cron sweep.
  }
  const invoiceId = typeof body?.invoiceId === 'string' ? body.invoiceId : null;

  // Expire first, so an abandoned invoice gives its amount and its request
  // slot back, and the sweep below has less to do.
  await supabaseAdmin
    .rpc('expire_usdt_invoices')
    .then(({ error }) => error && console.error('usdt-check: expiry sweep failed', error));

  let decimals: number;
  try {
    ({ decimals } = await verifyContract());
  } catch (err) {
    // The reason goes in the response, not only the log. Nothing here is
    // sensitive: it describes a public contract and a public RPC node.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('usdt-check: contract verification failed', detail);
    return jsonResponse({ error: 'Could not verify the payment token.', detail }, 503);
  }

  let head: bigint;
  let caughtUp: boolean;
  try {
    ({ head, caughtUp } = await ingest(await oldestPendingFromBlock()));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('usdt-check: could not read the chain', detail);
    return jsonResponse({ error: 'Could not read the chain right now.', detail }, 503);
  }

  // ---- one invoice, for the client watching the page ------------------
  if (invoiceId) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);
    const caller = await resolveCaller(authHeader);
    if (!caller) return jsonResponse({ error: 'Not authenticated' }, 401);

    const { data: invoice } = await supabaseAdmin
      .from('usdt_invoices')
      .select('id, user_id, request_id, amount, base_usd, status, from_block')
      .eq('id', invoiceId)
      .maybeSingle<InvoiceRow>();

    // Checked rather than relied on: this runs as the service role, which
    // bypasses RLS, so somebody else's invoice id would otherwise resolve.
    if (!invoice || invoice.user_id !== caller.id) {
      return jsonResponse({ error: 'No such invoice.' }, 404);
    }
    if (invoice.status !== 'pending') return jsonResponse({ status: invoice.status });

    return jsonResponse(await settle(invoice, head, decimals, await creditedHashes()));
  }

  // ---- the sweep ------------------------------------------------------
  //
  // Unauthenticated on purpose. pg_cron calls it through pg_net, and it
  // cannot be made to do anything untrue: every settlement is decided by
  // what is on the chain and guarded by the unique tx_hash, so the worst
  // an outsider can do by calling it is make us scan sooner than we meant
  // to.
  const { data: pending } = await supabaseAdmin
    .from('usdt_invoices')
    .select('id, user_id, request_id, amount, base_usd, status, from_block')
    .eq('status', 'pending')
    .limit(50);

  // Old transfers go only when the sweep has nothing to do, so pruning
  // never competes with settling for the invocation's time budget.
  if (!pending || pending.length === 0) {
    const reported = await reportUnattributed(head, await creditedHashes());
    await supabaseAdmin
      .rpc('prune_usdt_transfers')
      .then(({ error }) => error && console.error('usdt-check: prune failed', error));
    return jsonResponse({ ok: true, checked: 0, paid: 0, reported, caughtUp });
  }

  const credited = await creditedHashes();

  let paid = 0;
  for (const invoice of pending as InvoiceRow[]) {
    try {
      const outcome = await settle(invoice, head, decimals, credited);
      if (outcome.status === 'paid') {
        paid++;
        // Only the hash that settled THIS invoice. Adding every hash seen
        // in the batch would block every later invoice in the same sweep
        // from matching anything, so a sweep could settle at most one
        // payment.
        if (outcome.txHash) credited.push(outcome.txHash);
      }
    } catch (err) {
      console.error(`usdt-check: ${invoice.id} failed`, err);
    }
  }

  // Last, so anything this sweep just settled is already stamped and does
  // not get reported as a mystery.
  const reported = await reportUnattributed(head, credited);

  // caughtUp is said out loud because "the sweep ran" and "the sweep has
  // seen every block" are different things, and only the second one means
  // a missing payment is really missing.
  return jsonResponse({ ok: true, checked: pending.length, paid, reported, caughtUp });
}

Deno.serve(handleRequest);
