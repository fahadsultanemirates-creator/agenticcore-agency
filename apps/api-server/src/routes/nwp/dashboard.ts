import { Router } from "express";
import { db } from "@workspace/db";
import {
  nwpUsersTable,
  nwpProfitLedgerTable,
  nwpRewardLedgerTable,
  nwpWithdrawalsTable,
} from "@workspace/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";
import {
  getUserProfitSummary,
  PACKAGE_RATES,
  PACKAGE_RANGES,
  isWorkingDay,
  toDateString,
  calculateDailyProfit,
} from "../../lib/financialEngine";

const router = Router();
router.use(requireNwpAuth);

// ── GET /nwp/dashboard ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Profit & reward summaries
    const summary = await getUserProfitSummary(userId);

    // Today's profit entry (if exists)
    const todayStr = toDateString(new Date());
    const [todayProfit] = await db
      .select({ amount: nwpProfitLedgerTable.amountUsd })
      .from(nwpProfitLedgerTable)
      .where(
        and(
          eq(nwpProfitLedgerTable.userId, userId),
          eq(nwpProfitLedgerTable.creditDate, todayStr),
        ),
      )
      .limit(1);

    // Profit history — last 30 working days
    const profitHistory = await db
      .select({
        date: nwpProfitLedgerTable.creditDate,
        amount: nwpProfitLedgerTable.amountUsd,
      })
      .from(nwpProfitLedgerTable)
      .where(eq(nwpProfitLedgerTable.userId, userId))
      .orderBy(desc(nwpProfitLedgerTable.creditDate))
      .limit(30);

    // Next withdrawal eligibility
    const [lastWithdrawal] = await db
      .select({ requestedAt: nwpWithdrawalsTable.requestedAt })
      .from(nwpWithdrawalsTable)
      .where(
        and(
          eq(nwpWithdrawalsTable.userId, userId),
          eq(nwpWithdrawalsTable.type, "profit"),
        ),
      )
      .orderBy(desc(nwpWithdrawalsTable.requestedAt))
      .limit(1);

    let nextWithdrawalDate: string | null = null;
    let canWithdrawProfit = false;

    if (user.investmentStartDate) {
      const startDate = new Date(user.investmentStartDate);
      const referenceDate = lastWithdrawal?.requestedAt
        ? new Date(lastWithdrawal.requestedAt)
        : startDate;

      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + 14);
      nextWithdrawalDate = toDateString(nextDate);
      canWithdrawProfit = new Date() >= nextDate;
    }

    // Days active
    const daysActive = user.investmentStartDate
      ? Math.floor(
          (Date.now() - new Date(user.investmentStartDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // Package info
    const packageRate = user.package ? PACKAGE_RATES[user.package] ?? 0 : 0;
    const packageRange = user.package ? PACKAGE_RANGES[user.package] : null;
    const expectedDailyProfit =
      user.package && user.investmentAmountUsd
        ? calculateDailyProfit(user.investmentAmountUsd, user.package)
        : 0;

    // Support tier based on package
    const supportTier = getSupportTier(user.package);

    // Referral count (direct)
    const [refCountRow] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.referredById, userId));

    // Today's is working day
    const todayIsWorkingDay = isWorkingDay(new Date());

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
        package: user.package,
        investmentAmountUsd: user.investmentAmountUsd,
        investmentStartDate: user.investmentStartDate,
        bnbWallet: user.bnbWallet,
        referralCode: user.referralCode,
      },
      financial: {
        totalProfitUsd: summary.totalProfitUsd.toFixed(2),
        withdrawableProfitUsd: summary.withdrawableProfitUsd.toFixed(2),
        totalRewardUsd: summary.totalRewardUsd.toFixed(2),
        withdrawableRewardUsd: summary.withdrawableRewardUsd.toFixed(2),
        todayProfitUsd: todayProfit?.amount ?? (todayIsWorkingDay ? expectedDailyProfit.toFixed(2) : "0.00"),
        todayIsWorkingDay,
        expectedDailyProfitUsd: expectedDailyProfit.toFixed(2),
        packageMonthlyRate: packageRate,
        daysActive,
        nextWithdrawalDate,
        canWithdrawProfit,
        directReferrals: Number(refCountRow?.count ?? 0),
      },
      profitHistory: profitHistory.reverse().map((h) => ({
        date: h.date,
        amount: h.amount,
      })),
      package: user.package
        ? {
            name: user.package,
            monthlyRate: packageRate,
            rangeMin: packageRange?.[0],
            rangeMax: packageRange?.[1] === Infinity ? null : packageRange?.[1],
          }
        : null,
      supportTier,
    });
  } catch (err) {
    console.error("[NWP dashboard]", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ── GET /nwp/dashboard/profit-history ────────────────────────────────────────
router.get("/profit-history", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;
    const { months = "1" } = req.query as { months?: string };
    const numMonths = Math.min(parseInt(months, 10) || 1, 6);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - numMonths);

    const history = await db
      .select({
        date: nwpProfitLedgerTable.creditDate,
        amount: nwpProfitLedgerTable.amountUsd,
        isWithdrawn: nwpProfitLedgerTable.isWithdrawn,
      })
      .from(nwpProfitLedgerTable)
      .where(
        and(
          eq(nwpProfitLedgerTable.userId, userId),
          gte(nwpProfitLedgerTable.creditDate, toDateString(cutoff)),
        ),
      )
      .orderBy(nwpProfitLedgerTable.creditDate);

    res.json({ history });
  } catch (err) {
    console.error("[NWP profit-history]", err);
    res.status(500).json({ error: "Failed to fetch profit history" });
  }
});

// ── GET /nwp/dashboard/reward-history ────────────────────────────────────────
router.get("/reward-history", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const rewards = await db
      .select({
        id: nwpRewardLedgerTable.id,
        level: nwpRewardLedgerTable.level,
        rewardType: nwpRewardLedgerTable.rewardType,
        amountUsd: nwpRewardLedgerTable.amountUsd,
        creditDate: nwpRewardLedgerTable.creditDate,
        isWithdrawn: nwpRewardLedgerTable.isWithdrawn,
        sourceUserId: nwpRewardLedgerTable.sourceUserId,
      })
      .from(nwpRewardLedgerTable)
      .where(eq(nwpRewardLedgerTable.userId, userId))
      .orderBy(desc(nwpRewardLedgerTable.creditDate))
      .limit(100);

    res.json({ rewards });
  } catch (err) {
    console.error("[NWP reward-history]", err);
    res.status(500).json({ error: "Failed to fetch reward history" });
  }
});

function getSupportTier(pkg: string | null | undefined): {
  tier: string;
  responseTime: string;
  contact: string;
} {
  switch (pkg) {
    case "vip":
      return {
        tier: "VIP Pool",
        responseTime: "Instant",
        contact: "Personal Telegram manager assigned",
      };
    case "platinum":
    case "emerald":
      return {
        tier: pkg === "platinum" ? "Platinum" : "Emerald",
        responseTime: "24 hours",
        contact: "support@nexuswealthpartners.group",
      };
    default:
      return {
        tier: pkg ? (pkg.charAt(0).toUpperCase() + pkg.slice(1)) : "Standard",
        responseTime: "48 hours",
        contact: "support@nexuswealthpartners.group",
      };
  }
}

export default router;
