-- Paying for a job in USDT on BNB Smart Chain.
--
-- One receiving address, and every open invoice is paid with a slightly
-- different amount, so the amount identifies the invoice. $150 with nonce
-- 7 is paid as 150.000007 and nothing else. No deposit addresses to
-- derive, no keys to custody, and the address can be printed on the page
-- without any of it being secret. See _shared/usdtAmount.ts for why the
-- match is exact rather than tolerant.
--
-- What this replaces: the address was already printed on the request page
-- with the plain price next to it, and the page told the client to message
-- Telegram with their transaction hash so a human could confirm it. Same
-- address and same amount for everybody is precisely why that had to be
-- manual -- there was nothing in the payment to say who sent it.
--
-- AN INVOICE IS PER JOB, not a wallet top-up. .agency sells from $5 to
-- $1,000 and nobody pre-loads $800 of credit before deciding what to buy.
-- So base_usd comes from the request's own agreed_price -- 30% of it, the
-- deposit the site promises, not the whole job -- and settling an invoice
-- moves that request from awaiting_payment to confirmed. The remaining 70%
-- is still billed on delivery, by hand, as it is today.
--
-- Two guards live here rather than in application code, because both are
-- the kind that only fail under concurrency -- which is to say, in front
-- of a real client and never in a test.

create table if not exists public.usdt_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The job this pays for. One request can have several invoices over its
  -- life (an expired one, then a fresh one), which is why this is not
  -- unique -- but only one of them is ever pending, see below.
  request_id uuid not null references public.requests (id) on delete cascade,

  -- The deposit, in dollars, copied at the moment the invoice opened. NOT
  -- read back off the request when settling: a price edited between
  -- quoting and paying must not silently change what the client already
  -- sent. Note this is the 30% due upfront, not the agreed price -- see
  -- _shared/pricing.ts, which is the only place that fraction lives.
  base_usd numeric(10, 2) not null check (base_usd > 0),

  -- The exact decimal string the client must send, e.g. "150.000007".
  -- Text, not numeric: this is compared byte-for-byte against what the
  -- chain reports, and a numeric column would round it on the way in.
  amount text not null,
  nonce integer not null check (nonce between 1 and 9999),

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled')),

  -- GUARD 1. The transaction that paid this. Unique across the whole
  -- table, so one payment can never be credited twice -- not by a retry,
  -- not by two sweeps overlapping, not by a poll racing the cron.
  tx_hash text unique,
  paid_from text,

  -- The chain height when this invoice opened. A transfer mined before it
  -- cannot have been meant for it. Without this bound an amount freed by
  -- an expired invoice, and reissued, would let a late payment settle
  -- somebody else's job.
  from_block text,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz
);

-- GUARD 2. Two OPEN invoices must never share an amount, or a payment
-- arriving for it cannot be attributed to one job. The nonce search in
-- application code is advisory -- it reads, then writes, and two requests
-- can read the same gap. This is what actually enforces it: the second
-- insert fails and the caller picks another nonce.
create unique index if not exists usdt_invoices_open_amount_idx
  on public.usdt_invoices (amount) where status = 'pending';

-- One open invoice per job. A second quote for the same request would
-- leave two amounts live for one piece of work, and paying the older one
-- would look like it had not been paid.
create unique index if not exists usdt_invoices_open_request_idx
  on public.usdt_invoices (request_id) where status = 'pending';

create index if not exists usdt_invoices_user_idx on public.usdt_invoices (user_id, created_at desc);
create index if not exists usdt_invoices_pending_idx on public.usdt_invoices (expires_at) where status = 'pending';

alter table public.usdt_invoices enable row level security;

-- Clients read their own invoices and write none of them: the amount, the
-- status and the settlement are all decided server-side.
revoke insert, update, delete, truncate on public.usdt_invoices from anon, authenticated;

drop policy if exists "Users read their own usdt invoices" on public.usdt_invoices;
create policy "Users read their own usdt invoices" on public.usdt_invoices
  for select using (auth.uid() = user_id);

