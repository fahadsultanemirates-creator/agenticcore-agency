import { Router } from "express";
import { db } from "@workspace/db";
import {
  agencyCustomersTable,
  agencyTasksTable,
  agencyCreditTransactionsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgencyAuth } from "../../middlewares/agencyAuthMiddleware";
import { sendAgencyTaskSubmittedAlert } from "../../lib/agencyEmailService";

const router = Router();

// Credit cost per service type
const SERVICE_CREDIT_COST: Record<string, number> = {
  // Strategy
  feasibility: 1,
  deep_analysis: 4,
  marketing_strategy: 4,
  // Web & Code
  website: 5,
  site_audit: 3,
  smart_contract: 6,
  analytics: 2,
  // Marketing & Social
  social_media_strategy: 3,
  social_media: 2,
  marketing: 3,
  seo: 2,
  // Content
  pdf_report: 3,
  business_card: 2,
  letterhead: 2,
  // Finance & Legal
  bookkeeping: 2,
  legal: 3,
  // Media
  image: 1,
  video: 3,
  // General
  general: 1,
};

const VALID_SERVICE_TYPES = Object.keys(SERVICE_CREDIT_COST);

// GET /agency/tasks
router.get("/", requireAgencyAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    let query = db
      .select()
      .from(agencyTasksTable)
      .where(eq(agencyTasksTable.customerId, req.agencyUser!.id));

    const tasks = await db
      .select()
      .from(agencyTasksTable)
      .where(
        status && status !== "all"
          ? and(
              eq(agencyTasksTable.customerId, req.agencyUser!.id),
              eq(agencyTasksTable.status, status as "pending" | "processing" | "done" | "failed"),
            )
          : eq(agencyTasksTable.customerId, req.agencyUser!.id),
      )
      .orderBy(agencyTasksTable.createdAt);

    res.json({ tasks });
  } catch (err) {
    console.error("[Agency Tasks] List error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST /agency/tasks
router.post("/", requireAgencyAuth, async (req, res) => {
  try {
    const { serviceType, brief } = req.body as { serviceType: string; brief: string };

    if (!serviceType || !VALID_SERVICE_TYPES.includes(serviceType)) {
      res.status(400).json({ error: "Invalid service type" });
      return;
    }
    if (!brief || brief.trim().length < 20) {
      res.status(400).json({ error: "Brief must be at least 20 characters" });
      return;
    }

    const creditCost = SERVICE_CREDIT_COST[serviceType] ?? 1;

    // Check credit balance
    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.id, req.agencyUser!.id))
      .limit(1);

    if (!customer) {
      res.status(401).json({ error: "Account not found" });
      return;
    }

    if (customer.creditBalance < creditCost) {
      res.status(400).json({
        error: `Insufficient credits. This task costs ${creditCost} credit${creditCost !== 1 ? "s" : ""} but you have ${customer.creditBalance}.`,
      });
      return;
    }

    // Deduct credits and create task atomically
    const newBalance = customer.creditBalance - creditCost;

    await db
      .update(agencyCustomersTable)
      .set({ creditBalance: newBalance })
      .where(eq(agencyCustomersTable.id, customer.id));

    const [task] = await db
      .insert(agencyTasksTable)
      .values({
        customerId: customer.id,
        serviceType: serviceType as "feasibility" | "website" | "social_media" | "marketing" | "bookkeeping" | "legal" | "seo" | "image" | "video" | "deep_analysis" | "site_audit" | "general",
        brief: brief.trim(),
        status: "pending",
        creditCost,
      })
      .returning();

    await db.insert(agencyCreditTransactionsTable).values({
      customerId: customer.id,
      type: "debit",
      amount: creditCost,
      description: `Task #${task.id}: ${serviceType}`,
      balanceAfter: newBalance,
    });

    // Fire task to AgenticCore backend async
    submitTaskToBackend(task.id, serviceType, brief, customer).catch((e) =>
      console.error("[Agency Tasks] Backend submission error:", e),
    );

    // Notify admin
    sendAgencyTaskSubmittedAlert({
      customerName: customer.fullName,
      customerEmail: customer.email,
      serviceType,
      taskId: task.id,
    }).catch((e) => console.error("[Agency Tasks] Admin alert error:", e));

    res.status(201).json(task);
  } catch (err) {
    console.error("[Agency Tasks] Submit error:", err);
    res.status(500).json({ error: "Failed to submit task" });
  }
});

// GET /agency/tasks/:taskId
router.get("/:taskId", requireAgencyAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const [task] = await db
      .select()
      .from(agencyTasksTable)
      .where(
        and(
          eq(agencyTasksTable.id, taskId),
          eq(agencyTasksTable.customerId, req.agencyUser!.id),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  } catch (err) {
    console.error("[Agency Tasks] Get error:", err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// ── Internal: forward task to the AgenticCore multi-agent backend ────────────
// Backend contract: POST /api/task { customer_id: string, request: string }
// Returns: { customer_id, result, agents_used, image_urls, video_urls }
async function submitTaskToBackend(
  taskId: number,
  serviceType: string,
  brief: string,
  customer: { id: number; email: string; fullName: string },
) {
  const BACKEND_URL = process.env.AGENCY_BACKEND_URL || "http://localhost:8000";

  // customer_id is used as an external reference key for the Supabase-backed memory
  const customerId = customer.email;
  // Compose the request string: service type prefix + customer brief
  const requestText = `[Service: ${serviceType}]\n[Customer: ${customer.fullName}]\n[Task #${taskId}]\n\n${brief}`;

  try {
    await db
      .update(agencyTasksTable)
      .set({ status: "processing" })
      .where(eq(agencyTasksTable.id, taskId));

    const resp = await fetch(`${BACKEND_URL}/api/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId,
        request: requestText,
        async_mode: false,
      }),
      signal: AbortSignal.timeout(300_000), // 5 min
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend returned ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as {
      result: string;
      agents_used: string[];
      image_urls?: string[];
      video_urls?: string[];
    };

    await db
      .update(agencyTasksTable)
      .set({
        status: "done",
        result: data.result ?? null,
        imageUrls: data.image_urls?.length ? data.image_urls : null,
        videoUrls: data.video_urls?.length ? data.video_urls : null,
        agentsUsed: data.agents_used?.length ? data.agents_used : null,
      })
      .where(eq(agencyTasksTable.id, taskId));
  } catch (err) {
    console.error(`[Agency Tasks] Backend task ${taskId} failed:`, err);
    // Refund credits on failure
    await db
      .update(agencyTasksTable)
      .set({ status: "failed" })
      .where(eq(agencyTasksTable.id, taskId));
  }
}

export default router;
