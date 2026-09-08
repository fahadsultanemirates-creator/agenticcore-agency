/**
 * Forex Dashboard API Routes
 * GET /api/forex/status  — live framework state from state.json
 * GET /api/forex/trades  — trade history from logs/trades.jsonl
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import readline from "readline";

const router = Router();

// Path to the Python framework's shared files
const FOREX_DIR = path.resolve(
  process.cwd(),
  "../../artifacts/agenticcore-forex"
);
const STATE_PATH = path.join(FOREX_DIR, "state.json");
const TRADES_PATH = path.join(FOREX_DIR, "logs", "trades.jsonl");

// ── GET /api/forex/status ───────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      return res.json({
        error: "Framework not running yet",
        hint: "Start the AgenticCore Forex workflow — state.json will appear after the first scan cycle.",
      });
    }
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const d = JSON.parse(raw);

    // Normalise snake_case → camelCase to match OpenAPI contract
    const positions = (d.open_positions || []).map((p: Record<string, unknown>) => ({
      ticket: p.ticket,
      symbol: p.symbol ?? p.pair,                        // bridge uses "pair"
      type: p.type ?? p.direction,                       // bridge uses "direction"
      volume: p.volume ?? p.lot,                         // bridge uses "lot"
      openPrice: p.openPrice ?? p.open_price,
      currentPrice: p.currentPrice ?? p.current_price ?? p.open_price, // mock has no live price
      profit: p.profit ?? 0,
      openTime: p.openTime ?? p.open_time,
    }));

    return res.json({
      mode: d.mode,
      tradingActive: d.tradingActive ?? d.trading_active,
      circuitBreakerActive: d.circuitBreakerActive ?? d.circuit_breaker_active,
      lastUpdated: d.lastUpdated ?? d.updated_at,
      balance: d.balance,
      equity: d.equity,
      dailyPnl: d.dailyPnl ?? d.daily_pnl_usd,
      totalTrades: d.totalTrades ?? d.total_trades_today,
      winRate: d.winRate ?? d.win_rate_today,
      openPositions: positions,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to read state", detail: String(err) });
  }
});

// ── GET /api/forex/trades?limit=50 ─────────────────────────────────────────
router.get("/trades", async (req, res) => {
  try {
    if (!fs.existsSync(TRADES_PATH)) {
      return res.json({ trades: [], message: "No trades recorded yet." });
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
    const lines: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(TRADES_PATH),
        crlfDelay: Infinity,
      });
      rl.on("line", (line) => { if (line.trim()) lines.push(line); });
      rl.on("close", resolve);
      rl.on("error", reject);
    });

    // Parse, normalise, reverse (newest first), and limit
    const trades = lines
      .map((l) => {
        try {
          const t = JSON.parse(l);
          // Normalise snake_case → camelCase to match OpenAPI contract
          return {
            ticket: t.ticket,
            symbol: t.symbol ?? t.pair,
            type: t.type ?? t.direction,
            volume: t.volume ?? t.lot,
            openPrice: t.openPrice ?? t.open_price ?? t.price,
            closePrice: t.closePrice ?? t.close_price ?? t.price,
            profit: t.profit ?? 0,
            openTime: t.openTime ?? t.open_time ?? t.time,
            closeTime: t.closeTime ?? t.close_time ?? t.time,
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .reverse()
      .slice(0, limit);

    return res.json({ trades, total: lines.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to read trades", detail: String(err) });
  }
});

export default router;
