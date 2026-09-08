/**
 * Proxies Telegram webhook updates for the Nexus Manager bot
 * to the nexus-studio-backend running on port 8000.
 *
 * Telegram POSTs to: https://<domain>/telegram-webhook
 * This route forwards to: http://localhost:8000/telegram-webhook
 */
import { Router, type Request, type Response } from "express";

const router = Router();

router.post("/telegram-webhook", async (req: Request, res: Response) => {
  try {
    const response = await fetch("http://localhost:8000/telegram-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[NexusTelegram] Proxy error:", err);
    res.status(200).json({ ok: true }); // always ack so Telegram doesn't retry forever
  }
});

export default router;
