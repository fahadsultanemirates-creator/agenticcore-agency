-- Adds 'forge' as a third valid bot_conversations.channel, for the
-- Forge project-setup agent embedded in the dashboard's New Request
-- flow. Reuses the exact same bot_conversations/bot_messages schema and
-- RLS lockdown from 0008 (still zero anon/authenticated policies --
-- only the forge-chat Edge Function's service_role client touches these
-- rows) -- just a wider channel constraint, nothing else changes.
--
-- Unlike 'widget' (anonymous visitor_id) and 'telegram' (chat_id),
-- 'forge' conversations use external_id = the authenticated user's own
-- id (auth.uid(), resolved server-side by forge-chat from the caller's
-- real session, not client-supplied) -- so persistent memory falls out
-- of the existing schema for free: a client returning to New Request
-- later has Forge remember the prior conversation, same guarantee the
-- other two channels already have. Run once via Supabase Dashboard >
-- SQL Editor (or `supabase db push`), after 0001-0008.

alter table public.bot_conversations drop constraint bot_conversations_channel_check;
alter table public.bot_conversations add constraint bot_conversations_channel_check
  check (channel in ('widget', 'telegram', 'forge'));
