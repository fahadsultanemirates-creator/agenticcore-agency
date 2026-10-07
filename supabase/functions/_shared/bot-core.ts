// AgenticCore Agency — shared front-desk bot logic, used by the homepage
// widget, Telegram, and the dashboard's own Forge assistant. Channel-
// agnostic on purpose: it takes plain text in, returns plain text out,
// and knows nothing about HTTP requests or Telegram updates. That split
// is also what keeps a future voice layer (STT before this, TTS after)
// from requiring a rewrite -- it would wrap this function, not replace
// it.
//
// All three channels now run on the Claude API directly (previously
// widget was on OpenRouter and telegram/forge were on xAI's Grok --
// migrated so every AgenticCore assistant is Claude, with no other
// provider left in the stack). widget keeps the original 4-field JSON
// shape; telegram and forge share an expanded 7-field shape that can
// additionally file a manager_tasks row when the conversation describes
// something the manager should personally follow up on. forge is the
// dashboard's own project-intake assistant (see
// supabase/functions/forge-chat/index.ts) -- same brain as Telegram's
// manager bot, just reached from inside the dashboard by an
// already-signed-in client instead of from Telegram.

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.132.0';
import { zodOutputFormat } from 'https://esm.sh/@anthropic-ai/sdk@0.132.0/helpers/zod';
import { z } from 'https://esm.sh/zod@3.25.76';
import { BUSINESS_KNOWLEDGE_PROMPT } from './business-knowledge.ts';

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
  // Required for every channel -- the one provider all three now share.
  anthropicApiKey: string;
  // Model override -- a Claude model id, e.g. "claude-sonnet-5-5".
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

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

const HISTORY_LIMIT = 30;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_USER_MESSAGES = 20;

// manager_tasks id scheme: "AC-AGENCY-0001" -- brand prefix + a count of
// existing rows for that brand, zero-padded to 4 digits. No Postgres
// sequence; see createManagerTask() below for how the count-then-insert
// race is handled without one.
const TASK_BRAND = 'agency';
const TASK_ID_PREFIX = 'AC-AGENCY';
const MAX_TASK_ID_ATTEMPTS = 3;

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

// Additive context for the forge channel only, appended on top of the
// same BUSINESS_KNOWLEDGE_PROMPT every channel shares -- not a
// replacement persona, just the extra framing Telegram doesn't need
// (whoever's writing is already a signed-in client, not an anonymous
// visitor, and the dashboard has no "/start" message to hang a greeting
// off of the way Telegram does).
const FORGE_ADDITIVE_PROMPT = `You're embedded directly in the client's own dashboard (not Telegram or the public homepage) -- whoever is writing is already a signed-in client, not an anonymous visitor. If the conversation history above is empty, this is the very first thing they've said to you here: open with a short, warm welcome and invite them to describe a project they'd like to start, rather than diving straight into an answer. If they want to start one, guide them through describing it one step at a time (service, scope, budget expectations, any specifics) rather than demanding everything at once, until you have enough to file it as a task for the team -- same create_task/task_title/task_type judgment you'd use anywhere else.`;

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

const ReplyOutputSchema = z.object({
  reply: z.string().describe("The reply to send to the visitor, written entirely in the visitor's own language."),
  detected_language: z.string().describe('ISO 639-1 code (or best-guess language name) of the language the visitor wrote in.'),
  needs_human: z
    .boolean()
    .describe(
      'True if this conversation should be handed off to a human -- custom/large scope, price/scope negotiation, signs of frustration, or any commitment beyond pre-approved terms.'
    ),
  uncertain: z
    .boolean()
    .describe('True if the assistant is not confident in the reply, or the question falls outside the given business knowledge.')
});

interface ParsedReply {
  reply: string;
  detected_language: string;
  needs_human: boolean;
  uncertain: boolean;
}

// Telegram/manager-only: adds create_task/task_title/task_type on top of
// the base reply shape. task_title/task_type are always strings (empty
// when create_task is false) rather than nullable, since strict schema
// mode handles a plain required string more reliably than a nullable
// union.
const ManagerReplyOutputSchema = ReplyOutputSchema.extend({
  create_task: z
    .boolean()
    .describe(
      'True if this conversation describes concrete work the manager should personally track and follow up on (a project inquiry, a specific complaint, a request needing manual verification, anything already flagged as needing human handoff). False for ordinary questions you can already answer.'
    ),
  task_title: z.string().describe('Short (few-word) title summarizing the task. Empty string if create_task is false.'),
  task_type: z
    .string()
    .describe('Short category for the task, e.g. "website", "design", "marketing", "bug", "general". Empty string if create_task is false.')
});

interface ManagerParsedReply extends ParsedReply {
  create_task: boolean;
  task_title: string;
  task_type: string;
}

// Single call path for all three channels now that they share one
// provider. `schema` picks the output shape (plain reply vs. the
// manager/forge shape with create_task/task_title/task_type); effort
// stays low -- this is short conversational chat/classification work,
// not multi-step reasoning, so the top of the effort range buys nothing
// here (see the claude-api skill's cost-tuning guidance).
async function callClaude<T extends z.ZodTypeAny>(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  schema: T
): Promise<z.infer<T>> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse({
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: zodOutputFormat(schema) },
    messages: [...history, { role: 'user', content: userMessage }]
  });

  if (!response.parsed_output) {
    throw new Error('Claude response did not parse against the expected output schema');
  }
  return response.parsed_output;
}

