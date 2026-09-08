import { Router } from "express";
import { db } from "@workspace/db";
import { nwpProfileRequestsTable, nwpUsersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireNwpAdmin } from "../../middlewares/nwpAdminMiddleware";
import {
  sendProfileRequestApprovedEmail,
  sendProfileRequestRejectedEmail,
} from "../../lib/emailService";

const router = Router();
router.use(requireNwpAdmin);

// ── GET /nwp/admin/profile-requests ──────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status = "pending" } = req.query as { status?: string };

    const rows = await db
      .select({
        id: nwpProfileRequestsTable.id,
        userId: nwpProfileRequestsTable.userId,
        field: nwpProfileRequestsTable.field,
        newValue: nwpProfileRequestsTable.newValue,
        status: nwpProfileRequestsTable.status,
        createdAt: nwpProfileRequestsTable.createdAt,
        updatedAt: nwpProfileRequestsTable.updatedAt,
        userFullName: nwpUsersTable.fullName,
        userEmail: nwpUsersTable.email,
        userMobile: nwpUsersTable.mobile,
      })
      .from(nwpProfileRequestsTable)
      .innerJoin(nwpUsersTable, eq(nwpProfileRequestsTable.userId, nwpUsersTable.id))
      .where(
        status === "all"
          ? undefined
          : eq(nwpProfileRequestsTable.status, status as typeof nwpProfileRequestsTable.$inferSelect["status"])
      )
      .orderBy(nwpProfileRequestsTable.createdAt);

    res.json({ requests: rows });
  } catch (err) {
    console.error("[NWP admin profile requests]", err);
    res.status(500).json({ error: "Failed to fetch profile requests" });
  }
});

// ── POST /nwp/admin/profile-requests/:id/approve ─────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);

    // Get the request with user info
    const [row] = await db
      .select({
        req: nwpProfileRequestsTable,
        user: nwpUsersTable,
      })
      .from(nwpProfileRequestsTable)
      .innerJoin(nwpUsersTable, eq(nwpProfileRequestsTable.userId, nwpUsersTable.id))
      .where(eq(nwpProfileRequestsTable.id, requestId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Profile request not found" });
      return;
    }

    const { req: profileReq, user } = row;

    // Apply the change to the user record
    const updateData: Partial<typeof nwpUsersTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (profileReq.field === "mobile") updateData.mobile = profileReq.newValue;
    else if (profileReq.field === "address") updateData.address = profileReq.newValue;
    else if (profileReq.field === "email") updateData.email = profileReq.newValue.toLowerCase();
    else if (profileReq.field === "bnb_wallet") updateData.bnbWallet = profileReq.newValue;

    await db
      .update(nwpUsersTable)
      .set(updateData)
      .where(eq(nwpUsersTable.id, user.id));

    // Mark request approved
    const [updated] = await db
      .update(nwpProfileRequestsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(nwpProfileRequestsTable.id, requestId))
      .returning();

    sendProfileRequestApprovedEmail({
      toEmail: profileReq.field === "email" ? user.email : user.email,
      fullName: user.fullName,
      field: profileReq.field,
      newValue: profileReq.newValue,
    }).catch(console.error);

    res.json({ request: { ...updated, userFullName: user.fullName, userEmail: user.email } });
  } catch (err) {
    console.error("[NWP admin approve profile request]", err);
    res.status(500).json({ error: "Failed to approve profile request" });
  }
});

// ── POST /nwp/admin/profile-requests/:id/reject ──────────────────────────────
router.post("/:id/reject", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);

    const [row] = await db
      .select({
        req: nwpProfileRequestsTable,
        user: nwpUsersTable,
      })
      .from(nwpProfileRequestsTable)
      .innerJoin(nwpUsersTable, eq(nwpProfileRequestsTable.userId, nwpUsersTable.id))
      .where(eq(nwpProfileRequestsTable.id, requestId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Profile request not found" });
      return;
    }

    const [updated] = await db
      .update(nwpProfileRequestsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(nwpProfileRequestsTable.id, requestId))
      .returning();

    sendProfileRequestRejectedEmail({
      toEmail: row.user.email,
      fullName: row.user.fullName,
      field: row.req.field,
    }).catch(console.error);

    res.json({ request: { ...updated, userFullName: row.user.fullName, userEmail: row.user.email } });
  } catch (err) {
    console.error("[NWP admin reject profile request]", err);
    res.status(500).json({ error: "Failed to reject profile request" });
  }
});

export default router;
