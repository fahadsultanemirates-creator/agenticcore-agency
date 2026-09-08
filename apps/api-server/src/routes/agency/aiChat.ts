/**
 * POST /agency/ai/chat — AgenticCore.agency AI support assistant (SSE streaming).
 * No auth required — helps any visitor understand the platform.
 */
import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const SYSTEM_PROMPT = `You are the AgenticCore.agency support assistant. You are friendly, concise, and knowledgeable about the platform.

About AgenticCore.agency:
- An AI-powered business agency with 22 specialist AI agents
- Customers submit a task brief; a manager agent dispatches the right specialists
- Results delivered in under 5 minutes, 24/7

Services offered:
- Website Builder: Multi-page sites built and deployed
- Crypto & Forex Platforms: Full investor portals with dashboard, P&L, referral system
- 24/7 Marketing Campaigns: Ad copy, creatives, targeting
- Marketing Strategy: Go-to-market plans, 90-day roadmaps
- SEO & Analytics: GA4, on-page optimisation, keyword research
- Social Media Strategy: 30-day content calendars, hashtag research
- Bookkeeping & Finance: P&L, budgets, forecasting, dashboards
- Legal Documents & Contracts: T&Cs, privacy policies, contracts
- Smart Contracts (Solidity): ERC-20, NFT, DeFi, DAO + deploy scripts
- Site Audit & Performance: UX, performance, accessibility
- AI Image Generation: Brand visuals and illustrations
- PDF Reports: Professional branded reports

Pricing: Credit-based system
- General tasks (content, research): 1 credit
- Standard tasks (SEO, legal, marketing): 2–3 credits
- Complex tasks (websites, smart contracts): 4–6 credits
Credits are assigned by an account manager after registration.

How it works:
1. Register and get credits
2. Submit a task brief
3. Manager agent dispatches specialists
4. Download or deploy your result

Keep responses helpful, brief (2-4 sentences unless more detail is asked for), and professional. If asked about something outside the platform, politely redirect to what you can help with.`;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-10),
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
    console.error("[Agency AI chat]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI service unavailable" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
