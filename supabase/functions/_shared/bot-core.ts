// AgenticCore Agency — shared bot logic. handleIncomingMessage() backs
// the two front-desk bots (homepage widget + Telegram); handleForgeMessage()
// (bottom of file) backs Forge, the dashboard's New Request project-setup
// agent. Both share the same low-level helpers (conversation lookup,
// rate limiting, the OpenRouter call itself) since the request/response
// shape is identical -- only the system prompt and the JSON schema
// differ per persona. Channel-agnostic on purpose: takes plain text in,
// returns plain text (or structured fields) out, knows nothing about
// HTTP requests or Telegram updates -- what would let a future voice
// layer wrap this instead of requiring a rewrite.

import { BUSINESS_KNOWLEDGE_PROMPT, FORGE_SYSTEM_PROMPT, PRICING_CATALOG, CATALOG_CATEGORY_NAMES } from './business-knowledge.ts';

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

export type Channel = 'widget' | 'telegram' | 'forge';

export interface BotConversation {
  id: string;
  channel: Channel;
  external_id: string;
  language: string | null;
  needs_human: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface HandleMessageParams {
  supabaseAdmin: SupabaseAdmin;
  channel: Channel;
  externalId: string;
  userMessage: string;
  openRouterApiKey: string;
  model?: string;
  // Optional signal from the transport layer (Telegram's per-user
  // language_code, or the browser's navigator.language) -- not a
  // default, just an extra hint appended to the system prompt so the
  // model has something to go on before the visitor's own words give it
  // away (e.g. the very first "/start" on Telegram).
  languageHint?: string;
}

export interface HandleMessageResult {
  reply: string;
  needsHuman: boolean;
  rateLimited?: boolean;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5';
const HISTORY_LIMIT = 30;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_USER_MESSAGES = 20;

// These two strings are the only bot-authored text that isn't produced
// by the model itself -- rare system-level fallbacks (an actual outage,
// or someone hammering the endpoint), not the bot "defaulting to
// English" in normal conversation. Kept in English deliberately: they're
// infrastructure fallbacks outside the per-message language-mirroring
// the model otherwise always does.
const RATE_LIMIT_MESSAGE =
  "You're sending messages a bit too quickly — please wait a few minutes and try again.";
const GENERIC_ERROR_MESSAGE =
  'Something went wrong on our end. Please try again in a moment, or reach out directly: https://t.me/agenticcore_managers';

export async function findOrCreateConversation(
  supabaseAdmin: SupabaseAdmin,
  channel: Channel,
  externalId: string
): Promise<BotConversation> {
  const { data: existing } = await supabaseAdmin
    .from('bot_conversations')
    .select('*')
    .eq('channel', channel)
    .eq('external_id', externalId)
    .maybeSingle();

  if (existing) return existing as BotConversation;

  const { data: created, error } = await supabaseAdmin
    .from('bot_conversations')
    .insert({ channel, external_id: externalId })
    .select('*')
    .single();

  if (error) throw error;
  return created as BotConversation;
}

export async function getRecentMessages(
  supabaseAdmin: SupabaseAdmin,
  conversationId: string,
  limit = HISTORY_LIMIT
): Promise<BotMessage[]> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data as BotMessage[]) || []).reverse();
}

export async function getConversationHistory(
  supabaseAdmin: SupabaseAdmin,
  channel: Channel,
  externalId: string,
  limit = HISTORY_LIMIT
): Promise<BotMessage[]> {
  const { data: conversation } = await supabaseAdmin
    .from('bot_conversations')
    .select('id')
    .eq('channel', channel)
    .eq('external_id', externalId)
    .maybeSingle();

  if (!conversation) return [];
  return getRecentMessages(supabaseAdmin, conversation.id, limit);
}

async function isRateLimited(supabaseAdmin: SupabaseAdmin, conversationId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .gte('created_at', windowStart);

  return (count || 0) >= RATE_LIMIT_MAX_USER_MESSAGES;
}

