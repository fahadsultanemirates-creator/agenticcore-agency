/**
 * POST /nwp/ai/chat — NWP AI support agent (SSE streaming).
 * Auth is optional; providing a valid session personalises escalation.
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { nwpUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyCustomerToken, CUSTOMER_COOKIE } from "../../lib/nwpJwt";
import { NWP_SYSTEM_PROMPT, getEscalationContact } from "../../lib/nwpKnowledgeBase";

const router = Router();

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /nwp/ai/chat
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    // Optionally resolve user package for personalised escalation
    let userPackage: string | null = null;
    try {
      const token =
        req.cookies?.[CUSTOMER_COOKIE] ||
        (req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : null);
      if (token) {
        const decoded = verifyCustomerToken(token);
        if (decoded?.id) {
          const [u] = await db
            .select({ package: nwpUsersTable.package })
            .from(nwpUsersTable)
            .where(eq(nwpUsersTable.id, decoded.id))
            .limit(1);
          userPackage = u?.package ?? null;
        }
      }
    } catch {
      // Auth failure is fine — unauthenticated users still get support
    }

    const escalation = getEscalationContact(userPackage);
    const escalationNote = `\n\nThe current user's package tier is: ${userPackage ?? "unknown/unregistered"}. Escalation contact for this user: ${escalation.channel} — ${escalation.contact} (${escalation.responseTime} response time).`;

    const systemPrompt = NWP_SYSTEM_PROMPT + escalationNote;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const openai = getOpenAIClient();

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-12), // keep last 12 messages for context
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("[AI chat]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI service unavailable" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
