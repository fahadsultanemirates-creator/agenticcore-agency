import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

function requireWallet(req: Request, res: Response): string | null {
  const address = (req.session as any)?.tokenWallet;
  if (!address) { res.status(401).json({ error: "Connect your wallet first" }); return null; }
  return address;
}

// GET /api/token/presale/me
router.get("/me", async (req: Request, res: Response) => {
  // Allow address from session OR from query param (for when session cookie fails)
  const address = (req.session as any)?.tokenWallet || (req.query.address as string)?.toLowerCase();
  if (!address) return res.status(401).json({ error: "Connect your wallet first" });

  try {
    const { rows: [summary] } = await pool.query(`
      SELECT
        COALESCE(SUM(usdt_amount), 0)::float   AS total_usdt,
        COALESCE(SUM(token_amount), 0)::text   AS total_tokens,
        COALESCE(SUM(bonus_amount), 0)::text   AS total_bonus,
        COUNT(*)                                AS tx_count
      FROM ac_presale_contributions
      WHERE address = $1 AND status = 'confirmed'
    `, [address]);

    const { rows: txs } = await pool.query(`
      SELECT tx_hash, usdt_amount::float, token_amount::text, bonus_amount::text, status, created_at
      FROM ac_presale_contributions
      WHERE address = $1
      ORDER BY created_at DESC LIMIT 20
    `, [address]);

    res.json({ summary, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/token/presale/contribute
router.post("/contribute", async (req: Request, res: Response) => {
  // Accept wallet from session or body (resilient to cookie failures)
  const address = (req.session as any)?.tokenWallet || (req.body.address as string)?.toLowerCase();
  if (!address) return res.status(401).json({ error: "Connect your wallet first" });

  try {
    const { txHash, usdtAmount } = req.body;
    if (!txHash || !usdtAmount) return res.status(400).json({ error: "txHash and usdtAmount required" });
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return res.status(400).json({ error: "Invalid txHash" });

    const amt = parseFloat(usdtAmount);
    if (isNaN(amt) || amt < 10) return res.status(400).json({ error: "Minimum purchase is 10 USDT" });
    if (amt > 10_000) return res.status(400).json({ error: "Maximum purchase is 10,000 USDT" });

    const { rows: existing } = await pool.query(
      "SELECT id FROM ac_presale_contributions WHERE tx_hash = $1", [txHash]
    );
    if (existing.length) return res.status(409).json({ error: "Transaction already recorded" });

    const RATE = 10_000_000;  // AC per USDT
    const base  = amt * RATE;
    const bonus = base * 20 / 100;
    const total = base + bonus;

    await pool.query(`
      INSERT INTO ac_presale_contributions (address, tx_hash, usdt_amount, token_amount, bonus_amount, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
    `, [address, txHash.toLowerCase(), amt, total.toFixed(0), bonus.toFixed(0)]);

    res.json({ ok: true, tokenAmount: total.toFixed(0), bonusAmount: bonus.toFixed(0), status: "pending" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/token/presale/verify-tx (admin only)
router.post("/verify-tx", async (req: Request, res: Response) => {
  if (req.headers["x-admin-password"] !== process.env.ESTATE_ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { txHash } = req.body;
  if (!txHash) return res.status(400).json({ error: "txHash required" });

  try {
    const apiKey = process.env.BSCSCAN_API_KEY;
    const resp = await fetch(
      `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${apiKey}`
    );
    const data = await resp.json() as any;
    const confirmed = data?.result?.status === "1";

    if (confirmed) {
      await pool.query(
        "UPDATE ac_presale_contributions SET status = 'confirmed' WHERE tx_hash = $1",
        [txHash.toLowerCase()]
      );
    }
    res.json({ txHash, confirmed, bscscanResult: data?.result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
