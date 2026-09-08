import { Router } from "express";
import { db } from "@workspace/db";
import {
  nwpWithdrawalsTable,
  nwpUsersTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireNwpAdmin } from "../../middlewares/nwpAdminMiddleware";
import {
  sendWithdrawalStatusEmail,
} from "../../lib/emailService";

const router = Router();
router.use(requireNwpAdmin);

function joinedWithdrawal(row: {
  w: typeof nwpWithdrawalsTable.$inferSelect;
  u: Partial<typeof nwpUsersTable.$inferSelect>;
}) {
  return {
    ...row.w,
    userFullName: row.u.fullName,
    userEmail: row.u.email,
    userBnbWallet: row.u.bnbWallet,
    userPackage: row.u.package,
  };
}

// ── GET /nwp/admin/withdrawals ────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status = "pending" } = req.query as { status?: string };

    const rows = await db
      .select({
        w: nwpWithdrawalsTable,
        u: {
          fullName: nwpUsersTable.fullName,
          email: nwpUsersTable.email,
          bnbWallet: nwpUsersTable.bnbWallet,
          package: nwpUsersTable.package,
        },
      })
      .from(nwpWithdrawalsTable)
      .innerJoin(nwpUsersTable, eq(nwpWithdrawalsTable.userId, nwpUsersTable.id))
      .where(
        status === "all"
          ? undefined
          : eq(nwpWithdrawalsTable.status, status as typeof nwpWithdrawalsTable.$inferSelect["status"]),
      )
      .orderBy(desc(nwpWithdrawalsTable.requestedAt));

    res.json({ withdrawals: rows.map(joinedWithdrawal) });
  } catch (err) {
    console.error("[NWP admin withdrawals]", err);
    res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});

// ── POST /nwp/admin/withdrawals/:id/approve ───────────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const wId = parseInt(req.params.id, 10);

    const [row] = await db
      .select({ w: nwpWithdrawalsTable, u: nwpUsersTable })
      .from(nwpWithdrawalsTable)
      .innerJoin(nwpUsersTable, eq(nwpWithdrawalsTable.userId, nwpUsersTable.id))
      .where(eq(nwpWithdrawalsTable.id, wId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }

    const newStatus =
      row.w.type === "principal" ? "processing" : "approved";

    const [updated] = await db
      .update(nwpWithdrawalsTable)
      .set({ status: newStatus, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(nwpWithdrawalsTable.id, wId))
      .returning();

    sendWithdrawalStatusEmail({
      toEmail: row.u.email,
      fullName: row.u.fullName,
      type: row.w.type,
      amountUsd: row.w.amountUsd,
      status: newStatus,
    }).catch(console.error);

    res.json({ withdrawal: { ...updated, userFullName: row.u.fullName } });
  } catch (err) {
    console.error("[NWP admin approve withdrawal]", err);
    res.status(500).json({ error: "Failed to approve withdrawal" });
  }
});

// ── POST /nwp/admin/withdrawals/:id/complete ──────────────────────────────────
router.post("/:id/complete", async (req, res) => {
  try {
    const wId = parseInt(req.params.id, 10);

    const [row] = await db
      .select({ w: nwpWithdrawalsTable, u: nwpUsersTable })
      .from(nwpWithdrawalsTable)
      .innerJoin(nwpUsersTable, eq(nwpWithdrawalsTable.userId, nwpUsersTable.id))
      .where(eq(nwpWithdrawalsTable.id, wId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }

    const [updated] = await db
      .update(nwpWithdrawalsTable)
      .set({ status: "completed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(nwpWithdrawalsTable.id, wId))
      .returning();

    // If principal withdrawal, deactivate the investment
    if (row.w.type === "principal") {
      await db
        .update(nwpUsersTable)
        .set({
          status: "approved_inactive",
          package: null,
          investmentAmountUsd: null,
          investmentStartDate: null,
          updatedAt: new Date(),
        })
        .where(eq(nwpUsersTable.id, row.u.id));
    }

    sendWithdrawalStatusEmail({
      toEmail: row.u.email,
      fullName: row.u.fullName,
      type: row.w.type,
      amountUsd: row.w.amountUsd,
      status: "completed",
    }).catch(console.error);

    res.json({ withdrawal: { ...updated, userFullName: row.u.fullName } });
  } catch (err) {
    console.error("[NWP admin complete withdrawal]", err);
    res.status(500).json({ error: "Failed to complete withdrawal" });
  }
});

// ── POST /nwp/admin/withdrawals/:id/reject ────────────────────────────────────
router.post("/:id/reject", async (req, res) => {
  try {
    const wId = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason?: string };

    const [row] = await db
      .select({ w: nwpWithdrawalsTable, u: nwpUsersTable })
      .from(nwpWithdrawalsTable)
      .innerJoin(nwpUsersTable, eq(nwpWithdrawalsTable.userId, nwpUsersTable.id))
      .where(eq(nwpWithdrawalsTable.id, wId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }

    const [updated] = await db
      .update(nwpWithdrawalsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(nwpWithdrawalsTable.id, wId))
      .returning();

    // Unmark profits as withdrawn if profit withdrawal rejected
    // (so the balance is restored for future withdrawal)
    // Note: This is complex to track precisely without per-withdrawal ledger links.
    // For simplicity we send a notification; admin handles balance restoration manually.

    sendWithdrawalStatusEmail({
      toEmail: row.u.email,
      fullName: row.u.fullName,
      type: row.w.type,
      amountUsd: row.w.amountUsd,
      status: "rejected",
    }).catch(console.error);

    res.json({ withdrawal: { ...updated, userFullName: row.u.fullName } });
  } catch (err) {
    console.error("[NWP admin reject withdrawal]", err);
    res.status(500).json({ error: "Failed to reject withdrawal" });
  }
});

// ── POST /nwp/admin/withdrawals/:id/activate-user ─────────────────────────────
// Activate a user's investment (after admin verifies deposit)
router.post("/:userId/activate-investment", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { startDate } = req.body as { startDate?: string };

    const investmentStartDate = startDate ?? new Date().toISOString().slice(0, 10);

    const [user] = await db
      .update(nwpUsersTable)
      .set({
        status: "active",
        investmentStartDate,
        updatedAt: new Date(),
      })
      .where(eq(nwpUsersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Credit upfront referral bonus if applicable
    if (user.investmentAmountUsd) {
      const { creditUpfrontBonus } = await import("../../lib/financialEngine");
      await creditUpfrontBonus(userId, user.investmentAmountUsd).catch(console.error);
    }

    res.json({ success: true, user: { id: user.id, status: user.status, investmentStartDate: user.investmentStartDate } });
  } catch (err) {
    console.error("[NWP admin activate investment]", err);
    res.status(500).json({ error: "Failed to activate investment" });
  }
});

export default router;
