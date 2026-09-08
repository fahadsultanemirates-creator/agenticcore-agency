import { Router } from "express";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an intelligent real estate assistant for AgenticCore.Estate — Pakistan's premier property portal. 
You help users find properties, understand the market, get advice on buying/renting/investing in Pakistani real estate, and navigate the portal.
You know about major cities like Karachi, Lahore, Islamabad, Rawalpindi, Peshawar, Quetta, Multan, Faisalabad, Sialkot, and Gujranwala.
You understand property types: houses, flats, plots, commercial, farm houses.
You understand Pakistani area units: marla, kanal, square feet.
You understand local property laws, DHA, Bahria Town, and society-based housing schemes.
Be helpful, concise, and professional. Respond in English unless the user writes in Urdu.`;

// POST /estate/ai/chat
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body as { message: string };
    if (!message?.trim()) {
      res.status(400).json({ error: "Message required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      max_tokens: 600,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI chat failed" });
    } else {
      res.write("data: [ERROR]\n\n");
      res.end();
    }
  }
});

export default router;
