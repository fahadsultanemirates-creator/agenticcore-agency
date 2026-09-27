-- referral.html promises "A dedicated Referrals section shows your direct
-- and indirect referrals at every level" but the dashboard has never had
-- one -- profiles_select_own blocks a client from reading anyone else's
-- row, including people who referred_by = you. This adds a security
-- definer RPC that returns exactly the caller's own 3-level downline
-- (never parameterized by a target user, so it can only ever return the
-- caller's own tree) for that section to actually render.

create or replace function public.get_my_referral_tree()
returns table (level int, id uuid, full_name text, company_name text)
language sql
security definer
set search_path = public
stable
as $$
  with l1 as (
    select p.id, p.full_name, p.company_name
    from public.profiles p
    where p.referred_by = auth.uid()
  ),
  l2 as (
    select p.id, p.full_name, p.company_name
    from public.profiles p
    where p.referred_by in (select id from l1)
  ),
  l3 as (
    select p.id, p.full_name, p.company_name
    from public.profiles p
    where p.referred_by in (select id from l2)
  )
  select 1 as level, id, full_name, company_name from l1
  union all
  select 2 as level, id, full_name, company_name from l2
  union all
  select 3 as level, id, full_name, company_name from l3;
$$;

grant execute on function public.get_my_referral_tree() to authenticated;
