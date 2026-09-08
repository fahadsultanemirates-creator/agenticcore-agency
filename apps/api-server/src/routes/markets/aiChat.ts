import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const SYSTEM_PROMPT = `You are the AgenticCore Markets assistant — a helpful, knowledgeable support agent for a crypto and forex investment platform.

AgenticCore Markets at a glance:
- 50+ trading pairs: major crypto (BTC, ETH, BNB, SOL...) and forex (EUR/USD, GBP/USD, XAU/USD, USD/JPY...)
- Instant USDT deposits — send to your personal wallet address, reflects immediately
- Real-time P&L dashboard with live position tracking and trade history
- Referral commissions up to 10% — earn passively from your network's trading volume
- 24/7 automated trading with AI-assisted risk management
- Registration is free — takes under 2 minutes

Your role:
- Answer questions about accounts, deposits, trading pairs, P&L, referrals, withdrawals
- Guide new users through registration and first deposit
- Explain the referral system and commission tiers
- Be concise, friendly, and professional — no jargon
- Never promise guaranteed profits or give personal financial advice
- If you don't know something specific, say so honestly and suggest they contact support via Telegram

Keep replies short (2–5 sentences unless a list is genuinely helpful).`;

router.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ content: 'Sorry, I am temporarily unavailable.' })}\n\n`);
  }

  res.end();
});

export default router;
