import { Router } from "express";
import { db } from "@workspace/db";
import { nwpUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireNwpAdmin } from "../../middlewares/nwpAdminMiddleware";
import {
  sendApprovalEmail,
  sendRejectionEmail,
} from "../../lib/emailService";

const router = Router();
router.use(requireNwpAdmin);

function safeUser(user: typeof nwpUsersTable.$inferSelect) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    country: user.country,
    address: user.address,
    bnbWallet: user.bnbWallet,
    referralCode: user.referralCode,
    referredById: user.referredById,
    status: user.status,
    role: user.role,
    package: user.package,
    investmentAmountUsd: user.investmentAmountUsd,
    investmentStartDate: user.investmentStartDate,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ── GET /nwp/admin/users ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    let query = db.select().from(nwpUsersTable).orderBy(nwpUsersTable.createdAt);

    if (status && status !== "all") {
      const users = await db
        .select()
        .from(nwpUsersTable)
        .where(eq(nwpUsersTable.status, status as typeof nwpUsersTable.$inferSelect["status"]))
        .orderBy(nwpUsersTable.createdAt);
      res.json({ users: users.map(safeUser) });
      return;
    }

    const users = await query;
    res.json({ users: users.map(safeUser) });
  } catch (err) {
    console.error("[NWP admin users]", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── POST /nwp/admin/users/:id/approve ────────────────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [user] = await db
      .update(nwpUsersTable)
      .set({ status: "approved_inactive", updatedAt: new Date() })
      .where(eq(nwpUsersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    sendApprovalEmail({ toEmail: user.email, fullName: user.fullName }).catch(console.error);
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[NWP admin approve]", err);
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// ── POST /nwp/admin/users/:id/reject ─────────────────────────────────────────
router.post("/:id/reject", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { reason } = req.body as { reason?: string };

    const [user] = await db
      .update(nwpUsersTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(nwpUsersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    sendRejectionEmail({ toEmail: user.email, fullName: user.fullName, reason }).catch(console.error);
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[NWP admin reject]", err);
    res.status(500).json({ error: "Failed to reject user" });
  }
});

// ── POST /nwp/admin/users/:id/activate ───────────────────────────────────────
router.post("/:id/activate", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [user] = await db
      .update(nwpUsersTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(nwpUsersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[NWP admin activate]", err);
    res.status(500).json({ error: "Failed to activate user" });
  }
});

// ── POST /nwp/admin/users/:id/deactivate ─────────────────────────────────────
router.post("/:id/deactivate", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [user] = await db
      .update(nwpUsersTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(nwpUsersTable.id, userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[NWP admin deactivate]", err);
    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

// ── DELETE /nwp/admin/users/:id ──────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const [deleted] = await db
      .delete(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .returning({ id: nwpUsersTable.id });

    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[NWP admin delete user]", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
