-- Reading the secret through PostgREST needs a function in an exposed
-- schema.
--
-- The edge function first tried supabaseAdmin.schema('vault'), which
-- fails with "Invalid schema: vault" however the SQL grants are set:
-- PostgREST only serves the schemas it is configured to expose, and
-- vault is deliberately not one of them. Checking has_table_privilege
-- was necessary and not sufficient, which is how that got past review.
--
-- So: one SECURITY DEFINER function in public, returning the one secret
-- it is named after, and executable by nobody except service_role.
-- Postgres grants EXECUTE to PUBLIC on every new function by default,
-- so the revoke below is the part that matters -- without it, any
-- anonymous visitor could call this over the REST API and read the
-- secret.
create or replace function public.owner_alert_expected_secret()
returns text
language sql
security definer
set search_path to 'vault', 'public'
stable
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'owner_alert_secret';
$$;

revoke all on function public.owner_alert_expected_secret() from public;
revoke all on function public.owner_alert_expected_secret() from anon;
revoke all on function public.owner_alert_expected_secret() from authenticated;
grant execute on function public.owner_alert_expected_secret() to service_role;

comment on function public.owner_alert_expected_secret is
  'Returns owner_alert_secret for the owner-alert edge function, which '
  'cannot reach the vault schema through PostgREST. service_role only: '
  'anon and authenticated are explicitly revoked, including the default '
  'grant to PUBLIC.';
