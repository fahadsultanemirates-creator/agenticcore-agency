// The website telling the owner something happened.
//
// Called by Postgres, not by a browser. Every alert-worthy event is a
// row appearing or changing, so the trigger fires from inside the same
// transaction that wrote it -- which is the point of doing it this way
// rather than having the page make the call. A page can be closed, lose
// its connection, or simply not bother; a committed row cannot. An
// order cannot be placed without this firing.
//
// AUTH. A shared secret in a header, like telegram-webhook and
// payram-webhook. verify_jwt is off because the caller is pg_net, which
// has no user session to present.
//
// The secret is read from Vault rather than from an environment
// variable, and that is deliberate: it means the value exists in
// exactly one place. The migration generates it with
// gen_random_bytes(), so nobody -- not the owner, not an assistant
// setting this up -- ever has to type it, paste it between two consoles,
// or have it sit in a chat log. Rotating it is one UPDATE and no deploy.
//
// Read per request, not cached. Alerts are rare (a handful a day), so
// the query costs nothing worth optimising, and a cache would keep a
// rotated secret working until the isolate happened to recycle.
//
// Fails closed. If the secret cannot be read, every request is refused.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderMessage, secretsMatch, type AlertPayload } from '../_shared/alert-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const OWNER_TELEGRAM_ID = Deno.env.get('OWNER_TELEGRAM_ID') || '';
const BRAND = Deno.env.get('ALERT_BRAND') || 'AgenticCore.agency';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** The expected secret, from Vault. Empty string on any failure. */
async function expectedSecret(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .schema('vault')
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', 'owner_alert_secret')
    .maybeSingle();
  if (error) {
    // Never log the value, only that the lookup failed.
    console.error('owner-alert: could not read owner_alert_secret:', error.message);
    return '';
  }
  return (data?.decrypted_secret as string | undefined) ?? '';
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !OWNER_TELEGRAM_ID) {
    console.error('owner-alert: TELEGRAM_BOT_TOKEN or OWNER_TELEGRAM_ID unset; alert dropped');
    return;
  }
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: OWNER_TELEGRAM_ID, text, disable_web_page_preview: true })
  });
  if (!res.ok) {
    // Status only. The bot token is in the URL and must never be logged.
    console.error(`owner-alert: Telegram refused the message (${res.status})`);
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  // No CORS headers, deliberately: no browser should ever call this, so
  // there is nothing to permit.
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // secretsMatch refuses everything when the expected value is empty,
  // so an unreadable Vault closes the door rather than opening it.
  if (!secretsMatch(req.headers.get('X-Alert-Secret') ?? '', await expectedSecret())) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: AlertPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Always 200 once authorised. pg_net reads no body and retries
  // nothing, so a non-2xx would only add noise to net._http_response
  // while the alert is lost either way -- the log line is what a human
  // would actually look at.
  try {
    await sendTelegram(renderMessage(payload, BRAND));
  } catch (err) {
    console.error('owner-alert: send failed', err);
  }
  return new Response('ok');
}

Deno.serve(handleRequest);
