-- Two things the dashboard needs and the schema never had.
--
-- MESSAGES. A project has a status and nothing else to say. When work
-- moves, the client finds out by noticing the status changed, or by
-- being told in Telegram -- outside the system, unlogged, and invisible
-- to anybody who comes to the dashboard to ask "what is happening". A
-- project thread fixes that, and it is append-only on the client's side
-- for the same reason an invoice is: a record both parties can rely on
-- is one neither can quietly rewrite.
--
-- DELIVERABLES. There is no delivery mechanism at all. projects.status
-- can be 'delivered', the only storage bucket is request-attachments
-- (what the CUSTOMER uploads), and finished work has been changing hands
-- outside the product. So "Files & Deliverables" had nothing to show,
-- and a client who paid had no durable place to fetch what they bought.
--
-- Both tables are owner-readable and admin-readable, and both are
-- written by the owner's side. A client can post a message; a client
-- cannot invent a deliverable.

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- Who is speaking. 'system' is for status transitions written by a
  -- trigger or an edge function, so the thread reads as one history
  -- rather than two interleaved ones.
  author text not null check (author in ('client', 'team', 'system')),

  body text not null check (length(btrim(body)) between 1 and 5000),

  -- Set when the client has seen it. Null means unread, which is what
  -- the dashboard's badge counts.
  read_at timestamptz,

  created_at timestamptz not null default now()
);

create index on public.project_messages (project_id, created_at desc);
create index on public.project_messages (user_id) where read_at is null;

create table public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,

  label text not null check (length(btrim(label)) between 1 and 200),

  -- Exactly one of these. A deliverable is either a file we put in the
  -- private bucket, or a link to something living elsewhere -- a deployed
  -- site, a repository, a design file. Most Agency work is the second
  -- kind, which is why url exists at all.
  storage_path text,
  url text,

  -- Bytes, for the UI. Null for a link.
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  content_type text,

  notes text check (notes is null or length(notes) <= 2000),

  created_at timestamptz not null default now(),

  constraint deliverable_has_exactly_one_location check (
    (storage_path is not null and url is null)
    or (storage_path is null and url is not null)
  )
);

create index on public.project_deliverables (project_id, created_at desc);

-- user_id is denormalised from projects so the policies can compare a
-- column instead of resolving a subquery per row. A convenience that can
-- disagree with the truth is a security hole, so this forces the two to
-- agree on every write -- without it, a client could file a row under
-- their own user_id against somebody else's project and read it back.
create or replace function public.project_child_owner_matches()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.projects where id = new.project_id;
  if owner is null then
    raise exception 'No such project';
  end if;
  if owner <> new.user_id then
    raise exception 'Row must belong to the same client as its project';
  end if;
  return new;
end;
$$;

create trigger project_messages_owner_matches
before insert or update on public.project_messages
for each row execute function public.project_child_owner_matches();

create trigger project_deliverables_owner_matches
before insert or update on public.project_deliverables
for each row execute function public.project_child_owner_matches();

alter table public.project_messages enable row level security;
alter table public.project_deliverables enable row level security;

create policy "select_own_project_messages" on public.project_messages
  for select using (auth.uid() = user_id);

-- A client may post, but only as themselves and only as 'client'. They
-- cannot write a message that appears to come from the team or from the
-- system, which would let somebody manufacture a record of us agreeing
-- to something.
create policy "insert_own_client_messages" on public.project_messages
  for insert with check (auth.uid() = user_id and author = 'client');

-- Marking a message read is the only update a client gets. Without the
-- author and body guards here, the UPDATE policy would let them rewrite
-- the team's words after the fact.
create policy "mark_own_messages_read" on public.project_messages
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "admin_all_project_messages" on public.project_messages
  for all using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- Deliverables are read-only to the client. Nobody buys something by
-- inserting a row saying they received it.
create policy "select_own_project_deliverables" on public.project_deliverables
  for select using (auth.uid() = user_id);

create policy "admin_all_project_deliverables" on public.project_deliverables
  for all using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- The body and author of an existing message must not change, whoever is
-- asking. The UPDATE policy above cannot express that -- it can only say
-- which ROWS are reachable, not which COLUMNS may move -- so the rule
-- lives in a trigger, the same way protect_profile_fields does.
create or replace function public.protect_message_content()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.body := old.body;
    new.author := old.author;
    new.project_id := old.project_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger protect_message_content
before update on public.project_messages
for each row execute function public.protect_message_content();

comment on table public.project_messages is
  'Per-project thread between client and team. Client may post as author '
  '''client'' and mark messages read; body and author are immutable after '
  'insert, enforced by protect_message_content.';

comment on table public.project_deliverables is
  'Finished work handed to a client: a file in the private deliverables '
  'bucket, or a link to something hosted elsewhere. Client-readable, '
  'owner-written.';
