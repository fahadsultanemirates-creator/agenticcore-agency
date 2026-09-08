/**
 * Admin deposit management routes.
 * GET  /nwp/admin/deposits           — list all deposits with user info
 * POST /nwp/admin/deposits/:id/approve — approve deposit (triggers investment activation)
 * POST /nwp/admin/deposits/:id/reject  — reject deposit
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { nwpDepositsTable, nwpUsersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireNwpAdmin } from "../../middlewares/nwpAdminMiddleware";
import { creditUpfrontBonus } from "../../lib/financialEngine";
import { verifyTxHash } from "../../lib/bscScanner";
import {
  sendInvestmentActivatedEmail,
  sendDepositRejectedEmail,
} from "../../lib/emailService";

const router = Router();
router.use(requireNwpAdmin as any);

// ── GET /nwp/admin/deposits ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;

    const rows = await db
      .select({
        id: nwpDepositsTable.id,
        userId: nwpDepositsTable.userId,
        amountUsd: nwpDepositsTable.amountUsd,
        package: nwpDepositsTable.package,
        status: nwpDepositsTable.status,
        txHash: nwpDepositsTable.txHash,
        bypassCodeUsed: nwpDepositsTable.bypassCodeUsed,
        approvedAt: nwpDepositsTable.approvedAt,
        createdAt: nwpDepositsTable.createdAt,
        userFullName: nwpUsersTable.fullName,
        userEmail: nwpUsersTable.email,
        userBnbWallet: nwpUsersTable.bnbWallet,
        userStatus: nwpUsersTable.status,
      })
      .from(nwpDepositsTable)
      .innerJoin(nwpUsersTable, eq(nwpDepositsTable.userId, nwpUsersTable.id))
      .where(
        statusFilter && statusFilter !== "all"
          ? eq(nwpDepositsTable.status, statusFilter as any)
          : undefined
      )
      .orderBy(desc(nwpDepositsTable.createdAt));

    res.json({
      deposits: rows.map((r) => ({
        ...r,
        bscscanUrl: r.txHash ? `https://bscscan.com/tx/${r.txHash}` : null,
      })),
    });
  } catch (err) {
    console.error("[Admin deposits list]", err);
    res.status(500).json({ error: "Failed to fetch deposits" });
  }
});

// ── POST /nwp/admin/deposits/:id/approve ─────────────────────────────────────
// Approves a detected/bypass deposit and activates the user's investment.
router.post("/:id/approve", async (req, res) => {
  try {
    const depositId = parseInt(req.params.id, 10);
    if (isNaN(depositId)) {
      res.status(400).json({ error: "Invalid deposit id" });
      return;
    }

    const [deposit] = await db
      .select()
      .from(nwpDepositsTable)
      .where(eq(nwpDepositsTable.id, depositId))
      .limit(1);

    if (!deposit) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }
    if (deposit.status === "approved") {
      res.status(409).json({ error: "Deposit already approved" });
      return;
    }
    if (deposit.status === "awaiting") {
      res.status(400).json({ error: "Deposit not yet detected on-chain. Use bypass or wait for detection." });
      return;
    }

    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, deposit.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = new Date();
    const startDate = req.body?.startDate ? new Date(req.body.startDate) : now;

    // Approve deposit
    await db
      .update(nwpDepositsTable)
      .set({ status: "approved", approvedAt: now, updatedAt: now })
      .where(eq(nwpDepositsTable.id, depositId));

    // Activate user investment
    await db
      .update(nwpUsersTable)
      .set({
        status: "active",
        investmentStartDate: startDate,
        updatedAt: now,
      })
      .where(eq(nwpUsersTable.id, user.id));

    // Credit upfront referral bonus to the referrer (non-NWPMASTER referrals only)
    if (user.referredBy) {
      await creditUpfrontBonus(user.id, user.referredBy).catch((e) =>
        console.error("[Admin deposit approve] upfront bonus error:", e)
      );
    }

    // Send activation emails async
    sendInvestmentActivatedEmail({
      user: { email: user.email, fullName: user.fullName },
      deposit: {
        amountUsd: deposit.amountUsd,
        package: deposit.package,
        txHash: deposit.txHash,
      },
    }).catch((e) => console.error("[Admin deposit approve] email error:", e));

    res.json({ success: true, message: "Deposit approved and investment activated" });
  } catch (err) {
    console.error("[Admin deposit approve]", err);
    res.status(500).json({ error: "Failed to approve deposit" });
  }
});

// ── POST /nwp/admin/deposits/:id/manual-verify ───────────────────────────────
// Admin manually verifies an awaiting deposit by tx hash OR force-approves it.
// On success the deposit is marked "detected" (then admin can use normal approve flow).
router.post("/:id/manual-verify", async (req, res) => {
  try {
    const depositId = parseInt(req.params.id, 10);
    if (isNaN(depositId)) {
      res.status(400).json({ error: "Invalid deposit id" });
      return;
    }

    const { txHash, forceApprove } = req.body ?? {};

    if (!txHash && !forceApprove) {
      res.status(400).json({ error: "Provide either txHash or forceApprove: true" });
      return;
    }

    const [deposit] = await db
      .select()
      .from(nwpDepositsTable)
      .where(eq(nwpDepositsTable.id, depositId))
      .limit(1);

    if (!deposit) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }
    if (deposit.status !== "awaiting") {
      res.status(409).json({ error: `Deposit is already in '${deposit.status}' status — only awaiting deposits can be manually verified` });
      return;
    }

    if (forceApprove) {
      // Admin-initiated bypass — skip blockchain check entirely
      await db
        .update(nwpDepositsTable)
        .set({ status: "bypass", bypassCodeUsed: true, updatedAt: new Date() })
        .where(eq(nwpDepositsTable.id, depositId));

      res.json({ success: true, message: "Deposit force-approved (bypass). Use the Activate button to complete." });
      return;
    }

    // Validate the tx hash on-chain
    const cleanHash = (txHash as string).trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(cleanHash)) {
      res.status(400).json({ error: "Invalid tx hash format — must be 0x followed by 64 hex characters" });
      return;
    }

    const txInfo = await verifyTxHash(cleanHash);
    if (!txInfo) {
      res.status(422).json({ error: "Transaction not found on BSC or is not a USDT transfer to the company wallet" });
      return;
    }

    const expectedAmount = parseFloat(deposit.amountUsd);
    const tolerance = expectedAmount * 0.01; // 1% tolerance
    if (Math.abs(txInfo.amountUsd - expectedAmount) > tolerance) {
      res.status(422).json({
        error: `Amount mismatch: tx transferred $${txInfo.amountUsd.toFixed(2)} but deposit expects $${expectedAmount.toFixed(2)} (±1%)`,
      });
      return;
    }

    await db
      .update(nwpDepositsTable)
      .set({ status: "detected", txHash: cleanHash, updatedAt: new Date() })
      .where(eq(nwpDepositsTable.id, depositId));

    res.json({ success: true, message: "Deposit verified on-chain and marked as detected. Use the Activate button to approve." });
  } catch (err) {
    console.error("[Admin deposit manual-verify]", err);
    res.status(500).json({ error: "Failed to manually verify deposit" });
  }
});

// ── POST /nwp/admin/deposits/:id/reject ──────────────────────────────────────
router.post("/:id/reject", async (req, res) => {
  try {
    const depositId = parseInt(req.params.id, 10);
    if (isNaN(depositId)) {
      res.status(400).json({ error: "Invalid deposit id" });
      return;
    }

    const [deposit] = await db
      .select()
      .from(nwpDepositsTable)
      .where(eq(nwpDepositsTable.id, depositId))
      .limit(1);

    if (!deposit) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }

    const [user] = await db
      .select({ email: nwpUsersTable.email, fullName: nwpUsersTable.fullName })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, deposit.userId))
      .limit(1);

    await db
      .update(nwpDepositsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(nwpDepositsTable.id, depositId));

    if (user) {
      sendDepositRejectedEmail({
        user,
        reason: req.body?.reason,
      }).catch((e) => console.error("[Admin deposit reject] email error:", e));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Admin deposit reject]", err);
    res.status(500).json({ error: "Failed to reject deposit" });
  }
});

export default router;
