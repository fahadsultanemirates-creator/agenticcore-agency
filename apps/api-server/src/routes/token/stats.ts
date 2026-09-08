import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

// GET /api/token/stats — public presale stats
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(usdt_amount), 0)::float AS raised_usdt,
        COALESCE(SUM(token_amount), 0)::text AS tokens_sold,
        COUNT(DISTINCT address) AS participants
      FROM ac_presale_contributions
      WHERE status = 'confirmed'
    `);

    const stats = rows[0] || { raised_usdt: 0, tokens_sold: "0", participants: 0 };

    res.json({
      raisedUSDT: parseFloat(stats.raised_usdt),
      tokensSold: stats.tokens_sold,
      participants: parseInt(stats.participants),
      totalSupply: "9000000000000",
      presaleAllocation: "3600000000000",
      tokenPriceUSDT: 0.0000001,          // $0.0000001 per AC
      presaleRatePerUSDT: 10_000_000,     // 10M AC per USDT at starting price
      presaleBonus: 20,
      hardCapUSDT: 360_000,               // 360,000 USDT to sell presale allocation
      minPurchaseUSDT: 10,
      maxPurchaseUSDT: 10_000,
      presaleActive: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