const REPLY_JSON_SCHEMA = {
  name: 'agenticcore_bot_reply',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: "The reply to send to the visitor, written entirely in the visitor's own language."
      },
      detected_language: {
        type: 'string',
        description: 'ISO 639-1 code (or best-guess language name) of the language the visitor wrote in.'
      },
      needs_human: {
        type: 'boolean',
        description:
          'True if this conversation should be handed off to a human -- custom/large scope, price/scope negotiation, signs of frustration, or any commitment beyond pre-approved terms.'
      },
      uncertain: {
        type: 'boolean',
        description: 'True if the assistant is not confident in the reply, or the question falls outside the given business knowledge.'
      }
    },
    required: ['reply', 'detected_language', 'needs_human', 'uncertain'],
    additionalProperties: false
  }
};

interface ParsedReply {
  reply: string;
  detected_language: string;
  needs_human: boolean;
  uncertain: boolean;
}

// deno-lint-ignore no-explicit-any
async function callOpenRouter<T>(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  jsonSchema: Record<string, any>
): Promise<T> {
  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://agenticcore.agency',
      'X-Title': 'AgenticCore Bot'
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: 'json_schema', json_schema: jsonSchema },
      temperature: 0.4
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter request failed (${resp.status}): ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter response missing message content');
  return JSON.parse(content) as T;
}

export async function handleIncomingMessage(params: HandleMessageParams): Promise<HandleMessageResult> {
  const { supabaseAdmin, channel, externalId, userMessage, openRouterApiKey, model, languageHint } = params;

  const conversation = await findOrCreateConversation(supabaseAdmin, channel, externalId);

  if (await isRateLimited(supabaseAdmin, conversation.id)) {
    return { reply: RATE_LIMIT_MESSAGE, needsHuman: false, rateLimited: true };
  }

  const history = await getRecentMessages(supabaseAdmin, conversation.id);

  const systemPrompt = languageHint
    ? `${BUSINESS_KNOWLEDGE_PROMPT}\n\n(Platform hint, not a rule: this visitor's device/client language looks like "${languageHint}". Use it only if their own message gives you no better signal -- their actual words always win.)`
    : BUSINESS_KNOWLEDGE_PROMPT;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let parsed: ParsedReply;
  try {
    parsed = await callOpenRouter<ParsedReply>(openRouterApiKey, model || DEFAULT_MODEL, messages, REPLY_JSON_SCHEMA);
  } catch (err) {
    console.error('OpenRouter call failed:', err);
    return { reply: GENERIC_ERROR_MESSAGE, needsHuman: false };
  }

  const needsHuman = Boolean(parsed.needs_human);
  const uncertain = Boolean(parsed.uncertain);

  await supabaseAdmin.from('bot_messages').insert([
    {
      conversation_id: conversation.id,
      role: 'user',
      content: userMessage,
      detected_language: parsed.detected_language || null
    },
    {
      conversation_id: conversation.id,
      role: 'assistant',
      content: parsed.reply,
      detected_language: parsed.detected_language || null,
      uncertain,
      handoff_triggered: needsHuman
    }
  ]);

  await supabaseAdmin
    .from('bot_conversations')
    .update({
      language: parsed.detected_language || conversation.language,
      needs_human: conversation.needs_human || needsHuman
    })
    .eq('id', conversation.id);

  return { reply: parsed.reply, needsHuman };
}

// ============================================================
// Forge -- the dashboard's New Request project-setup agent. Shares
// findOrCreateConversation/getRecentMessages/isRateLimited/callOpenRouter
// above; has its own system prompt, JSON schema, and result shape since
// its job (extract a structured request) isn't the front-desk bots' job
// (answer questions, decide on a human handoff).
// ============================================================

export interface HandleForgeMessageParams {
  supabaseAdmin: SupabaseAdmin;
  // The authenticated dashboard user's own id, resolved server-side by
  // forge-chat from the caller's real session -- never client-supplied.
  // Doubles as external_id, so persistent memory across sessions falls
  // out of the existing schema for free.
  userId: string;
  userMessage: string;
  openRouterApiKey: string;
  model?: string;
}

export interface ForgeResult {
  reply: string;
  // Empty string in all four until readyToSubmit is true -- Forge only
  // hands over a complete, validated set together, once.
  serviceCategory: string;
  taskType: string;
  tier: '' | 'low' | 'mid' | 'high';
  descriptionSummary: string;
  readyToSubmit: boolean;
  rateLimited?: boolean;
}

