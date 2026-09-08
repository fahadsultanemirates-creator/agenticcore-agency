import { Router } from "express";
import { db } from "@workspace/db";
import {
  marketsUsers, marketsPositions, marketsCommissions,
} from "@workspace/db/schema";
import { eq, and, desc, sum, count, sql } from "drizzle-orm";
import { getSession } from "./auth";

const router = Router();

// Auth middleware
async function requireAuth(req: any, res: any, next: any) {
  const user = await getSession(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  req.marketsUser = user;
  next();
}

// Mock market prices (realistic, updated with small jitter on each call)
function getMarketPrices() {
  const base = [
    { pair: "EURUSD", bid: 1.08542, ask: 1.08558, change24h: 0.00234, category: "forex" },
    { pair: "GBPUSD", bid: 1.26871, ask: 1.26891, change24h: -0.00142, category: "forex" },
    { pair: "USDJPY", bid: 153.421, ask: 153.441, change24h: 0.382, category: "forex" },
    { pair: "XAUUSD", bid: 2318.45, ask: 2318.85, change24h: 12.30, category: "commodity" },
    { pair: "BTCUSDT", bid: 67842.50, ask: 67892.50, change24h: 1243.50, category: "crypto" },
    { pair: "ETHUSDT", bid: 3412.80, ask: 3413.40, change24h: -87.20, category: "crypto" },
    { pair: "USDCHF", bid: 0.90221, ask: 0.90241, change24h: -0.00089, category: "forex" },
    { pair: "AUDUSD", bid: 0.65234, ask: 0.65254, change24h: 0.00123, category: "forex" },
  ];
  return base.map((p) => {
    const jitter = (Math.random() - 0.5) * 0.0001 * p.bid;
    return {
      pair: p.pair,
      bid: (p.bid + jitter).toFixed(p.category === "forex" ? 5 : 2),
      ask: (p.ask + jitter).toFixed(p.category === "forex" ? 5 : 2),
      change24h: p.change24h.toFixed(p.category === "forex" ? 5 : 2),
      changePercent24h: ((p.change24h / p.bid) * 100).toFixed(2),
      category: p.category as "forex" | "crypto" | "commodity",
    };
  });
}

// GET /markets/dashboard
router.get("/dashboard", requireAuth, async (req: any, res) => {
  try {
    const userId: number = req.marketsUser.id;
    const user = req.marketsUser;

    // Open positions P&L
    const openPositions = await db
      .select()
      .from(marketsPositions)
      .where(and(eq(marketsPositions.userId, userId), eq(marketsPositions.status, "open")));

    const openPnl = openPositions.reduce((acc, p) => acc + parseFloat(p.pnlUsd), 0);

    // Closed trades
    const closedTrades = await db
      .select()
      .from(marketsPositions)
      .where(and(eq(marketsPositions.userId, userId), eq(marketsPositions.status, "closed")))
      .orderBy(desc(marketsPositions.closedAt))
      .limit(10);

    // Win rate
    const allClosed = await db
      .select({ pnl: marketsPositions.pnlUsd })
      .from(marketsPositions)
      .where(and(eq(marketsPositions.userId, userId), eq(marketsPositions.status, "closed")));
    const wins = allClosed.filter((t) => parseFloat(t.pnl) > 0).length;
    const winRate = allClosed.length > 0 ? Math.round((wins / allClosed.length) * 100) : 0;

    // Today P&L (closed today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = closedTrades.filter(
      (t) => t.closedAt && new Date(t.closedAt) >= today,
    );
    const todayPnl = todayTrades.reduce((acc, t) => acc + parseFloat(t.pnlUsd), 0);

    // Referral summary
    const [refStats] = await db
      .select({
        total: count(),
        commission: sql<string>`COALESCE(SUM(amount_usd), 0)`,
      })
      .from(marketsCommissions)
      .where(eq(marketsCommissions.referrerId, userId));

    const portfolio = {
      balanceUsd: user.balanceUsd,
      totalDepositsUsd: user.totalDepositsUsd,
      totalPnlUsd: (parseFloat(user.totalPnlUsd) + openPnl).toFixed(2),
      todayPnlUsd: todayPnl.toFixed(2),
      openPositionsCount: openPositions.length,
      winRate,
      totalTrades: allClosed.length,
    };

    const recentTrades = closedTrades.map((t) => ({
      id: t.id,
      pair: t.pair,
      type: t.type,
      volumeLots: t.volumeLots,
      entryPrice: t.entryPrice,
      closePrice: t.closePrice ?? t.entryPrice,
      pnlUsd: t.pnlUsd,
      openedAt: t.openedAt,
      closedAt: t.closedAt!,
    }));

    res.json({
      user: {
        id: user.id, fullName: user.fullName, email: user.email, country: user.country,
        phone: user.phone ?? null, status: user.status, referralCode: user.referralCode,
        referredById: user.referredById ?? null, balanceUsd: user.balanceUsd,
        totalDepositsUsd: user.totalDepositsUsd, totalPnlUsd: user.totalPnlUsd,
        createdAt: user.createdAt,
      },
      portfolio,
      recentTrades,
      referralSummary: {
        totalReferred: refStats?.total ?? 0,
        totalCommissionUsd: String(refStats?.commission ?? "0.00"),
      },
    });
  } catch (err) {
    console.error("[Markets] Dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// GET /markets/positions
router.get("/positions", requireAuth, async (req: any, res) => {
  try {
    const userId: number = req.marketsUser.id;
    const status = typeof req.query.status === "string" ? req.query.status : "open";

    const whereCondition = status === "all"
      ? eq(marketsPositions.userId, userId)
      : and(eq(marketsPositions.userId, userId), eq(marketsPositions.status, status as "open" | "closed"));

    const positions = await db
      .select()
      .from(marketsPositions)
      .where(whereCondition)
      .orderBy(desc(marketsPositions.openedAt));

    const totalPnl = positions.reduce((acc, p) => acc + parseFloat(p.pnlUsd), 0);

    res.json({
      positions: positions.map((p) => ({
        id: p.id, pair: p.pair, type: p.type,
        volumeLots: p.volumeLots, entryPrice: p.entryPrice,
        currentPrice: p.currentPrice ?? p.entryPrice,
        pnlUsd: p.pnlUsd, marginUsd: p.marginUsd,
        stopLoss: p.stopLoss ?? null, takeProfit: p.takeProfit ?? null,
        status: p.status, openedAt: p.openedAt, closedAt: p.closedAt ?? null,
      })),
      totalPnlUsd: totalPnl.toFixed(2),
    });
  } catch (err) {
    console.error("[Markets] Positions error:", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

// GET /markets/trade-history
router.get("/trade-history", requireAuth, async (req: any, res) => {
  try {
    const userId: number = req.marketsUser.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const trades = await db
      .select()
      .from(marketsPositions)
      .where(and(eq(marketsPositions.userId, userId), eq(marketsPositions.status, "closed")))
      .orderBy(desc(marketsPositions.closedAt))
      .limit(limit);

    res.json({
      trades: trades.map((t) => ({
        id: t.id, pair: t.pair, type: t.type,
        volumeLots: t.volumeLots, entryPrice: t.entryPrice,
        closePrice: t.closePrice ?? t.entryPrice,
        pnlUsd: t.pnlUsd, openedAt: t.openedAt, closedAt: t.closedAt!,
      })),
    });
  } catch (err) {
    console.error("[Markets] Trade history error:", err);
    res.status(500).json({ error: "Failed to fetch trade history" });
  }
});

// GET /markets/market-prices
router.get("/market-prices", (_req, res) => {
  res.json({ prices: getMarketPrices(), updatedAt: new Date() });
});

// GET /markets/referral
router.get("/referral", requireAuth, async (req: any, res) => {
  try {
    const user = req.marketsUser;
    const referred = await db
      .select({ id: marketsUsers.id })
      .from(marketsUsers)
      .where(eq(marketsUsers.referredById, user.id));

    const [commData] = await db
      .select({
        total: sql<string>`COALESCE(SUM(amount_usd), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN is_paid = false THEN amount_usd ELSE 0 END), 0)`,
      })
      .from(marketsCommissions)
      .where(eq(marketsCommissions.referrerId, user.id));

    const totalRef = referred.length;
    let tier: "bronze" | "silver" | "gold" | "platinum" = "bronze";
    let rate = 5;
    if (totalRef >= 31) { tier = "platinum"; rate = 15; }
    else if (totalRef >= 16) { tier = "gold"; rate = 12; }
    else if (totalRef >= 6) { tier = "silver"; rate = 8; }

    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://agenticcore.agency";

    res.json({
      referralCode: user.referralCode,
      referralLink: `${domain}/agenticcore-markets/register?ref=${user.referralCode}`,
      totalReferred: totalRef,
      activeReferred: referred.length,
      totalCommissionUsd: String(commData?.total ?? "0.00"),
      pendingCommissionUsd: String(commData?.pending ?? "0.00"),
      tier,
      commissionRatePercent: rate,
    });
  } catch (err) {
    console.error("[Markets] Referral error:", err);
    res.status(500).json({ error: "Failed to fetch referral info" });
  }
});

// GET /markets/referral/network
router.get("/referral/network", requireAuth, async (req: any, res) => {
  try {
    const userId: number = req.marketsUser.id;
    const referred = await db
      .select()
      .from(marketsUsers)
      .where(eq(marketsUsers.referredById, userId))
      .orderBy(desc(marketsUsers.createdAt));

    res.json({
      referred: referred.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        country: u.country,
        status: u.status,
        joinedAt: u.createdAt,
        hasDeposited: parseFloat(u.totalDepositsUsd) > 0,
        totalDepositsUsd: u.totalDepositsUsd,
      })),
      total: referred.length,
    });
  } catch (err) {
    console.error("[Markets] Referral network error:", err);
    res.status(500).json({ error: "Failed to fetch referral network" });
  }
});

export default router;
