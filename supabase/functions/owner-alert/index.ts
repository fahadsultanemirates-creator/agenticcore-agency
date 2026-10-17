// The website telling the owner something happened.
//
// Called by Postgres, not by a browser. Every alert-worthy event is a
// row appearing or changing, so the trigger fires from inside the same
// transaction that wrote it -- which is the point of doing it this way
// rather than having the page make the call. A page can be closed, lose
// its connection, or simply not bother; a committed row cannot. An
// order cannot be placed without this firing.
//
// Auth is a shared secret in a header, matching telegram-webhook and
// payram-webhook: verify_jwt is off because the caller is pg_net, which
// has no user session to present. The secret lives in Supabase Vault on
// the database side and in OWNER_ALERT_SECRET here.
//
// Fails closed. With no secret configured every request is refused,
// rather than leaving an open endpoint that will DM the owner whatever
// a stranger posts to it.

import { renderMessage, secretsMatch, type AlertPayload } from '../_shared/alert-core.ts';

const OWNER_ALERT_SECRET = Deno.env.get('OWNER_ALERT_SECRET') || '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const OWNER_TELEGRAM_ID = Deno.env.get('OWNER_TELEGRAM_ID') || '';
const BRAND = Deno.env.get('ALERT_BRAND') || 'AgenticCore.agency';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

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

  if (!secretsMatch(req.headers.get('X-Alert-Secret') ?? '', OWNER_ALERT_SECRET)) {
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