-- Settling a paid invoice, atomically.
--
-- Marking the invoice and confirming the request have to happen together
-- or not at all. As two statements from an edge function, a crash between
-- them leaves either a confirmed job nobody paid for or -- the one a
-- client reports -- a paid invoice against a job still marked unpaid.
--
-- Forward-only: the UPDATE is conditional on the row still being pending,
-- so whoever gets there first wins and everybody else is told false rather
-- than settling twice.
create or replace function public.settle_usdt_invoice(
  p_invoice_id uuid,
  p_tx_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invoice public.usdt_invoices%rowtype;
begin
  update public.usdt_invoices
     set status = 'paid',
         tx_hash = p_tx_hash,
         paid_at = now()
   where id = p_invoice_id
     and status = 'pending'
  returning * into v_invoice;

  if not found then
    -- Already paid, expired, cancelled, or another caller won the race.
    return false;
  end if;

  -- 'confirmed' is the status the request table already had for "paid for
  -- and ours to do". Nothing new is invented here.
  update public.requests
     set status = 'confirmed'
   where id = v_invoice.request_id;

  return true;
exception
  when unique_violation then
    -- This transaction hash already settled some other invoice. That is
    -- the duplicate-credit case the unique constraint exists to stop, so
    -- it is reported rather than swallowed.
    return false;
end $fn$;

revoke all on function public.settle_usdt_invoice(uuid, text) from public, anon, authenticated;

-- Invoices nobody paid stop being pending, which frees their amount and
-- their request slot for a fresh quote, and stops the sweep checking them
-- forever.
--
-- Money that arrives after that is not silently swallowed: the transfer is
-- still recorded (see usdt_transfers below) and the sweep reports any
-- confirmed transfer it could not attribute to an invoice. Expiring an
-- invoice gives up on matching the payment automatically, not on telling
-- anyone it arrived.
create or replace function public.expire_usdt_invoices() returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  update public.usdt_invoices
     set status = 'expired'
   where status = 'pending' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $fn$;

revoke all on function public.expire_usdt_invoices() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Remembering what the chain said, so a slow payment is not a lost one.
-- ---------------------------------------------------------------------
--
-- .click's sweep asks the node for the last 1500 blocks every minute and
-- matches pending invoices against that. It works there because an invoice
-- expires in sixty minutes.
--
-- It does not work here. An .agency invoice is payable for twenty-four
-- hours, deliberately -- $800 of USDT usually comes out of an exchange,
-- which is not a two-minute job. 1500 blocks is under twenty minutes at
-- BNB's current block time. A fixed window would mean a payment that
-- landed an hour in was never looked at: not matched, not reported to
-- anyone, just gone until the client asked where their build was.
--
-- So the sweep scans FORWARD from where it last got to and keeps what it
-- finds. Matching then runs against everything ever seen, not against
-- whatever happens to be in the last few minutes of chain.

create table if not exists public.usdt_transfers (
  -- A transaction can hold more than one transfer to the same address, so
  -- the hash alone is not the identity of a transfer. tx_hash on
  -- usdt_invoices is still unique, which is what stops one transfer paying
  -- two invoices; this is only about not ingesting the same log twice.
  tx_hash text not null,
  log_index integer not null,

  block_number bigint not null,
  from_address text not null,

  -- Raw token units as the log reported them, as text. USDT is 18 decimals
  -- on BNB Chain, so this is up to a 30-digit integer -- bigint overflows
  -- it and a float loses the last decimal places, which are the only thing
  -- identifying the invoice.
  value_raw text not null,

  seen_at timestamptz not null default now(),

  -- When the owner was told about this transfer, for transfers that could
  -- not be attributed to an invoice. Null means not yet reported, which is
  -- what the sweep looks for -- so a payment for the wrong amount, or one
  -- that arrived after its invoice expired, gets reported exactly once
  -- rather than every minute forever.
  alerted_at timestamptz,

  primary key (tx_hash, log_index)
);

create index if not exists usdt_transfers_block_idx
  on public.usdt_transfers (block_number desc);

-- The sweep's own query: unreported transfers, oldest first.
create index if not exists usdt_transfers_unalerted_idx
  on public.usdt_transfers (block_number)
  where alerted_at is null;

alter table public.usdt_transfers enable row level security;

-- Nobody but the service role touches this. It is a record of payments
-- into the business, which includes payments by other clients: no policy
-- is granted, so RLS denies every client read by default.
revoke all on public.usdt_transfers from anon, authenticated;

-- How far the sweep has scanned.
--
-- One row, enforced by the primary key rather than by hoping: a second row
-- here would mean two cursors and a sweep that skips whatever the other
-- one covered.
create table if not exists public.usdt_scan_state (
  id boolean primary key default true check (id),
  last_block bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.usdt_scan_state enable row level security;
revoke all on public.usdt_scan_state from anon, authenticated;

-- Moving the cursor, forward only.
--
-- greatest() rather than a bare assignment: two sweeps overlapping, or a
-- node that briefly reports an older head, must not rewind the cursor into
-- blocks that were already scanned -- and must certainly not advance it
-- past blocks that were not. The caller passes the block it actually
-- scanned to, which is not always the one it asked for.
create or replace function public.advance_usdt_scan(p_last_block bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_last bigint;
begin
  insert into public.usdt_scan_state (id, last_block)
  values (true, p_last_block)
  on conflict (id) do update
    set last_block = greatest(public.usdt_scan_state.last_block, excluded.last_block),
        updated_at = now()
  returning last_block into v_last;

  return v_last;
end $fn$;

revoke all on function public.advance_usdt_scan(bigint) from public, anon, authenticated;

-- Transfers older than any invoice could possibly still be waiting for.
--
-- Thirty days, not twenty-four hours: this is the only record of money
-- that arrived for an amount nothing was expecting, and that is exactly
-- the case somebody asks about a fortnight later.
create or replace function public.prune_usdt_transfers() returns integer
language sql
security definer
set search_path = public
as $fn$
  with pruned as (
    delete from public.usdt_transfers
     where seen_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from pruned;
$fn$;

revoke all on function public.prune_usdt_transfers() from public, anon, authenticated;

-- The sweep.
--
-- The request page polls its own invoice while somebody is watching it,
-- but a client who sends the USDT and closes the tab must still have their
-- request confirmed -- and that is the common case, because a wallet
-- transfer is done in another app.
--
-- Every minute, and only when something is actually pending: the `where
-- exists` means a quiet week costs no explorer quota at all.
--
-- No Authorization header. usdt-check is listed in config.toml with
-- verify_jwt = false, so the platform gate is off and the function needs
-- no key to be reached -- the same way telegram-webhook is reached. Which
-- also means there is no key pasted into a migration that lives in git
-- forever. Being callable by anyone is safe here and the function says why
-- at length: every settlement is decided by what is on the chain and
-- guarded by a unique tx_hash, so an outsider calling it can only make us
-- check sooner than we meant to.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $guard$
begin
  if exists (select 1 from cron.job where jobname = 'usdt-payment-sweep') then
    perform cron.unschedule('usdt-payment-sweep');
  end if;
end $guard$;

select cron.schedule(
  'usdt-payment-sweep',
  '* * * * *',
  $sql$
  select net.http_post(
    url := 'https://ggyphnbnndfuxgkoakhs.supabase.co/functions/v1/usdt-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  where exists (select 1 from public.usdt_invoices where status = 'pending');
  $sql$
);