// Count-then-insert, exactly as specified (no Postgres sequence): count
// existing rows for this brand, propose brand-1, pad to 4 digits. Two
// messages arriving close together could compute the same count, so this
// retries on a unique-violation against public_id's unique constraint
// (the actual race guard) rather than trusting the count alone.
async function createManagerTask(
  supabaseAdmin: SupabaseAdmin,
  params: { channel: Channel; externalId: string; title: string; taskType: string }
): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_TASK_ID_ATTEMPTS; attempt++) {
    const { count, error: countError } = await supabaseAdmin
      .from('manager_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('brand', TASK_BRAND);

    if (countError) throw countError;

    const publicId = `${TASK_ID_PREFIX}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { error: insertError } = await supabaseAdmin.from('manager_tasks').insert({
      public_id: publicId,
      brand: TASK_BRAND,
      channel: params.channel,
      external_id: params.externalId,
      title: params.title,
      task_type: params.taskType,
      status: 'waiting_you'
    });

    if (!insertError) return publicId;

    // 23505 = unique_violation on public_id -- another message raced on
    // the same count-based id. Recompute and retry; anything else is a
    // real error worth surfacing immediately.
    if (insertError.code !== '23505') throw insertError;
    lastError = insertError;
  }

  throw lastError ?? new Error('Could not allocate a unique manager task id after retries');
}

export async function handleIncomingMessage(params: HandleMessageParams): Promise<HandleMessageResult> {
  const { supabaseAdmin, channel, externalId, userMessage, anthropicApiKey, model, languageHint } = params;

  const conversation = await findOrCreateConversation(supabaseAdmin, channel, externalId);

  if (await isRateLimited(supabaseAdmin, conversation.id)) {
    return { reply: RATE_LIMIT_MESSAGE, needsHuman: false, rateLimited: true };
  }

  const history = await getRecentMessages(supabaseAdmin, conversation.id);

  let systemPrompt = BUSINESS_KNOWLEDGE_PROMPT;
  if (languageHint) {
    systemPrompt += `\n\n(Platform hint, not a rule: this visitor's device/client language looks like "${languageHint}". Use it only if their own message gives you no better signal -- their actual words always win.)`;
  }
  if (channel === 'forge') {
    systemPrompt += `\n\n${FORGE_ADDITIVE_PROMPT}`;
  }

  const claudeHistory: { role: 'user' | 'assistant'; content: string }[] = history.map((m) => ({
    role: m.role,
    content: m.content
  }));

  let reply: string;
  let detectedLanguage: string;
  let needsHuman: boolean;
  let uncertain: boolean;

  if (channel === 'telegram' || channel === 'forge') {
    let parsed: ManagerParsedReply;
    try {
      parsed = await callClaude(
        anthropicApiKey,
        model || DEFAULT_CLAUDE_MODEL,
        systemPrompt,
        claudeHistory,
        userMessage,
        ManagerReplyOutputSchema
      );
    } catch (err) {
      console.error('Claude call failed:', err);
      return { reply: GENERIC_ERROR_MESSAGE, needsHuman: false };
    }

    detectedLanguage = parsed.detected_language;
    needsHuman = Boolean(parsed.needs_human);
    uncertain = Boolean(parsed.uncertain);
    reply = parsed.reply;

    if (parsed.create_task) {
      try {
        const publicId = await createManagerTask(supabaseAdmin, {
          channel,
          externalId,
          title: parsed.task_title || 'Untitled task',
          taskType: parsed.task_type || 'general'
        });
        reply = `${reply}\n\nTask ID: ${publicId}`;
      } catch (err) {
        // A task-filing failure must not break the reply itself -- the
        // conversation still gets a normal answer, just without a task
        // filed. Logged so it's visible in the function's logs rather
        // than silently lost.
        console.error('createManagerTask failed:', err);
      }
    }
  } else {
    let parsed: ParsedReply;
    try {
      parsed = await callClaude(anthropicApiKey, model || DEFAULT_CLAUDE_MODEL, systemPrompt, claudeHistory, userMessage, ReplyOutputSchema);
    } catch (err) {
      console.error('Claude call failed:', err);
      return { reply: GENERIC_ERROR_MESSAGE, needsHuman: false };
    }

    detectedLanguage = parsed.detected_language;
    needsHuman = Boolean(parsed.needs_human);
    uncertain = Boolean(parsed.uncertain);
    reply = parsed.reply;
  }

  await supabaseAdmin.from('bot_messages').insert([
    {
      conversation_id: conversation.id,
      role: 'user',
      content: userMessage,
      detected_language: detectedLanguage || null
    },
    {
      conversation_id: conversation.id,
      role: 'assistant',
      content: reply,
      detected_language: detectedLanguage || null,
      uncertain,
      handoff_triggered: needsHuman
    }
  ]);

  await supabaseAdmin
    .from('bot_conversations')
    .update({
      language: detectedLanguage || conversation.language,
      needs_human: conversation.needs_human || needsHuman
    })
    .eq('id', conversation.id);

  return { reply, needsHuman };
}