const FORGE_JSON_SCHEMA = {
  name: 'forge_project_setup',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: "Forge's response to the client, written entirely in their own language."
      },
      detected_language: { type: 'string' },
      service_category: {
        type: 'string',
        enum: [...CATALOG_CATEGORY_NAMES, ''],
        description: 'Exact catalog category name once determined together with task_type/tier/description_summary, else empty string.'
      },
      task_type: {
        type: 'string',
        description: 'Exact catalog item name (verbatim, within service_category) once determined, else empty string.'
      },
      tier: {
        type: 'string',
        enum: ['low', 'mid', 'high', ''],
        description: 'Once determined, else empty string.'
      },
      description_summary: {
        type: 'string',
        description: "Forge's own 2-4 sentence synthesized project brief once ready, else empty string."
      },
      ready_to_submit: {
        type: 'boolean',
        description: 'True only once service_category, task_type, tier, and description_summary are ALL confidently set together.'
      }
    },
    required: ['reply', 'detected_language', 'service_category', 'task_type', 'tier', 'description_summary', 'ready_to_submit'],
    additionalProperties: false
  }
};

interface ParsedForgeReply {
  reply: string;
  detected_language: string;
  service_category: string;
  task_type: string;
  tier: string;
  description_summary: string;
  ready_to_submit: boolean;
}

// Never trust the model's own ready_to_submit at face value -- a
// hallucinated category/task_type pairing (or a tier outside the real
// three) should never reach the frontend's review-and-submit card.
function isValidForgeExtraction(serviceCategory: string, taskType: string, tier: string, descriptionSummary: string): boolean {
  const category = PRICING_CATALOG.find((cat) => cat.category === serviceCategory);
  if (!category) return false;
  if (!category.items.some((item) => item.name === taskType)) return false;
  if (!['low', 'mid', 'high'].includes(tier)) return false;
  if (descriptionSummary.trim() === '') return false;
  return true;
}

export async function handleForgeMessage(params: HandleForgeMessageParams): Promise<ForgeResult> {
  const { supabaseAdmin, userId, userMessage, openRouterApiKey, model } = params;

  const emptyExtraction = { serviceCategory: '', taskType: '', tier: '' as const, descriptionSummary: '', readyToSubmit: false };

  const conversation = await findOrCreateConversation(supabaseAdmin, 'forge', userId);

  if (await isRateLimited(supabaseAdmin, conversation.id)) {
    return { reply: RATE_LIMIT_MESSAGE, ...emptyExtraction, rateLimited: true };
  }

  const history = await getRecentMessages(supabaseAdmin, conversation.id);

  const messages = [
    { role: 'system', content: FORGE_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ];

  let parsed: ParsedForgeReply;
  try {
    parsed = await callOpenRouter<ParsedForgeReply>(openRouterApiKey, model || DEFAULT_MODEL, messages, FORGE_JSON_SCHEMA);
  } catch (err) {
    console.error('Forge OpenRouter call failed:', err);
    return { reply: GENERIC_ERROR_MESSAGE, ...emptyExtraction };
  }

  const readyToSubmit =
    Boolean(parsed.ready_to_submit) &&
    isValidForgeExtraction(parsed.service_category, parsed.task_type, parsed.tier, parsed.description_summary);

  await supabaseAdmin.from('bot_messages').insert([
    {
      conversation_id: conversation.id,
      role: 'user',
      content: userMessage,
      detected_language: parsed.detected_language || null
    },
    {
      conversation_id: conversation.id,
      role: 'assistant',
      content: parsed.reply,
      detected_language: parsed.detected_language || null
    }
  ]);

  await supabaseAdmin
    .from('bot_conversations')
    .update({ language: parsed.detected_language || conversation.language })
    .eq('id', conversation.id);

  return {
    reply: parsed.reply,
    serviceCategory: readyToSubmit ? parsed.service_category : '',
    taskType: readyToSubmit ? parsed.task_type : '',
    tier: readyToSubmit ? (parsed.tier as 'low' | 'mid' | 'high') : '',
    descriptionSummary: readyToSubmit ? parsed.description_summary : '',
    readyToSubmit
  };
}
