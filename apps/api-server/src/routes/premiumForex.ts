/**
 * Premium Forex Tier 1 API Routes (read-only)
 * GET /api/premium-forex/status  — live framework state from premium/runtime/state.json
 * GET /api/premium-forex/trades  — trade history from premium/logs/trades.jsonl
 *
 * Reads ONLY from artifacts/agenticcore-forex/premium/runtime/state.json
 * and artifacts/agenticcore-forex/premium/logs/trades.jsonl.
 * Does NOT touch /api/forex routes (Tier 2).
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import readline from "readline";
import { logger } from "../lib/logger";

const router = Router();

const PREMIUM_DIR = path.resolve(
  process.cwd(),
  "../../artifacts/agenticcore-forex/premium"
);
const STATE_PATH = path.join(PREMIUM_DIR, "runtime", "state.json");
const TRADES_PATH = path.join(PREMIUM_DIR, "logs", "trades.jsonl");

const NOT_RUNNING_REASON =
  "Premium worker has not started — state.json will appear after the first premium scan cycle.";

// ── GET /api/premium-forex/status ──────────────────────────────────────────
router.get("/status", (_req, res): void => {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      res.json({
        running: false,
        notRunningReason: NOT_RUNNING_REASON,
        workerName: null,
        premiumAnalysis: null,
        mode: null,
        tradingActive: null,
        circuitBreakerActive: null,
        lastUpdated: null,
        balance: null,
        equity: null,
        dailyPnl: null,
        totalTrades: null,
        winRate: null,
        openPositions: [],
      });
      return;
    }

    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const d = JSON.parse(raw);

    const positions = (d.open_positions ?? d.openPositions ?? []).map(
      (p: Record<string, unknown>) => ({
        ticket: p.ticket,
        symbol: p.symbol ?? p.pair,
        type: p.type ?? p.direction,
        volume: p.volume ?? p.lot,
        openPrice: p.openPrice ?? p.open_price,
        currentPrice:
          p.currentPrice ?? p.current_price ?? p.open_price ?? null,
        profit: p.profit ?? null,
        openTime: p.openTime ?? p.open_time,
      })
    );

    res.json({
      running: true,
      workerName: d.workerName ?? d.worker_name ?? "premium-worker",
      premiumAnalysis: d.premiumAnalysis ?? d.premium_analysis ?? null,
      notRunningReason: null,
      mode: d.mode ?? null,
      tradingActive: d.tradingActive ?? d.trading_active ?? null,
      circuitBreakerActive:
        d.circuitBreakerActive ?? d.circuit_breaker_active ?? null,
      lastUpdated: d.lastUpdated ?? d.updated_at ?? null,
      balance: d.balance ?? null,
      equity: d.equity ?? null,
      dailyPnl: d.dailyPnl ?? d.daily_pnl_usd ?? null,
      totalTrades: d.totalTrades ?? d.total_trades_today ?? null,
      winRate: d.winRate ?? d.win_rate_today ?? null,
      openPositions: positions,
    });
  } catch (err) {
    logger.error({ err }, "Failed to read premium forex state");
    res
      .status(500)
      .json({ error: "Failed to read premium state", detail: String(err) });
  }
});

// ── GET /api/premium-forex/trades?limit=50 ─────────────────────────────────
router.get("/trades", async (req, res): Promise<void> => {
  try {
    if (!fs.existsSync(TRADES_PATH)) {
      res.json({
        running: false,
        trades: [],
        total: 0,
        notRunningReason: NOT_RUNNING_REASON,
      });
      return;
    }

    const limit = Math.min(
      parseInt(String(req.query.limit ?? "100"), 10) || 100,
      500
    );
    const lines: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(TRADES_PATH),
        crlfDelay: Infinity,
      });
      rl.on("line", (line) => {
        if (line.trim()) lines.push(line);
      });
      rl.on("close", resolve);
      rl.on("error", reject);
    });

    const trades = lines
      .map((l) => {
        try {
          const t = JSON.parse(l);
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
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse()
      .slice(0, limit);

    res.json({ running: true, trades, total: lines.length, notRunningReason: null });
  } catch (err) {
    logger.error({ err }, "Failed to read premium forex trades");
    res
      .status(500)
      .json({ error: "Failed to read premium trades", detail: String(err) });
  }
});

export default router;
