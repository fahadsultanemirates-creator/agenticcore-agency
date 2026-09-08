import { Router } from "express";
import { db } from "@workspace/db";
import { agencyCustomersTable, agencyTasksTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { requireAgencyAuth } from "../../middlewares/agencyAuthMiddleware";

const router = Router();

// NOTE: This router is mounted at "/" in agency/index.ts so paths are the
// full sub-paths (/me and /stats) relative to /agency.

function safeCustomer(c: typeof agencyCustomersTable.$inferSelect) {
  return {
    id: c.id,
    email: c.email,
    fullName: c.fullName,
    company: c.company ?? null,
    creditBalance: c.creditBalance,
    status: c.status,
    createdAt: c.createdAt,
  };
}

// GET /agency/me
router.get("/me", requireAgencyAuth, async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.id, req.agencyUser!.id))
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const taskRows = await db
      .select({ status: agencyTasksTable.status, count: count() })
      .from(agencyTasksTable)
      .where(eq(agencyTasksTable.customerId, req.agencyUser!.id))
      .groupBy(agencyTasksTable.status);

    const tasksByStatus = { pending: 0, processing: 0, done: 0, failed: 0 };
    let totalTasks = 0;
    for (const row of taskRows) {
      tasksByStatus[row.status as keyof typeof tasksByStatus] = Number(row.count);
      totalTasks += Number(row.count);
    }

    const stats = { creditBalance: customer.creditBalance, totalTasks, tasksByStatus };

    res.json({ customer: safeCustomer(customer), stats });
  } catch (err) {
    console.error("[Agency Customer] Profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// GET /agency/stats (mounted directly at /agency/)
router.get("/stats", requireAgencyAuth, async (req, res) => {
  try {
    const [customer] = await db
      .select({ creditBalance: agencyCustomersTable.creditBalance })
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.id, req.agencyUser!.id))
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const taskRows = await db
      .select({ status: agencyTasksTable.status, count: count() })
      .from(agencyTasksTable)
      .where(eq(agencyTasksTable.customerId, req.agencyUser!.id))
      .groupBy(agencyTasksTable.status);

    const tasksByStatus = { pending: 0, processing: 0, done: 0, failed: 0 };
    let totalTasks = 0;
    for (const row of taskRows) {
      tasksByStatus[row.status as keyof typeof tasksByStatus] = Number(row.count);
      totalTasks += Number(row.count);
    }

    res.json({ creditBalance: customer.creditBalance, totalTasks, tasksByStatus });
  } catch (err) {
    console.error("[Agency Customer] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
