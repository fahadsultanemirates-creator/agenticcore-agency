-- manager_tasks: lightweight task queue filed by the Telegram bot
-- (see supabase/functions/_shared/bot-core.ts's createManagerTask) when
-- a conversation describes something the account owner should
-- personally follow up on. public_id (e.g. "AC-AGENCY-0001") is
-- generated in code, not by a Postgres sequence: count existing rows
-- for the brand, add one, pad to 4 digits.
--
-- This table was already created directly via the Supabase SQL Editor,
-- so running this migration is not required for the live database to
-- work -- it exists purely so the schema is tracked in git, matching
-- what's actually live. Written to match that live table exactly.

create table if not exists public.manager_tasks (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  brand text not null default 'agency',
  channel text not null default 'telegram',
  external_id text,
  title text not null,
  task_type text not null default 'general',
  brief text,
  status text not null default 'waiting_you'
    check (status in ('new', 'scoped', 'waiting_you', 'building', 'review', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
