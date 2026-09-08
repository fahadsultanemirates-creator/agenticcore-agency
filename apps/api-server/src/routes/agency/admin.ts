import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  agencyCustomersTable,
  agencyTasksTable,
  agencyCreditTransactionsTable,
} from "@workspace/db/schema";
import { eq, count, ilike, or, sql, desc } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const router = Router();

// ── Dedicated agency admin key auth ──────────────────────────────────────────
// Set AGENCY_ADMIN_KEY in Replit Secrets. This is a separate secret from NWP.
function requireAgencyAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-agency-admin-key"];
  const expected = process.env.AGENCY_ADMIN_KEY;
  if (!expected) {
    console.error("[Agency Admin] AGENCY_ADMIN_KEY env var is not set — admin routes disabled.");
    res.status(503).json({ error: "Admin access is not configured. Set AGENCY_ADMIN_KEY in Replit Secrets." });
    return;
  }
  if (key !== expected) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

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

// GET /agency/admin/stats
router.get("/stats", requireAgencyAdmin, async (req, res) => {
  try {
    const [{ totalCustomers }] = await db
      .select({ totalCustomers: count() })
      .from(agencyCustomersTable);

    const taskRows = await db
      .select({ status: agencyTasksTable.status, cnt: count() })
      .from(agencyTasksTable)
      .groupBy(agencyTasksTable.status);

    const tasksByStatus = { pending: 0, processing: 0, done: 0, failed: 0 };
    let totalTasks = 0;
    for (const row of taskRows) {
      tasksByStatus[row.status as keyof typeof tasksByStatus] = Number(row.cnt);
      totalTasks += Number(row.cnt);
    }

    const creditResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${agencyCreditTransactionsTable.amount}), 0)`,
      })
      .from(agencyCreditTransactionsTable)
      .where(eq(agencyCreditTransactionsTable.type, "credit"));

    const totalCreditsIssued = Number(creditResult[0]?.total ?? 0);

    res.json({ totalCustomers: Number(totalCustomers), totalTasks, tasksByStatus, totalCreditsIssued });
  } catch (err) {
    console.error("[Agency Admin] Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /agency/admin/customers
router.get("/customers", requireAgencyAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const customers = search
      ? await db
          .select()
          .from(agencyCustomersTable)
          .where(
            or(
              ilike(agencyCustomersTable.email, `%${search}%`),
              ilike(agencyCustomersTable.fullName, `%${search}%`),
            ),
          )
          .orderBy(desc(agencyCustomersTable.createdAt))
      : await db
          .select()
          .from(agencyCustomersTable)
          .orderBy(desc(agencyCustomersTable.createdAt));

    res.json({ customers: customers.map(safeCustomer) });
  } catch (err) {
    console.error("[Agency Admin] Customers list error:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// POST /agency/admin/customers/:customerId/credits
router.post("/customers/:customerId/credits", requireAgencyAdmin, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId as string, 10);
    if (isNaN(customerId)) {
      res.status(400).json({ error: "Invalid customer ID" });
      return;
    }

    const { amount, description } = req.body as { amount: number; description: string };
    if (typeof amount !== "number" || !description) {
      res.status(400).json({ error: "amount (number) and description are required" });
      return;
    }

    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.id, customerId))
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const newBalance = customer.creditBalance + amount;
    if (newBalance < 0) {
      res.status(400).json({ error: "Cannot deduct more credits than the customer has" });
      return;
    }

    const [updated] = await db
      .update(agencyCustomersTable)
      .set({ creditBalance: newBalance })
      .where(eq(agencyCustomersTable.id, customerId))
      .returning();

    await db.insert(agencyCreditTransactionsTable).values({
      customerId,
      type: amount >= 0 ? "credit" : "debit",
      amount: Math.abs(amount),
      description,
      balanceAfter: newBalance,
    });

    res.json({ customer: safeCustomer(updated) });
  } catch (err) {
    console.error("[Agency Admin] Credits adjust error:", err);
    res.status(500).json({ error: "Failed to adjust credits" });
  }
});

// GET /agency/admin/jobs  — reads nexus-studio-backend tables via raw SQL
router.get("/jobs", requireAgencyAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const statusClause = status !== "all" ? `AND j.status = $2` : "";
    const params: (string | number)[] = statusClause ? [limit, status] : [limit];

    const { rows } = await pool.query(
      `SELECT j.id, j.customer_id, j.project_id, j.status,
              j.request_text, j.result, j.error, j.created_at, j.updated_at,
              c.external_ref AS customer_ref,
              COALESCE(
                (SELECT array_agg(DISTINCT agent)
                 FROM conversation_messages cm,
                      jsonb_array_elements_text(cm.agents_used::jsonb) AS agent
                 WHERE cm.customer_id = j.customer_id
                   AND cm.created_at BETWEEN j.created_at - INTERVAL '30 seconds' AND j.updated_at + INTERVAL '30 seconds'
                ), ARRAY[]::text[]
              ) AS agents_used
       FROM jobs j
       LEFT JOIN customers c ON c.id = j.customer_id
       WHERE 1=1 ${statusClause}
       ORDER BY j.created_at DESC
       LIMIT $1`,
      params,
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM jobs j WHERE 1=1 ${status !== "all" ? "AND j.status = $1" : ""}`,
      status !== "all" ? [status] : [],
    );

    res.json({
      jobs: rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        customerRef: r.customer_ref ?? r.customer_id,
        projectId: r.project_id ?? null,
        status: r.status,
        requestText: r.request_text,
        result: r.result ?? null,
        error: r.error ?? null,
        agentsUsed: r.agents_used ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: parseInt(countRows[0]?.total ?? "0", 10),
    });
  } catch (err) {
    console.error("[Agency Admin] Jobs list error:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

// GET /agency/admin/projects  — nexus-studio-backend projects with file/deliverable counts
router.get("/projects", requireAgencyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.customer_id, p.name, p.created_at, p.updated_at,
              c.external_ref AS customer_ref,
              COUNT(DISTINCT pf.id) AS file_count,
              COUNT(DISTINCT d.id) AS deliverable_count,
              array_agg(DISTINCT d.type) FILTER (WHERE d.type IS NOT NULL) AS deliverable_types
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN project_files pf ON pf.project_id = p.id
       LEFT JOIN deliverables d ON d.project_id = p.id
       GROUP BY p.id, p.customer_id, p.name, p.created_at, p.updated_at, c.external_ref
       ORDER BY p.updated_at DESC`,
    );

    res.json({
      projects: rows.map((r) => ({
        id: r.id,
        customerId: r.customer_id,
        customerRef: r.customer_ref ?? r.customer_id,
        name: r.name,
        fileCount: parseInt(r.file_count ?? "0", 10),
        deliverableCount: parseInt(r.deliverable_count ?? "0", 10),
        deliverableTypes: r.deliverable_types ?? [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: rows.length,
    });
  } catch (err) {
    console.error("[Agency Admin] Projects list error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /agency/admin/projects/:projectId/files
router.get("/projects/:projectId/files", requireAgencyAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { rows: projectRows } = await pool.query(
      `SELECT p.id, p.name, c.external_ref AS customer_ref
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.id = $1`,
      [projectId],
    );

    if (!projectRows[0]) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { rows: fileRows } = await pool.query(
      `SELECT id, filename, purpose, content, updated_at
       FROM project_files
       WHERE project_id = $1
       ORDER BY filename ASC`,
      [projectId],
    );

    res.json({
      projectId: projectRows[0].id,
      projectName: projectRows[0].name,
      customerRef: projectRows[0].customer_ref ?? projectId,
      files: fileRows.map((f) => ({
        id: f.id,
        filename: f.filename,
        purpose: f.purpose,
        content: f.content,
        updatedAt: f.updated_at,
      })),
    });
  } catch (err) {
    console.error("[Agency Admin] Project files error:", err);
    res.status(500).json({ error: "Failed to fetch project files" });
  }
});

// GET /agency/admin/agent-usage
router.get("/agent-usage", requireAgencyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT agent, COUNT(*) AS call_count
       FROM conversation_messages,
            jsonb_array_elements_text(
              CASE
                WHEN agents_used IS NULL THEN '[]'::jsonb
                WHEN jsonb_typeof(agents_used::jsonb) = 'array' THEN agents_used::jsonb
                ELSE '[]'::jsonb
              END
            ) AS agent
       WHERE role = 'assistant'
         AND agents_used IS NOT NULL
         AND agents_used != '[]'
         AND agents_used != 'null'
       GROUP BY agent
       ORDER BY call_count DESC`,
    );

    const total = rows.reduce((sum, r) => sum + parseInt(r.call_count, 10), 0);

    res.json({
      agents: rows.map((r) => ({
        name: r.agent,
        count: parseInt(r.call_count, 10),
        percentage: total > 0 ? Math.round((parseInt(r.call_count, 10) / total) * 100) : 0,
      })),
      totalCallsTracked: total,
    });
  } catch (err) {
    console.error("[Agency Admin] Agent usage error:", err);
    res.status(500).json({ error: "Failed to fetch agent usage" });
  }
});

