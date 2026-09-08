import { Router } from "express";
import { db } from "@workspace/db";
import { agencyCreditTransactionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAgencyAuth } from "../../middlewares/agencyAuthMiddleware";

const router = Router();

// GET /agency/credits/transactions
router.get("/transactions", requireAgencyAuth, async (req, res) => {
  try {
    const transactions = await db
      .select()
      .from(agencyCreditTransactionsTable)
      .where(eq(agencyCreditTransactionsTable.customerId, req.agencyUser!.id))
      .orderBy(agencyCreditTransactionsTable.createdAt);

    res.json({ transactions });
  } catch (err) {
    console.error("[Agency Credits] List error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

export default router;
