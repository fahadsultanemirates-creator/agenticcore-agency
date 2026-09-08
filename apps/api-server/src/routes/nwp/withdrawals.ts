import { Router } from "express";
import { db } from "@workspace/db";
import {
  nwpUsersTable,
  nwpWithdrawalsTable,
  nwpProfitLedgerTable,
  nwpRewardLedgerTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";
import { getUserProfitSummary, toDateString } from "../../lib/financialEngine";
import { sendWithdrawalRequestAlert } from "../../lib/emailService";

const router = Router();
router.use(requireNwpAuth);

// ── GET /nwp/withdrawals ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;
    const withdrawals = await db
      .select()
      .from(nwpWithdrawalsTable)
      .where(eq(nwpWithdrawalsTable.userId, userId))
      .orderBy(desc(nwpWithdrawalsTable.requestedAt));

    res.json({ withdrawals });
  } catch (err) {
    console.error("[NWP withdrawals]", err);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

// ── POST /nwp/withdrawals/profit ──────────────────────────────────────────────
router.post("/profit", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user || user.status !== "active") {
      res.status(403).json({ error: "Only active accounts can request withdrawals" });
      return;
    }

    // Check 14-day withdrawal gate
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

    const referenceDate = lastWithdrawal?.requestedAt
      ? new Date(lastWithdrawal.requestedAt)
      : user.investmentStartDate
        ? new Date(user.investmentStartDate)
        : null;

    if (referenceDate) {
      const nextEligible = new Date(referenceDate);
      nextEligible.setDate(nextEligible.getDate() + 14);
      if (new Date() < nextEligible) {
        res.status(400).json({
          error: `Profit withdrawal not yet eligible. Next withdrawal: ${toDateString(nextEligible)}`,
          nextEligibleDate: toDateString(nextEligible),
        });
        return;
      }
    }

    // Get withdrawable balance (profit + rewards combined)
    const summary = await getUserProfitSummary(userId);
    const totalWithdrawable =
      summary.withdrawableProfitUsd + summary.withdrawableRewardUsd;

    if (totalWithdrawable <= 0) {
      res.status(400).json({ error: "No withdrawable balance available" });
      return;
    }

    // Create withdrawal request
    const [withdrawal] = await db
      .insert(nwpWithdrawalsTable)
      .values({
        userId,
        type: "profit",
        amountUsd: totalWithdrawable.toFixed(2),
        status: "pending",
        requestedAt: new Date(),
      })
      .returning();

    // Mark profits and rewards as withdrawn
    await db
      .update(nwpProfitLedgerTable)
      .set({ isWithdrawn: true })
      .where(
        and(
          eq(nwpProfitLedgerTable.userId, userId),
          eq(nwpProfitLedgerTable.isWithdrawn, false),
        ),
      );

    await db
      .update(nwpRewardLedgerTable)
      .set({ isWithdrawn: true })
      .where(
        and(
          eq(nwpRewardLedgerTable.userId, userId),
          eq(nwpRewardLedgerTable.isWithdrawn, false),
        ),
      );

    sendWithdrawalRequestAlert({
      fullName: user.fullName,
      email: user.email,
      type: "profit",
      amountUsd: totalWithdrawable.toFixed(2),
      bnbWallet: user.bnbWallet,
      withdrawalId: withdrawal.id,
    }).catch(console.error);

    res.json({ withdrawal });
  } catch (err) {
    console.error("[NWP profit withdrawal]", err);
    res.status(500).json({ error: "Failed to submit profit withdrawal" });
  }
});

// ── POST /nwp/withdrawals/principal ──────────────────────────────────────────
router.post("/principal", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;
    const { agreedToPenalty } = req.body as { agreedToPenalty: boolean };

    if (!agreedToPenalty) {
      res.status(400).json({
        error: "You must agree to the early withdrawal penalty terms",
      });
      return;
    }

    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user || user.status !== "active" || !user.investmentAmountUsd) {
      res.status(403).json({
        error: "Only active accounts with an active investment can request principal withdrawal",
      });
      return;
    }

    // Calculate penalty: 50% of total profits earned
    const summary = await getUserProfitSummary(userId);
    const totalProfit = summary.totalProfitUsd;
    const penaltyAmount = totalProfit * 0.5;
    const principalAmount = parseFloat(user.investmentAmountUsd);
    const returnAmount = Math.max(0, principalAmount - penaltyAmount);

    const [withdrawal] = await db
      .insert(nwpWithdrawalsTable)
      .values({
        userId,
        type: "principal",
        amountUsd: returnAmount.toFixed(2),
        totalProfitEarnedUsd: totalProfit.toFixed(2),
        penaltyAmountUsd: penaltyAmount.toFixed(2),
        status: "pending",
        requestedAt: new Date(),
      })
      .returning();

    sendWithdrawalRequestAlert({
      fullName: user.fullName,
      email: user.email,
      type: "principal",
      amountUsd: returnAmount.toFixed(2),
      bnbWallet: user.bnbWallet,
      withdrawalId: withdrawal.id,
    }).catch(console.error);

    res.json({
      withdrawal,
      penaltyCalculation: {
        principalAmount: principalAmount.toFixed(2),
        totalProfitEarned: totalProfit.toFixed(2),
        penaltyAmount: penaltyAmount.toFixed(2),
        returnAmount: returnAmount.toFixed(2),
      },
    });
  } catch (err) {
    console.error("[NWP principal withdrawal]", err);
    res.status(500).json({ error: "Failed to submit principal withdrawal" });
  }
});

// ── GET /nwp/withdrawals/penalty-preview ─────────────────────────────────────
router.get("/penalty-preview", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select({ investmentAmountUsd: nwpUsersTable.investmentAmountUsd })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user?.investmentAmountUsd) {
      res.status(404).json({ error: "No active investment found" });
      return;
    }

    const summary = await getUserProfitSummary(userId);
    const principalAmount = parseFloat(user.investmentAmountUsd);
    const penaltyAmount = summary.totalProfitUsd * 0.5;
    const returnAmount = Math.max(0, principalAmount - penaltyAmount);

    res.json({
      principalAmount: principalAmount.toFixed(2),
      totalProfitEarned: summary.totalProfitUsd.toFixed(2),
      penaltyAmount: penaltyAmount.toFixed(2),
      returnAmount: returnAmount.toFixed(2),
    });
  } catch (err) {
    console.error("[NWP penalty preview]", err);
    res.status(500).json({ error: "Failed to calculate penalty" });
  }
});

export default router;
