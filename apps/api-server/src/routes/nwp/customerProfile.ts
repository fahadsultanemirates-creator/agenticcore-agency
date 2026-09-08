import { Router } from "express";
import { db } from "@workspace/db";
import { nwpProfileRequestsTable, nwpUsersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";
import { sendProfileRequestAlert } from "../../lib/emailService";

const router = Router();
router.use(requireNwpAuth);

const ALLOWED_FIELDS = ["mobile", "address", "email", "bnb_wallet"] as const;

// ── GET /nwp/profile-requests ─────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const requests = await db
      .select()
      .from(nwpProfileRequestsTable)
      .where(eq(nwpProfileRequestsTable.userId, req.nwpUser!.id))
      .orderBy(nwpProfileRequestsTable.createdAt);

    res.json({ requests });
  } catch (err) {
    console.error("[NWP profile requests]", err);
    res.status(500).json({ error: "Failed to fetch profile requests" });
  }
});

// ── POST /nwp/profile-requests ────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { field, newValue } = req.body as { field: string; newValue: string };

    if (!field || !newValue?.trim()) {
      res.status(400).json({ error: "field and newValue are required" });
      return;
    }

    if (!ALLOWED_FIELDS.includes(field as (typeof ALLOWED_FIELDS)[number])) {
      res.status(400).json({
        error: `field must be one of: ${ALLOWED_FIELDS.join(", ")}`,
      });
      return;
    }

    // Validate BNB wallet if requested
    if (field === "bnb_wallet" && !/^0x[a-fA-F0-9]{40}$/.test(newValue.trim())) {
      res.status(400).json({ error: "Invalid BNB wallet address format" });
      return;
    }

    // Get user info for notification
    const [user] = await db
      .select({ fullName: nwpUsersTable.fullName, email: nwpUsersTable.email })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, req.nwpUser!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [request] = await db
      .insert(nwpProfileRequestsTable)
      .values({
        userId: req.nwpUser!.id,
        field: field as (typeof ALLOWED_FIELDS)[number],
        newValue: newValue.trim(),
        status: "pending",
      })
      .returning();

    sendProfileRequestAlert({
      fullName: user.fullName,
      email: user.email,
      field,
      newValue: newValue.trim(),
      requestId: request.id,
    }).catch(console.error);

    res.status(201).json({ request });
  } catch (err) {
    console.error("[NWP profile request submit]", err);
    res.status(500).json({ error: "Failed to submit profile request" });
  }
});

export default router;
