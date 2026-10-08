// Opens a USDT invoice for a request, and tells the client exactly what to
// send.
//
// The amount carries a nonce in its last four decimal places, which is the
// only thing identifying the payment -- there is one receiving address and
// no memo field. See _shared/usdtAmount.ts.
//
// Replaces payram-create-payment. It also replaces something that was not
// a payment system at all: the request page printed the address and the
// plain price, and asked the client to message Telegram with their
// transaction hash so a human could match it up by hand.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { chainConfigured } from '../_shared/usdtChain.ts';
import { createUsdtInvoice } from '../_shared/usdtInvoice.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

async function resolveCaller(authHeader: string): Promise<{ id: string } | null> {
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // There is no API key to forget any more -- the contract read and the
  // transfer list are both plain RPC calls against public BNB Chain nodes.
  // The check stays because BSC_RPC_URL may one day point somewhere that
  // does need a credential, and a payment page that quotes an amount
  // nobody is watching for is worse than one that says it is down.
  if (!chainConfigured()) {
    console.error('usdt-invoice: no BNB Chain RPC node is configured');
    return jsonResponse({ error: 'Crypto payment is not configured yet. Please try again shortly.' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);
  const caller = await resolveCaller(authHeader);
  if (!caller) return jsonResponse({ error: 'Not authenticated' }, 401);

  let body: { requestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
  if (!requestId) return jsonResponse({ error: 'Which request is this for?' }, 400);

  const result = await createUsdtInvoice(caller.id, requestId);
  if (!result.ok) {
    return jsonResponse(
      result.detail ? { error: result.error, detail: result.detail } : { error: result.error },
      result.status
    );
  }
  return jsonResponse(result.invoice);
}

Deno.serve(handleRequest);
