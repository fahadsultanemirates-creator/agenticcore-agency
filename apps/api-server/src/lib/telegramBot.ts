/**
 * NWP Telegram support bot — webhook mode.
 * Telegram pushes updates to our HTTPS endpoint; no polling, no 409 conflicts.
 */
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import { NWP_SYSTEM_PROMPT } from "./nwpKnowledgeBase";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const conversations = new Map<number, ChatMessage[]>();
const MAX_HISTORY = 20;

let botInstance: TelegramBot | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[TelegramBot] OPENAI_API_KEY not set — AI replies disabled");
    return null;
  }
  return new OpenAI({ apiKey });
}

async function getAIReply(chatId: number, userMessage: string): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    return "I'm temporarily unavailable. Please email support@nexuswealthpartners.com for assistance.";
  }

  const history = conversations.get(chatId) ?? [];
  history.push({ role: "user", content: userMessage });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  conversations.set(chatId, history);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: NWP_SYSTEM_PROMPT },
        ...history,
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
    history.push({ role: "assistant", content: reply });
    conversations.set(chatId, history);
    return reply;
  } catch (err) {
    console.error("[TelegramBot] OpenAI error:", err);
    return "I'm having trouble connecting to AI right now. Please contact support@nexuswealthpartners.com.";
  }
}

const WELCOME_MESSAGE = `👋 Welcome to *Nexus Wealth Partners* support!

I'm your AI assistant. I can help you with:
• Investment packages & profit rates
• Deposit & withdrawal procedures
• Referral system rules
• Account status questions

Just type your question, or use:
/help — show this menu
/support — contact human support`;

const SUPPORT_MESSAGE = `📞 *Human Support Contacts*

📧 *Silver/Gold Members*: support@nexuswealthpartners.com _(48hr response)_
⚡ *Platinum/Emerald Members*: support@nexuswealthpartners.com _(24hr priority)_
💎 *VIP Pool Members*: @NWPVIPSupport on Telegram _(direct access)_

Please include your registered email and the nature of your issue.`;

function setupHandlers(bot: TelegramBot): void {
  bot.onText(/\/start/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[TelegramBot] /start handler error:", err);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[TelegramBot] /help handler error:", err);
    }
  });

  bot.onText(/\/support/, async (msg) => {
    try {
      await bot.sendMessage(msg.chat.id, SUPPORT_MESSAGE, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[TelegramBot] /support handler error:", err);
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    try {
      await bot.sendChatAction(msg.chat.id, "typing");
      const reply = await getAIReply(msg.chat.id, msg.text);
      await bot.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[TelegramBot] Message handler error:", err);
      try {
        await bot.sendMessage(
          msg.chat.id,
          "Sorry, I encountered an error. Please try again or contact support@nexuswealthpartners.com"
        );
      } catch {
        // Ignore send errors in the fallback — chat may be unreachable
      }
    }
  });

  // Catch any unhandled polling/webhook errors so they never crash the process
  bot.on("error", (err) => {
    console.error("[TelegramBot] Bot error:", err);
  });
}

/**
 * Returns the bot instance so the webhook route can call processUpdate().
 */
export function getTelegramBot(): TelegramBot | null {
  return botInstance;
}

/**
 * Initialises the bot in webhook mode.
 * Telegram will POST updates to: https://<REPLIT_DEV_DOMAIN>/api/nwp/telegram/webhook
 */
export async function initTelegramBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  if (botInstance) {
    console.log("[TelegramBot] Already initialized");
    return;
  }

  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain) {
    console.warn("[TelegramBot] REPLIT_DEV_DOMAIN not set — bot disabled");
    return;
  }

  try {
    // Initialize without polling; we handle updates via webhook
    const bot = new TelegramBot(token, { polling: false });
    botInstance = bot;

    // Register message handlers
    setupHandlers(bot);

    // Register our HTTPS endpoint with Telegram
    const webhookUrl = `https://${domain}/api/nwp/telegram/webhook`;
    await bot.setWebHook(webhookUrl, { drop_pending_updates: true } as any);
    console.log(`[TelegramBot] Webhook set → ${webhookUrl}`);
  } catch (err) {
    console.error("[TelegramBot] Failed to initialize:", err);
  }
}

export function stopTelegramBot(): void {
  if (botInstance) {
    botInstance.removeAllListeners();
    botInstance = null;
  }
}