// GET /agency/admin/tasks
router.get("/tasks", requireAgencyAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;

    const customerIdNum = customerId ? parseInt(customerId, 10) : null;

    // Build conditions
    const conditions = [];
    if (status && status !== "all") {
      conditions.push(
        eq(agencyTasksTable.status, status as "pending" | "processing" | "done" | "failed"),
      );
    }
    if (customerIdNum && !isNaN(customerIdNum)) {
      conditions.push(eq(agencyTasksTable.customerId, customerIdNum));
    }

    const tasks = await db
      .select({
        id: agencyTasksTable.id,
        customerId: agencyTasksTable.customerId,
        customerEmail: agencyCustomersTable.email,
        serviceType: agencyTasksTable.serviceType,
        brief: agencyTasksTable.brief,
        status: agencyTasksTable.status,
        creditCost: agencyTasksTable.creditCost,
        result: agencyTasksTable.result,
        imageUrls: agencyTasksTable.imageUrls,
        videoUrls: agencyTasksTable.videoUrls,
        agentsUsed: agencyTasksTable.agentsUsed,
        createdAt: agencyTasksTable.createdAt,
        updatedAt: agencyTasksTable.updatedAt,
      })
      .from(agencyTasksTable)
      .leftJoin(
        agencyCustomersTable,
        eq(agencyTasksTable.customerId, agencyCustomersTable.id),
      )
      .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) : undefined)
      .orderBy(desc(agencyTasksTable.createdAt));

    res.json({ tasks });
  } catch (err) {
    console.error("[Agency Admin] Tasks list error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

export default router;
