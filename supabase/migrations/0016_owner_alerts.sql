-- The database tells the owner, so an order cannot be placed quietly.
--
-- Until now the only alert was notify-new-request, called by the page
-- after it inserted a row. That works right up until it doesn't: a
-- closed tab, a dropped connection, or any future code path that writes
-- a request without remembering to make the call, and the order lands
-- with nobody told. The page is the wrong place to put a promise that
-- nothing is missed.
--
-- A trigger is the right place. It fires from inside the same
-- transaction that wrote the row, so "a row exists" and "the owner was
-- told" cannot come apart. Nothing can place an order without this
-- firing.
--
-- THE ALERT MUST NEVER BLOCK THE WRITE. That is the one rule here. A
-- Telegram outage, an unset secret, a typo in a URL -- none of them may
-- cost a customer their order. So every path is wrapped: the whole
-- function body is inside an exception handler that warns and returns
-- normally, and net.http_post only queues the request (it does not wait
-- for Telegram), so a slow reply cannot hold a transaction open either.
--
-- WHAT IS SENT. Named columns, never to_jsonb(new). profiles alone
-- holds referral_code, total_spend and points_balance, and a row
-- splatted into a chat message is how that kind of thing leaks. The
-- column list below is the whole of what leaves the database.
--
-- CONFIGURATION. Two Vault secrets, which is why this file carries no
-- URL and no secret of its own:
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/owner-alert', 'owner_alert_url');
--   select vault.create_secret('<a long random string>', 'owner_alert_secret');
--
-- The same random string goes in the owner-alert function's
-- OWNER_ALERT_SECRET environment variable. Generate it yourself and
-- paste it in both places -- do not reuse a key you already have.
--
-- Until both secrets exist the triggers are inert: they look the values
-- up, find nothing, and return without sending. That is deliberate, so
-- this migration can be applied before the function is deployed.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_owner_event()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_url     text;
  v_secret  text;
  v_event   text := tg_argv[0];
  v_fields  jsonb;
  v_id      text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'owner_alert_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'owner_alert_secret';

  -- Not configured yet. Not an error, and emphatically not a reason to
  -- fail the insert that triggered us.
  if v_url is null or v_secret is null then
    return coalesce(new, old);
  end if;

  -- Named columns only. Whatever is listed here is exactly what can
  -- reach a chat message.
  if tg_table_name = 'requests' then
    v_id := new.id::text;
    v_fields := jsonb_build_object(
      'service_category', new.service_category,
      'task_type',        new.task_type,
      'description',      new.description,
      'agreed_price',     new.agreed_price,
      'status',           new.status);

  elsif tg_table_name = 'billing' then
    v_id := new.id::text;
    v_fields := jsonb_build_object(
      'amount',       new.amount,
      'payment_type', new.payment_type,
      'status',       new.status);

  elsif tg_table_name = 'projects' then
    v_id := new.id::text;
    v_fields := jsonb_build_object(
      'project_name', new.project_name,
      'status',       new.status,
      'old_status',   case when tg_op = 'UPDATE' then old.status else null end);

  elsif tg_table_name = 'profiles' then
    -- Deliberately NOT referral_code, total_spend or points_balance.
    v_id := new.id::text;
    v_fields := jsonb_build_object(
      'full_name',    new.full_name,
      'company_name', new.company_name);

  elsif tg_table_name = 'project_messages' then
    v_id := new.project_id::text;
    v_fields := jsonb_build_object('body', new.body);

  elsif tg_table_name = 'package_subscriptions' then
    v_id := new.id::text;
    v_fields := jsonb_build_object(
      'package_key',    new.package_key,
      'monthly_amount', new.monthly_amount,
      'status',         new.status);

  else
    v_id := null;
    v_fields := '{}'::jsonb;
  end if;

  -- Queues the request and returns immediately; pg_net delivers it
  -- outside this transaction.
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('event', v_event, 'id', v_id, 'fields', v_fields),
    headers := jsonb_build_object(
                 'Content-Type',   'application/json',
                 'X-Alert-Secret', v_secret),
    timeout_milliseconds := 5000);

  return coalesce(new, old);

exception when others then
  -- The whole point. Warn, and let the write succeed.
  raise warning 'notify_owner_event(%) failed: %', v_event, sqlerrm;
  return coalesce(new, old);
end;
$$;

comment on function public.notify_owner_event is
  'AFTER-trigger that queues an owner alert via pg_net. Never raises: an '
  'alerting failure must not roll back the row that caused it. Reads its '
  'endpoint and secret from Vault (owner_alert_url, owner_alert_secret) '
  'and is inert until both exist.';

-- Triggers. Each is dropped first so re-running this file is safe, and
-- each is guarded by to_regclass so the same migration applies to both
-- sites despite their different tables.
do $$
begin
  if to_regclass('public.requests') is not null then
    drop trigger if exists alert_owner_request_created on public.requests;
    create trigger alert_owner_request_created
      after insert on public.requests
      for each row execute function public.notify_owner_event('request.created');
  end if;

  if to_regclass('public.billing') is not null then
    drop trigger if exists alert_owner_billing_created on public.billing;
    create trigger alert_owner_billing_created
      after insert on public.billing
      for each row execute function public.notify_owner_event('billing.created');

    -- Only the transition into paid, not every touch of the row.
    drop trigger if exists alert_owner_billing_paid on public.billing;
    create trigger alert_owner_billing_paid
      after update of status on public.billing
      for each row
      when (old.status is distinct from new.status and new.status = 'paid')
      execute function public.notify_owner_event('billing.paid');
  end if;

  if to_regclass('public.projects') is not null then
    drop trigger if exists alert_owner_project_created on public.projects;
    create trigger alert_owner_project_created
      after insert on public.projects
      for each row execute function public.notify_owner_event('project.created');

    drop trigger if exists alert_owner_project_status on public.projects;
    create trigger alert_owner_project_status
      after update of status on public.projects
      for each row
      when (old.status is distinct from new.status)
      execute function public.notify_owner_event('project.status');
  end if;

  if to_regclass('public.profiles') is not null then
    drop trigger if exists alert_owner_profile_created on public.profiles;
    create trigger alert_owner_profile_created
      after insert on public.profiles
      for each row execute function public.notify_owner_event('profile.created');
  end if;

  -- .agency has this already; .biz gains it with the dashboard-areas
  -- migration. Only the client's own messages are worth a ping -- the
  -- owner does not need to be told what the owner just wrote.
  if to_regclass('public.project_messages') is not null then
    drop trigger if exists alert_owner_client_message on public.project_messages;
    create trigger alert_owner_client_message
      after insert on public.project_messages
      for each row
      when (new.author = 'client')
      execute function public.notify_owner_event('message.from_client');
  end if;

  -- .biz only.
  if to_regclass('public.package_subscriptions') is not null then
    drop trigger if exists alert_owner_subscription_created on public.package_subscriptions;
    create trigger alert_owner_subscription_created
      after insert on public.package_subscriptions
      for each row execute function public.notify_owner_event('subscription.created');
  end if;
end;
$$;
