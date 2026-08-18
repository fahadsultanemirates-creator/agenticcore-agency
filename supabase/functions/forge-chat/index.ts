// AgenticCore Agency — Forge, the dashboard's New Request project-setup
// agent. Unlike widget-chat (deliberately open to anonymous pre-signup
// visitors), this endpoint requires a real, logged-in Supabase session --
// Forge only exists inside the dashboard, and its external_id (for the
// shared bot_conversations schema) is the caller's own resolved user id,
// never a client-supplied value.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleForgeMessage, getConversationHistory } from '../_shared/bot-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || undefined;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_MESSAGE_LENGTH = 4000;

// service_role client for the actual bot_conversations/bot_messages
// reads/writes -- same pattern as widget-chat/telegram-webhook. Kept
// separate from the per-request auth check below, which uses a
// different, narrowly-scoped client.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

// Resolves the caller's real identity from their own session token --
// never trust a client-supplied user id. A fresh client scoped to just
// this request's Authorization header, mirroring how an authenticated
// browser-side supabaseClient call is verified.
async function resolveCallerId(authHeader: string): Promise<string | null> {
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const userId = await resolveCallerId(authHeader);
  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, message } = body || {};

  if (action === 'history') {
    const history = await getConversationHistory(supabaseAdmin, 'forge', userId);
    return jsonResponse({
      messages: history.map((m) => ({ role: m.role, content: m.content }))
    });
  }

  if (action === 'message') {
    if (typeof message !== 'string' || message.trim() === '') {
      return jsonResponse({ error: 'Missing message' }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: 'Message too long' }, 400);
    }

    const result = await handleForgeMessage({
      supabaseAdmin,
      userId,
      userMessage: message,
      openRouterApiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL
    });

    return jsonResponse({
      reply: result.reply,
      serviceCategory: result.serviceCategory,
      taskType: result.taskType,
      tier: result.tier,
      descriptionSummary: result.descriptionSummary,
      readyToSubmit: result.readyToSubmit
    });
  }

  return jsonResponse({ error: 'Unknown action -- expected "message" or "history"' }, 400);
}

Deno.serve(handleRequest);
