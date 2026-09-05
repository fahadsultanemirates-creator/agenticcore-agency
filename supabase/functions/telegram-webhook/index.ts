// AgenticCore Agency — Telegram bot webhook. Registered as the bot's
// webhook URL via Telegram's setWebhook API. Every message Telegram
// routes here goes through handleIncomingMessage() in ../_shared/bot-core.ts,
// same as the homepage widget -- but on the 'telegram' channel that core
// now answers via xAI's Grok instead of OpenRouter, and can file a
// manager_tasks row for the account owner to follow up on.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleIncomingMessage } from '../_shared/bot-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
const XAI_API_KEY = Deno.env.get('XAI_API_KEY')!;
const XAI_MODEL = Deno.env.get('XAI_MODEL') || undefined;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
// Telegram's hard limit is 4096 chars; this is just a safety margin so a
// long reply can't itself cause the sendMessage call to fail.
const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const truncated =
    text.length > MAX_TELEGRAM_MESSAGE_LENGTH ? text.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH) + '…' : text;

  const resp = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: truncated })
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error(`Telegram sendMessage failed (${resp.status}):`, body);
  }
}

// Exported separately from the Deno.serve() call below purely so it can
// be exercised directly in tests without needing a real Deno HTTP server.
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Only accept requests carrying the secret Telegram was configured
  // (via setWebhook's secret_token) to send on every call -- rejects
  // anyone who discovers this URL and tries to post fake updates.
  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const message = update?.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  // Always ack 200 for anything we're deliberately not handling
  // (edited messages, photos/stickers with no text, channel posts,
  // etc.) -- returning a non-2xx here makes Telegram retry the same
  // update repeatedly.
  if (!chatId || typeof text !== 'string' || text.trim() === '') {
    return new Response('ok');
  }

  const languageHint: string | undefined = message?.from?.language_code || undefined;

  try {
    const result = await handleIncomingMessage({
      supabaseAdmin,
      channel: 'telegram',
      externalId: String(chatId),
      userMessage: text,
      xaiApiKey: XAI_API_KEY,
      model: XAI_MODEL,
      languageHint
    });

    await sendTelegramMessage(chatId, result.reply);
  } catch (err) {
    console.error('telegram-webhook: unhandled error', err);
    // Best-effort -- if this also fails, there's nothing more to do
    // short of dropping the update, which is the safer failure mode.
    await sendTelegramMessage(
      chatId,
      'Something went wrong on our end. Please try again in a moment, or reach out directly: https://t.me/agenticcore_managers'
    ).catch(() => {});
  }

  return new Response('ok');
}

Deno.serve(handleRequest);
