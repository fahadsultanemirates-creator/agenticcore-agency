-- Widens bot_conversations.channel to accept 'forge' -- the dashboard's
-- own project-intake assistant, reusing the exact same
-- handleIncomingMessage()/xAI/manager_tasks pipeline as the Telegram
-- bot (see bot-core.ts). external_id for a 'forge' conversation is the
-- authenticated user's own id, resolved server-side from their session
-- in forge-chat/index.ts, never client-supplied -- so persistent memory
-- across visits falls out of the existing schema for free, same as the
-- other two channels.
--
-- Numbered 0013 (not a resurrected 0009): an earlier, unmerged attempt
-- at Forge reserved 0009_forge_channel.sql on a separate branch, but
-- that branch was never merged and main has since moved well past 0010-
-- 0012. Reusing "0009" now would file this after migrations numbered
-- higher than it, which is confusing to read even though Postgres
-- itself only cares about application order, not filenames.

alter table public.bot_conversations drop constraint if exists bot_conversations_channel_check;
alter table public.bot_conversations add constraint bot_conversations_channel_check
  check (channel in ('widget', 'telegram', 'forge'));
